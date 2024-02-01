from fastapi import FastAPI, HTTPException, UploadFile
from pymongo import MongoClient
import gridfs
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

class GeoJSON(BaseModel):
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


#ac es la coleccion de los activos persistentes, fs es la coleccion de los geojson en gridfs
db = client['test']
jc = db['geojson']
ac = db['activos']
fs = gridfs.GridFS(db)

@app.get("/")
def index():
    return {"message": "Hello World"}   


#Rutas para GeoJSON
@app.post("/api/v1/geojsonUpload")
async def upload_geojson(file: UploadFile):
    try:
        content = await file.read()
        geojson_data = json.loads(content)
        result = fs.put(json.dumps(geojson_data).encode('utf-8'), filename=file.filename)
        return {'message': 'GeoJSON uploaded successfully', '_id': str(result)}
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