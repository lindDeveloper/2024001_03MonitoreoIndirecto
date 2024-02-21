from fastapi import FastAPI, HTTPException, UploadFile
from pymongo import MongoClient
import gridfs
from pymongo.server_api import ServerApi
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, List
from shapely.geometry import shape, Point, Polygon
from geopy.distance import geodesic
import geopandas as gpd
import csv
import json
import io
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime


class Geometry(BaseModel):
    type: str
    coordinates: List[Any]

class Feature(BaseModel):
    type: str
    geometry: Geometry
    properties: dict

class GeoJSON(BaseModel):
    type: str
    features: List[Feature]
    properties: dict

def haversine(punto1, punto2):
    #Separar las coordenadas de los puntos y mapearlas en radianes
    lat1 = punto1[1]
    lon1 = punto1[0]
    lat2 = punto2[1]
    lon2 = punto2[0]
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    #Calcular la diferencia de longitud y latitud
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    #Aplicar la formula de haversine
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    #Calcular la distancia con la ayuda de el radio en metros de la tierra
    r = 6371000
    distancia = r * c
    return distancia



app = FastAPI()
client = MongoClient("mongodb://192.168.1.125:27017/", server_api=ServerApi('1'))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite solicitudes de todos los orígenes
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos los métodos
    allow_headers=["*"],  # Permite todos los headers
)

try:
    client.admin.command('ping')
    print("pong: MongoDB connection: Success")
except Exception as ex:
    print('MongoDB connection: failed', ex)


#ac es la coleccion de los activos persistentes, fs es la coleccion de los geojson en gridfs
db = client['test']
jc = db['geojson']
ac = db['activos']
fs = gridfs.GridFS(db)
pasadas_fs = gridfs.GridFS(db, collection='pasadas')

@app.get("/")
def index():
    return {"message": "Hello World"}   


#Rutas para GeoJSON
@app.post("/api/v1/geojsonUpload")
async def upload_geojson(file: UploadFile):
    try:
        content = await file.read()
        content = content.decode('utf-8').split('\r\n')
        csv_file = [row.split(',') for row in content]
        csv_file.remove([''])
        csv_file.pop(0)
        
        geojson = {"type": "FeatureCollection", "features": [], "properties": {"name": file.filename}}
        for row in csv_file:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row[-1]), float(row[-2])]
                },
                "properties": {
                    "timestamp": row[0],
                    "x1": float(row[1]),
                    "y1": float(row[2]),
                    "z1": float(row[3]),
                    "x2": float(row[4]),
                    "y2": float(row[5]),
                    "z2": float(row[6]),
                    "x3": float(row[7]),
                    "y3": float(row[8]),
                    "z3": float(row[9]),
                    "x4": float(row[10]),
                    "y4": float(row[11]),
                    "z4": float(row[12])
                }
            }
            geojson['features'].append(feature)
        json_geojson = json.dumps(geojson)
        result = fs.put(json_geojson.encode('utf-8'), filename=file.filename)
        return {'message': 'GeoJSON uploaded successfully', '_id': str(result), 'filename': file.filename}
    except Exception as ex:
        return {'message': 'Error uploading GeoJSON', 'error': str(ex)}


@app.get("/api/v1/geojsonAll")
def get_geojson():
    geojson_files = fs.find()
    result = []
    for file in geojson_files:
        data = { "_id": str(file._id), "filename": file.filename}
        result.append(data)
    return result

@app.get("/api/v1/geojson/{id}")
def get_geojson_by_id(id):
    file = fs.get(ObjectId(id))
    geojson = json.loads(file.read().decode('utf-8'))
    geojson['_id'] = str(file._id)
    return geojson

