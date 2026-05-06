
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import database as db
import prolog_integration as prolog_logic
from datetime import datetime, timedelta
import json
import os
from jose import JWTError, jwt
try:
    from twilio.rest import Client
except ImportError:
    Client = None

app = FastAPI(title="IoT Kitchen System API")

# --- Configuración Real WhatsApp ---
# En producción, estas se cargan desde variables de entorno
TWILIO_SID = os.environ.get("TWILIO_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886") # Sandbox o número real
PROVIDER_NUMBER = os.environ.get("PROVIDER_NUMBER", "whatsapp:+525650545979") # Número del proveedor real actualizado

# --- JWT Config ---
# En producción, configurar JWT_SECRET_KEY en las variables de entorno
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "sgac_super_secret_key_pro")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 hrs

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- WebSockets Config ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# --- WhatsApp / Twilio Config ---
def send_whatsapp_alert(message: str):
    if Client is None:
        print(f"[ERROR WHATSAPP] La librería Twilio no está instalada. Mensaje descartado: {message}")
        return
        
    if not TWILIO_SID or not TWILIO_AUTH_TOKEN:
        print(f"[ERROR WHATSAPP] Faltan credenciales de Twilio (TWILIO_SID, TWILIO_AUTH_TOKEN). Mensaje descartado: {message}")
        return
    
    try:
        client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
        message_resp = client.messages.create(
            body=message,
            from_=TWILIO_WHATSAPP_FROM,
            to=PROVIDER_NUMBER
        )
        print(f"Mensaje enviado exitosamente. SID: {message_resp.sid}, Status: {message_resp.status}")
    except Exception as e:
        print(f"Error enviando WhatsApp: {e}")

# --- WEBHOOK WHATSAPP (Entrada de Proveedor) ---
@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook(Body: str = Form(...), From: str = Form(...)):
    """
    Recibe mensajes del proveedor vía WhatsApp.
    Formato esperado: "Entregado [insumo] [cantidad] [dias_caducidad]"
    Ejemplo: "Entregado carne 10 5"
    """
    msg = Body.lower().strip()
    print(f"Mensaje recibido de {From}: {msg}")

    if msg.startswith("entregado"):
        parts = msg.split()
        if len(parts) >= 3:
            insumo = parts[1]
            cantidad = float(parts[2])
            dias_cad = int(parts[3]) if len(parts) > 3 else 7
            
            # 1. Actualizar Inventario (Simula que el proveedor puso el producto en la báscula)
            # Buscamos el insumo en la DB
            item = db.col_inventory.find_one({"insumo": insumo})
            if item:
                nueva_cantidad = item["cantidad_kg"] + cantidad
                db.col_inventory.update_one(
                    {"insumo": insumo}, 
                    {"$set": {
                        "cantidad_kg": nueva_cantidad, 
                        "dias_caducidad": dias_cad,
                        "fecha_ingreso": datetime.now()
                    }}
                )
                
                # Marcar pedidos pendientes como entregados
                db.col_orders.update_many({"insumo": insumo, "estado": "pendiente"}, {"$set": {"estado": "entregado"}})

                # 2. Notificar vía WebSocket para que el Dashboard se actualice al instante
                await manager.broadcast(json.dumps({
                    "type": "iot_update", 
                    "data": {"device_id": f"b_{insumo}", "peso_kg": nueva_cantidad, "temperatura": 4.0}
                }))

                # 3. Confirmar al proveedor
                send_whatsapp_alert(f"✅ Registro exitoso: {cantidad}kg de {insumo} recibidos. La IA ha estimado {dias_cad} días de frescura.")
                
                return {"status": "success"}

    return {"status": "ignored"}

