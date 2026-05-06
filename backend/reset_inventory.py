import pymongo
client = pymongo.MongoClient('mongodb://localhost:27017/')
db = client['iot_kitchen_db']
db.inventory.update_many({}, {'$set': {'cantidad_kg': 0.0, 'dias_caducidad': 0}})
print('Inventario reseteado a 0kg correctamente')