@app.get("/api/v1/geojson/{id}/process")
def process_geojson(id):
    try:
        file = fs.get(ObjectId(id))
        activos = ac.find()
        lista_activos = []
        activo_polygons = []
        for activo in activos:
            lista_activos.append(activo)
            activo_polygons.append(shape(activo['features'][0]['geometry']))
        geojson = json.loads(file.read().decode('utf-8'))
        geojson['_id'] = str(file._id)
        pasadas = []
        i = 0
        it = 0
        results = []
        for activo_polygon in activo_polygons:
            inicio = lista_activos[i]['features'][1]['geometry']['coordinates'][0]
            inicio = Point(inicio)
            inicio = (inicio.x, inicio.y)
            segmento_polygons = []
            for j in range(len(lista_activos[i]['features']) - 2):
                segmento_polygons.append(shape(lista_activos[i]['features'][j + 2]['geometry']))
            print(segmento_polygons)
            pasada = {"type": "FeatureCollection",
                    "features": [],
                    "properties": {"act_id": str(lista_activos[i]['_id']),
                                 "act_nombre": lista_activos[i]['features'][0]['properties']['nombre'],
                                 "medicion_id": id,
                                 "medicion_nombre": geojson['properties']['name']}}
            for feature in geojson['features']:
                feature_geometry = shape(feature['geometry'])
                if activo_polygon.contains(feature_geometry):
                    feature_coords = (feature_geometry.x, feature_geometry.y)
                    distancia = haversine(inicio, feature_coords)
                    #print(distancia)
                    feature['properties']['distancia_inicio'] = distancia
                    if len(segmento_polygons) > 0:
                        for segmento_polygon in segmento_polygons:
                            if segmento_polygon.contains(feature_geometry):
                                feature['properties']['segmento'] = segmento_polygons.index(segmento_polygon) + 1
                    if(len(pasada['features']) > 0):
                        datetime1 = datetime.strptime(pasada['features'][len(pasada['features'])-1]['properties']['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                        datetime2 = datetime.strptime(feature['properties']['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                        print((datetime2 - datetime1).seconds)
                        if(datetime2 - datetime1).seconds > 60:
                            pasadas.append(pasada)
                            result = pasadas_fs.put(json.dumps(pasada).encode('utf-8'), filename= lista_activos[i]['features'][0]['properties']['nombre'] + '_' + geojson['properties']['name']+ '_' + str(it))
                            results.append({'act_id': str(lista_activos[i]['_id']), 'pasada_id': str(result)})
                            pasada = {"type": "FeatureCollection",
                                    "features": [],
                                    "properties": {"act_id": str(lista_activos[i]['_id']),
                                                "act_nombre": lista_activos[i]['features'][0]['properties']['nombre'],
                                                "medicion_id": id,
                                                "medicion_nombre": geojson['properties']['name']}}
                    
                    pasada['features'].append(feature)
                    geojson['features'].remove(feature)
                it +=1
            pasadas.append(pasada)
            result = pasadas_fs.put(json.dumps(pasada).encode('utf-8'), filename= lista_activos[i]['features'][0]['properties']['nombre'] + '_' + geojson['properties']['name'])
            results.append({'act_id': str(lista_activos[i]['_id']), 'pasada_id': str(result), 'filename': lista_activos[i]['features'][0]['properties']['nombre'] + '_' + geojson['properties']['name']})
            i += 1
        #print(results)
        print(it)
        return results
    except Exception as ex:
        return {'message': 'Error procesando pasadas', 'error': str(ex)}

@app.delete("/api/v1/geojson")
def delete_geojson():
    files = fs.find()
    for file in files:
        fs.delete(file._id)
    return {'message': 'All GeoJSON deleted successfully'}


#Rutas para activos
@app.post("/api/v1/activos")
def create_activo(activo: GeoJSON):
    result = ac.insert_one(activo.dict())
    return {'message': 'Activo created successfully', '_id': str(result.inserted_id)}

@app.put("/api/v1/activos/{id}")
def update_activo(id, activo: GeoJSON):
    result = ac.update_one({'_id': ObjectId(id)}, {'$set': activo.dict()})
    pasadas = pasadas_fs.find()
    activo = ac.find_one({'_id': ObjectId(id)})
    activo_shape = shape(activo['features'][0]['geometry'])
    segmentos =[]
    for i in range(len(activo['features']) - 2):
        segmentos.append(shape(activo['features'][i + 2]['geometry']))
    pasadas_actualizadas = []
    pasada_id = []
    for pasada in pasadas:
        pasada_ref = json.loads(pasada.read().decode('utf-8'))
        if pasada_ref['properties']['act_id'] == id:
            for feature in pasada_ref['features']:
                feature_geometry = shape(feature['geometry'])
                if activo_shape.contains(feature_geometry):
                    if len(segmentos) > 0:
                        for segmento in segmentos:
                            if segmento.contains(feature_geometry):
                                feature['properties']['segmento'] = segmentos.index(segmento) + 1
            pasadas_actualizadas.append(pasada_ref)
            pasada_id.append(pasada._id)
    i = 0
    for pasada in pasadas_actualizadas:
        result_elim = pasadas_fs.delete(pasada_id[i])
        i += 1
        print(result_elim)
        pasadas_fs.put(json.dumps(pasada).encode('utf-8'), filename= activo['features'][0]['properties']['nombre'] + '_' + pasada['properties']['medicion_nombre'])
    if result.modified_count > 0:
        return {'message': 'Activo updated successfully ','result': result.modified_count}
    else:
        return {'message': 'Activo not found', 'result': result.modified_count}

@app.get("/api/v1/activos")
def get_activos():
    activos = ac.find()
    result = []
    for activo in activos:
        activo['_id'] = str(activo['_id'])
        result.append(activo)
    return result

@app.delete("/api/v1/activos")
def delete_activos():
    ac.delete_many({})
    return {'message': 'All activos deleted successfully'}

#Rutas para pasadas
@app.get("/api/v1/pasadas")
def get_pasadas():
    try:
        pasadas = pasadas_fs.find()
        result = []
        for pasada in pasadas:
            unidad = { "_id": str(pasada._id), "filename": pasada.filename}
            result.append(unidad)
        return result
    except Exception as ex:
        return {'message': 'Error obteniendo pasadas', 'error': str(ex)}

@app.get("/api/v1/pasadas/{id}")
def get_pasada_by_id(id):
    try:
        file = pasadas_fs.get(ObjectId(id))
        pasada = json.loads(file.read().decode('utf-8'))
        pasada['_id'] = str(file._id)
        return pasada
    except Exception as ex:
        return {'message': 'Error obteniendo pasada', 'error': str(ex)}
    
@app.put("/api/v1/pasadas/{id}")
def update_pasada(id, pasada: GeoJSON):
    try:
        pasada = pasada.dict()
        filename_aux = pasada['properties']['act_nombre'] + '_' + pasada['properties']['medicion_nombre']
        result1 = pasadas_fs.delete(ObjectId(id))
        result2 = pasadas_fs.put(json.dumps(pasada).encode('utf-8'), filename= filename_aux)
        return {'message': 'Pasada actualizada correctamente', '_id': str(result2)}
    except Exception as ex:
        return {'message': 'Error actualizando pasada', 'error': str(ex)}


@app.delete("/api/v1/pasadas")
def delete_pasadas():
    try:
        files = pasadas_fs.find()
        for file in files:
            pasadas_fs.delete(file._id)
        return {'message': 'Todas las pasadas se han eliminado correctamente'}
    except Exception as ex:
        return {'message': 'Error eliminando pasadas', 'error': str(ex)}