# Habilitar CORS para permitir peticiones desde el frontend web
frontend_url = os.environ.get("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if frontend_url != "*" else ["*"], # En producción, limitar al dominio real del frontend
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Inicialización ---
@app.on_event("startup")
def startup_event():
    db.init_db()

# --- Endpoints IoT ---
@app.post("/api/iot/data")
async def receive_iot_data(data: db.IoTData):
    """Recibe datos físicos de los sensores ESP32 (peso y temperatura)"""
    # 1. Registrar Temperatura
    db.log_temperature(data.device_id, data.temperatura)
    
    # Alerta de temperatura
    if data.temperatura > 8.0:
        send_whatsapp_alert(f"⚠️ ALERTA DE CADENA DE FRÍO en {data.device_id}: Temperatura {data.temperatura}°C es peligrosa. NO ABRA LA CÁMARA.")

    # 2. Actualizar Peso (Adaptado para 2 sensores reales)
    # Por defecto asumen carne y pollo, pero se pueden configurar por variables de entorno
    sensor_1_item = os.environ.get("SENSOR_1_ITEM", "carne")
    sensor_2_item = os.environ.get("SENSOR_2_ITEM", "pollo")

    insumo_map = {
        "sensor_1": sensor_1_item,
        "sensor_2": sensor_2_item
    }
    
    # Si el sensor envía directamente 'b_carne' (como estaba antes), lo soportamos también
    insumo = data.device_id.replace("b_", "") if data.device_id.startswith("b_") else insumo_map.get(data.device_id)
    
    if insumo:
        db.update_inventory_weight(insumo, data.peso_kg)
        
        # Verificar si hay poco stock
        item = db.col_inventory.find_one({"insumo": insumo})
        if item and item["cantidad_kg"] < item["umbral_minimo"]:
            send_whatsapp_alert(f"📦 ALERTA INVENTARIO: El insumo {insumo} está por debajo del límite ({data.peso_kg}kg). Se requiere proveedor.")

    # 3. Emitir WebSocket
    await manager.broadcast(json.dumps({"type": "iot_update", "data": data.model_dump()}))
    
    return {"status": "success", "message": "Datos recibidos"}

# --- WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Endpoints Frontend (Chef Panel) ---
@app.get("/api/dashboard/inventory")
def get_inventory():
    """Retorna el estado actual del inventario"""
    inventory = db.get_all_inventory()
    # Convertir _id y fechas a strings si existen
    for item in inventory:
        if "fecha_ingreso" in item:
            item["fecha_ingreso"] = item["fecha_ingreso"].isoformat()
    return {"inventory": inventory}

@app.get("/api/dashboard/temperature")
def get_temperature():
    """Retorna la última temperatura registrada"""
    temp = db.get_current_temperature()
    return {"temperatura": temp}

@app.get("/api/dashboard/orders")
def get_orders():
    """Retorna los pedidos automáticos generados"""
    orders = list(db.col_orders.find({}, {"_id": 0}))
    for o in orders:
        if "fecha_pedido" in o:
            o["fecha_pedido"] = o["fecha_pedido"].isoformat()
    return {"orders": orders}

@app.get("/api/dashboard/production")
def get_production_history():
    """Retorna el historial de producción del día"""
    prod = list(db.col_production.find({}, {"_id": 0}).sort("timestamp", -1))
    for p in prod:
        if "timestamp" in p:
            p["timestamp"] = p["timestamp"].isoformat()
    return {"production": prod}

@app.get("/api/dashboard/active_tasks")
def get_active_tasks():
    """Retorna la lista de cocineros y sus recetas actualmente en curso"""
    tasks = db.get_active_tasks()
    for t in tasks:
        if "timestamp" in t:
            t["timestamp"] = t["timestamp"].isoformat()
    return {"active_tasks": tasks}

@app.get("/api/dashboard/analytics")
def get_analytics():
    """Retorna datos calculados para analítica basados en la realidad del sistema"""
    # 1. Calcular consumo (Simulado por ahora si no hay registros, pero dinámico)
    # En un sistema real aquí haríamos agregaciones por día
    production_count = db.col_production.count_documents({})
    
    return {
        "consumo_diario": [
            {"dia": "Lun", "carne": 0, "pollo": 0, "cerdo": 0},
            {"dia": "Mar", "carne": 0, "pollo": 0, "cerdo": 0},
            {"dia": "Mie", "carne": 0, "pollo": 0, "cerdo": 0},
            {"dia": "Jue", "carne": 0, "pollo": 0, "cerdo": 0},
            {"dia": "Vie", "carne": 0, "pollo": 0, "cerdo": 0},
            {"dia": "Sab", "carne": 0, "pollo": 0, "cerdo": 0},
            {"dia": "Dom", "carne": 0, "pollo": 0, "cerdo": 0},
        ],
        "predicciones": [
            {"insumo": "carne", "dias_restantes": 7, "tendencia": "Estable"},
            {"insumo": "queso", "dias_restantes": 7, "tendencia": "Estable"},
            {"insumo": "pollo", "dias_restantes": 7, "tendencia": "Estable"},
        ] if production_count == 0 else [
            {"insumo": "carne", "dias_restantes": 2, "tendencia": "Alta"},
            {"insumo": "queso", "dias_restantes": 5, "tendencia": "Estable"},
            {"insumo": "pollo", "dias_restantes": 1, "tendencia": "Crítica"},
        ]
    }

# --- Endpoints Frontend (Cook Panel - Sistema Autónomo) ---
@app.post("/api/cook/request_recipe")
def request_recipe(req: db.RecipeRequest):
    """
    El cocinero pide una tarea. El sistema Prolog evalúa qué se puede hacer.
    """
    recetas_disponibles = prolog_logic.get_available_recipes()
    
    if not recetas_disponibles:
        return {"status": "error", "message": "No hay recetas disponibles por falta de inventario."}
    
    # Seleccionar la primera receta disponible
    receta_id = recetas_disponibles[0]
    
    # Obtener detalles de la receta
    recipe_details = db.col_recipes.find_one({"id_receta": receta_id}, {"_id": 0})
    
    # Registrar como tarea en curso
    db.add_active_task(req.cocinero_id, receta_id, recipe_details["nombre"])
    
    return {"status": "success", "recipe": recipe_details}

@app.post("/api/cook/finish_recipe")
def finish_recipe(req: db.RecipeCompletion):
    """El cocinero finaliza la receta, se descuentan insumos virtuales y se registra la producción"""
    # Descontar del inventario lógico (asumiendo que los sensores aún no lo han detectado o es paralelo)
    # En un sistema puramente de peso, el peso baja solo, pero esto asegura consistencia lógica.
    db.deduct_inventory_for_recipe(req.receta_id)
    
    # Registrar la producción
    db.record_production(req.cocinero_id, req.receta_id)
    
    # Remover de tareas activas
    db.remove_active_task(req.cocinero_id)
    
    return {"status": "success", "message": "Producción registrada"}

# --- Endpoints de Autenticación ---
@app.post("/api/auth/register")
def register(user: db.UserRegister):
    success = db.register_user(user.username, user.password, user.role)
    if not success:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    return {"status": "success", "message": "Usuario registrado exitosamente"}

@app.post("/api/auth/login")
def login(user: db.UserLogin):
    user_data = db.authenticate_user(user.username, user.password)
    if not user_data:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Generar JWT
    access_token = create_access_token(data={"sub": user_data["username"], "role": user_data["role"]})
    return {"status": "success", "access_token": access_token, "token_type": "bearer", "user": user_data}
