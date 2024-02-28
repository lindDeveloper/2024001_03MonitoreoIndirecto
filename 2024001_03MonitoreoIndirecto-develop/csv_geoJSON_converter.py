import csv
from os import system
from geojson import Point, Feature
import time
import json

system("cls")
#Actualizar directorio de entrada y salida
file_path = f"C:/Users/Ralsei/Desktop/tabla_reducida.csv"
acelerometros = int(input("Ingrese la cantidad de acelerometros: "))
nombre = input("Ingrese el nombre del archivo: ")
output_file = f"C:/Users/Ralsei/Desktop/{nombre}.geojson"

timestamp = time.strftime("%Y/%m/%d-%H:%M:%S")
print("Inicio procesamiento: ",timestamp)

def create_feature(row, acelerometros):
    end = len(row) - 1
    lat_lng = [float(row[end - 1]), float(row[end])]
    punto = Point(lat_lng)
    if acelerometros == 1:
        properties = {
            "timestamp": row[0], 
            "x1": float(row[1]), 
            "y1": float(row[2]), 
            "z1": float(row[3])
            # Agrega más propiedades según sea necesario
        }
    elif acelerometros == 4:
        properties = {
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
            # Agrega más propiedades según sea necesario
        }
    return Feature(geometry=punto, properties=properties)

start_time = time.time()
with open(file_path, "r") as csv_file, open(output_file, "w") as geojson_file:
    csv_reader = csv.reader(csv_file)
    next(csv_reader)  # Saltar el encabezado

    # Inicio del objeto GeoJSON
    geojson_file.write('{"type": "FeatureCollection", "features": [')

    first = True
    for row in csv_reader:
        if not first:
            geojson_file.write(',')
        else:
            first = False

        # Procesar cada fila y escribir en el archivo GeoJSON
        feature = create_feature(row, acelerometros)
        json.dump(feature, geojson_file)

    # Cierre del objeto GeoJSON
    geojson_file.write('], "properties": {"name": "'+nombre+'"}}')

finish_time = time.time()
timestamp = time.strftime("%Y/%m/%d-%H:%M:%S")
print("Procesamiento completado: ", timestamp)
print("Tiempo de ejecución: ", (finish_time - start_time))