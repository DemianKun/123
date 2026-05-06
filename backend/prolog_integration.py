from pyswip import Prolog
from database import get_all_inventory

# Inicializar Prolog globalmente
prolog = Prolog()
# Cargar el archivo de reglas lógicas
# IMPORTANTE: Ejecutar el servidor desde la carpeta 'backend'
prolog.consult("logic.pl")

def update_prolog_inventory():
    """
    Sincroniza el inventario actual de la base de datos con los hechos en Prolog.
    Esto permite a Prolog razonar sobre el estado real al instante.
    """
    # Eliminar todos los hechos anteriores
    list(prolog.query("retractall(stock_actual(_, _))"))
    list(prolog.query("retractall(caducidad(_, _))"))
    
    # Obtener inventario actual de MongoDB
    inventory = get_all_inventory()
    
    # Insertar los nuevos hechos en Prolog
    for item in inventory:
        insumo = item["insumo"]
        cantidad = item["cantidad_kg"]
        dias = item.get("dias_caducidad", 999)
        # Convertir a minúsculas y reemplazar espacios para cumplir formato Prolog
        insumo_prolog = str(insumo).lower().replace(" ", "_")
        prolog.assertz(f"stock_actual({insumo_prolog}, {cantidad})")
        prolog.assertz(f"caducidad({insumo_prolog}, {dias})")

def get_available_recipes() -> list:
    """
    Consulta a Prolog para obtener la lista de recetas que se pueden preparar
    en base al inventario actual.
    """
    update_prolog_inventory()
    
    # Consultar la regla recetas_prioritarias(Recetas)
    result = list(prolog.query("recetas_prioritarias(Recetas)"))
    
    if result and len(result) > 0:
        # El resultado es un diccionario donde 'Recetas' es una lista de IDs ordenados
        recetas_raw = result[0].get("Recetas", [])
        # Convertir los átomos de Prolog a strings de Python
        recetas_limpias = [str(r) for r in recetas_raw]
        return recetas_limpias
    return []
