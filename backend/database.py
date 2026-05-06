import pymongo
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

import os

# --- Configuración de Base de Datos ---
# En producción, usa la URL de tu base de datos en la nube (ej. MongoDB Atlas)
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
client = pymongo.MongoClient(MONGO_URI)
db = client["iot_kitchen_db"]

# Colecciones
col_inventory = db["inventory"]
col_recipes = db["recipes"]
col_production = db["production"]
col_orders = db["orders"]
col_temperature = db["temperature_logs"]
col_users = db["users"]
col_active_tasks = db["active_tasks"]

# --- Modelos Pydantic (para FastAPI) ---

class IoTData(BaseModel):
    device_id: str
    temperatura: float
    peso_kg: float

class RecipeRequest(BaseModel):
    cocinero_id: str

class RecipeCompletion(BaseModel):
    cocinero_id: str
    receta_id: str

class UserRegister(BaseModel):
    username: str
    password: str
    role: str # "chef" o "cocinero"

class UserLogin(BaseModel):
    username: str
    password: str

# --- Inicialización de Datos Dummy (Solo para pruebas) ---
def init_db():
    is_production = os.environ.get("ENV", "development").lower() == "production"
    
    if col_inventory.count_documents({}) == 0 and not is_production:
        # Añadiendo fecha_caducidad (días a partir de hoy) para la IA
        col_inventory.insert_many([
            {"insumo": "carne", "cantidad_kg": 5.0, "umbral_minimo": 1.0, "fecha_ingreso": datetime.now(), "dias_caducidad": 3},
            {"insumo": "pan", "cantidad_kg": 2.0, "umbral_minimo": 0.5, "fecha_ingreso": datetime.now(), "dias_caducidad": 5},
            {"insumo": "queso", "cantidad_kg": 1.0, "umbral_minimo": 0.2, "fecha_ingreso": datetime.now(), "dias_caducidad": 10},
            {"insumo": "lechuga", "cantidad_kg": 2.0, "umbral_minimo": 0.5, "fecha_ingreso": datetime.now(), "dias_caducidad": 2},
            {"insumo": "pollo", "cantidad_kg": 3.0, "umbral_minimo": 1.0, "fecha_ingreso": datetime.now(), "dias_caducidad": 4},
            {"insumo": "aderezo", "cantidad_kg": 1.0, "umbral_minimo": 0.2, "fecha_ingreso": datetime.now(), "dias_caducidad": 30},
            {"insumo": "cerdo", "cantidad_kg": 4.0, "umbral_minimo": 1.5, "fecha_ingreso": datetime.now(), "dias_caducidad": 4},
            {"insumo": "tortilla", "cantidad_kg": 2.0, "umbral_minimo": 0.5, "fecha_ingreso": datetime.now(), "dias_caducidad": 7},
            {"insumo": "pina", "cantidad_kg": 1.5, "umbral_minimo": 0.3, "fecha_ingreso": datetime.now(), "dias_caducidad": 6}
        ])
    
    if col_recipes.count_documents({}) == 0 and not is_production:
        col_recipes.insert_many([
            {"id_receta": "r1", "nombre": "Hamburguesa Especial", "ingredientes": {"carne": 0.2, "pan": 0.05, "queso": 0.03}},
            {"id_receta": "r2", "nombre": "Ensalada César", "ingredientes": {"lechuga": 0.15, "pollo": 0.1, "aderezo": 0.05}},
            {"id_receta": "r3", "nombre": "Tacos al Pastor", "ingredientes": {"cerdo": 0.25, "tortilla": 0.1, "pina": 0.05}}
        ])
    
    if col_users.count_documents({}) == 0:
        # En producción deberías cambiar la contraseña del admin tan pronto inicies
        register_user("admin", os.environ.get("ADMIN_DEFAULT_PASSWORD", "admin"), "chef")
        register_user("cook", "cook", "cocinero")

def get_all_inventory():
    return list(col_inventory.find({}, {"_id": 0}))

def get_current_temperature():
    last_log = col_temperature.find_one(sort=[("timestamp", pymongo.DESCENDING)])
    if last_log:
        return last_log.get("temperatura", 0.0)
    return 0.0

def update_inventory_weight(insumo, peso_kg):
    # En un sistema real, un sensor físico está ligado a un insumo.
    # Aquí actualizamos el peso directamente.
    col_inventory.update_one({"insumo": insumo}, {"$set": {"cantidad_kg": peso_kg}})
    
    # Revisar si se debe generar pedido
    item = col_inventory.find_one({"insumo": insumo})
    if item and item["cantidad_kg"] < item["umbral_minimo"]:
        # Generar pedido automático si no existe uno pendiente
        if col_orders.count_documents({"insumo": insumo, "estado": "pendiente"}) == 0:
            col_orders.insert_one({
                "insumo": insumo,
                "cantidad_solicitada": item["umbral_minimo"] * 3, # Pedir 3 veces el mínimo
                "estado": "pendiente",
                "fecha_pedido": datetime.now()
            })

def log_temperature(device_id, temp):
    col_temperature.insert_one({
        "device_id": device_id,
        "temperatura": temp,
        "timestamp": datetime.now()
    })

def deduct_inventory_for_recipe(recipe_id):
    recipe = col_recipes.find_one({"id_receta": recipe_id})
    if recipe:
        for ing, req_qty in recipe["ingredientes"].items():
            col_inventory.update_one(
                {"insumo": ing},
                {"$inc": {"cantidad_kg": -req_qty}}
            )

def record_production(cocinero_id, recipe_id):
    recipe = col_recipes.find_one({"id_receta": recipe_id})
    nombre_receta = recipe["nombre"] if recipe else "Desconocida"
    col_production.insert_one({
        "cocinero_id": cocinero_id,
        "id_receta": recipe_id,
        "nombre_receta": nombre_receta,
        "timestamp": datetime.now()
    })

# --- Active Tasks ---
def add_active_task(cocinero_id, recipe_id, nombre_receta):
    # Si el cocinero ya tenía una tarea, la actualizamos/borramos
    col_active_tasks.update_one(
        {"cocinero_id": cocinero_id},
        {"$set": {
            "id_receta": recipe_id,
            "nombre_receta": nombre_receta,
            "timestamp": datetime.now()
        }},
        upsert=True
    )

def remove_active_task(cocinero_id):
    col_active_tasks.delete_one({"cocinero_id": cocinero_id})

def get_active_tasks():
    return list(col_active_tasks.find({}, {"_id": 0}))

# --- Autenticación ---
import passlib.context

pwd_context = passlib.context.CryptContext(schemes=["bcrypt"], deprecated="auto")

def register_user(username, password, role):
    if col_users.find_one({"username": username}):
        return False
    hashed_password = pwd_context.hash(password)
    col_users.insert_one({
        "username": username,
        "password": hashed_password,
        "role": role,
        "created_at": datetime.now()
    })
    return True

def authenticate_user(username, password):
    user = col_users.find_one({"username": username})
    if user and pwd_context.verify(password, user["password"]):
        return {"username": user["username"], "role": user["role"]}
    return None
