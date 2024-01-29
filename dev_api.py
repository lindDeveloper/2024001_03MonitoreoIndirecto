from fastapi import FastAPI, HTTPException, UploadFile
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, List
import json;


class Geometry(BaseModel):
    type: str
    coordinates: List[Any]

class Feature(BaseModel):
    type: str
    geometry: Geometry
    properties: dict

class ActivoJSON(BaseModel):
    type: str
    features: List[Feature]
    properties: dict

app = FastAPI()
uri = "mongodb+srv://JuanBinimelis:Nc4vne0S3lh3MclB@cluster0.57yyqjd.mongodb.net/?retryWrites=true&w=majority"
client = MongoClient(uri, server_api=ServerApi('1'))
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

db = client['test']
jc = db['geojson']
ac = db['activos']

@app.get("/")
def index():
    return {"message": "Hello World"}   

@app.get("/api/v1/geojsonAll")
def get_geojson():
    geojson = jc.find()
    result = []
    for geo in geojson:
        geo['_id'] = str(geo['_id'])
        result.append(geo['_id'])
    return result

@app.get("/api/v1/geojson/{id}")
def get_geojson_by_id(id):
    geojson = jc.find_one({'_id': ObjectId(id)})
    geojson['_id'] = str(geojson['_id'])
    return geojson['geojson']

@app.delete("/api/v1/geojson")
def delete_geojson():
    jc.delete_many({})
    return {'message': 'All GeoJSON deleted successfully'}

@app.post("/api/v1/activos")
def create_activo(activo: ActivoJSON):
    result = ac.insert_one(activo.dict())
    return {'message': 'Activo created successfully', '_id': str(result.inserted_id)}

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