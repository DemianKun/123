import requests
import time
import random

# URL del backend (FastAPI)
URL = "http://127.0.0.1:8000/api/iot/data"

# Inventario inicial simulado (para la simulación de caída gradual de peso)
inventario_simulado = {
    "b_carne": 5.0,
    "b_pan": 2.0,
    "b_queso": 1.0,
    "b_lechuga": 2.0,
    "b_pollo": 3.0,
    "b_aderezo": 1.0,
    "b_cerdo": 4.0,
    "b_tortilla": 2.0,
    "b_pina": 1.5
}

# Temperatura inicial simulada (Cámara Fría)
temperatura = 4.0

def simular():
    print("Iniciando simulación de sensores IoT...")
    while True:
        try:
            # 1. Simular fluctuación de temperatura (leve alza y estabilización)
            # Simula que la cámara se abre ocasionalmente si la temperatura sube
            variacion_temp = random.uniform(-0.5, 0.8)
            global temperatura
            temperatura += variacion_temp
            
            # Mantenerla dentro de un rango realista (2.0 a 8.0)
            if temperatura < 2.0: temperatura = 2.0
            if temperatura > 8.0: temperatura = 8.0
            
            # 2. Elegir un insumo al azar y simular consumo (disminución de peso)
            insumo_afectado = random.choice(list(inventario_simulado.keys()))
            consumo = random.uniform(0.05, 0.2) # consume entre 50g y 200g
            inventario_simulado[insumo_afectado] -= consumo
            
            if inventario_simulado[insumo_afectado] < 0:
                inventario_simulado[insumo_afectado] = 0.0

            # 3. Enviar los datos al backend (se enviarán datos de TODOS los sensores)
            for device_id, peso in inventario_simulado.items():
                payload = {
                    "device_id": device_id,
                    "temperatura": round(temperatura, 2),
                    "peso_kg": round(peso, 2)
                }
                
                response = requests.post(URL, json=payload)
                print(f"Enviado {device_id}: Temp {round(temperatura,2)}°C, Peso {round(peso,2)}kg -> Status: {response.status_code}")
            
            print("-" * 40)
            
            # Esperar 5 segundos antes del siguiente ciclo
            time.sleep(5)
            
        except requests.exceptions.ConnectionError:
            print("Error: No se pudo conectar al backend. Asegúrate de que FastAPI (uvicorn main:app) esté en ejecución.")
            time.sleep(5)
        except Exception as e:
            print(f"Error inesperado: {e}")
            time.sleep(5)

if __name__ == "__main__":
    simular()
