
let map = L.map('map').setView([-36.837257189962260,-73.088282006863680], 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


let conjunto = [];
let mediciones = [];
let recorridos = [];
let poly_segmentos = [];
let activos = [];
let lineas = [];
const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple',];
const user = 'admin';
let area = 15;

let polygonMode = false;
let linea = null;
let nombre_poli = null;
let descripcion_poli = null;
let nombreLabel = null;
let descripcionLabel = null;

fetch('http://127.0.0.1:8000/api/v1/activos', {method: 'GET'})
.then(response => response.json())
.then(data => {
    data.forEach(activos => {
        console.log(activos);
        conjunto.push(activos);
        let poly_din = L.geoJSON(activos.features[0], {color: activos.features[0].properties.color}).addTo(map);
        poly_din.bindPopup("<b>"+activos.features[0].properties.nombre+"</b><br>"+"Ingrese un valor en metros para segmentar esta zona"+"<br><input type='text' id='deltaInput'>");
    });
});


/*
    Tanto este fetch como la funcion addMeasurementOptions se encargan de llenar
    el selector de archivos de mediciones con los archivos disponibles en la base de datos
*/
fetch("http://127.0.0.1:8000/api/v1/geojsonAll", {method: 'GET'})
.then(response => response.json())
.then(data => {
    data.forEach(opcion => {
        console.log(opcion);
        addMeasurementOptions(opcion._id, opcion.filename);
    })
});

function addMeasurementOptions(id, name) {
    const selector = document.getElementById('measurementSelector');    
    const optionElement = document.createElement('option');
    optionElement.value = id;
    optionElement.textContent = name;
    selector.appendChild(optionElement);
}


/* 
    Funcion que maneja un modo de creacion de poligonos,
    que permite crear poligonos los cuales representan una zona de interés a partir de una linea
*/
function togglePolygonMode() {
    polygonMode = !polygonMode;
    
    if (polygonMode) {

        // Habilitar el modo de creación de polígonos
        map.on('click', createPolygon);
        createTextField();
    } else {
        // Deshabilitar el modo de creación de polígonos
        map.off('click', createPolygon);

        // Si hay una línea dibujada, crear el polígono
        if (linea) {

            //Se toman los puntos de la linea y se crea un poligono rodeando esta, con un radio de 25 metros
            let latlngs = linea.getLatLngs().map(coord => [coord.lat, coord.lng]);
            let puntos = turf.lineString(latlngs);
            let poligono = turf.buffer(puntos, 25, {units: 'meters'});
            let coordenadas = poligono.geometry.coordinates[0].map(coord => [coord[0], coord[1]]);
            randomColor = colors[Math.floor(Math.random() * colors.length)];
            let poly_din = L.polygon(coordenadas, {color: randomColor}).addTo(map);

            //Se inicializan La propiedades de los componentes de la zona de interes
            linea.properties = {};
            linea.properties.delta = 0;
            poly_din.properties = {};
            poly_din.properties.color = poly_din.options.color;
            if(nombre_poli.value.trim() !== "" || nombre_poli.value.trim() !== null){
                poly_din.properties.nombre = nombre_poli.value;
                poly_din.properties.descripcion = descripcion_poli.value;
                poly_din.bindPopup("<b>"+poly_din.properties.nombre+"</b><br>"+"Ingrese un valor en metros para segmentar esta zona"+"<br><input type='text' id='deltaInput'>");
            }else{
                //Si no se ingresa un nombre, la zona se considera como no valida y se eliminan los componentes creados
                map.removeLayer(poly_din);
                map.removeLayer(linea);
                linea = null;
                removeTextField();
                return;
            }
            
            // Se almacenan tanto los componentes por separado como el conjunto de estos
            activos.push(poly_din);
            lineas.push(linea);
            let poly_din_geojson = {
                type: "Feature",
                geometry: poly_din.toGeoJSON().geometry,
                properties: poly_din.properties
            };
            let linea_geojson = {
                type: "Feature",
                geometry: linea.toGeoJSON().geometry,
                properties: linea.properties
            };

            let features_poli = {
                type: "FeatureCollection",
                features: [poly_din_geojson, linea_geojson],
                properties: {
                    user: user
                }
            };
            
            fetch('http://127.0.0.1:8000/api/v1/activos', {
                method: 'POST',
                body: JSON.stringify(features_poli),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log(data);
                features_poli._id = data._id;
                conjunto.push(features_poli);
            });

            map.removeLayer(linea);
            linea = null;
        }
        removeTextField();
    }
}

/* 
    Funcion para crear los textfields y labels correspondientes a nombre y descripcion de zona de interés
*/
function createTextField() {
    let container = document.getElementById('textfield_container');
    nombreLabel = document.createElement('label');
    descripcionLabel = document.createElement('label');
    nombreLabel.textContent = 'Nombre';
    descripcionLabel.textContent = 'Descripcion';  
    container.appendChild(nombreLabel);
    nombre_poli = document.createElement('input');
    nombre_poli.type = 'text';
    nombre_poli.classList.add('textfield');
    container.appendChild(nombre_poli);
    descripcion_poli = document.createElement('input');
    descripcion_poli.type = 'text';
    descripcion_poli.classList.add('textfield');
    container.appendChild(descripcionLabel);
    container.appendChild(descripcion_poli);
}

/* 
    Funcion para remover los textfields y labels correspondientes a nombre y descripcion de zona de interés
*/
function removeTextField() {
    if (nombre_poli) {
        nombre_poli.remove();
        nombre_poli = null;
        nombreLabel.remove();
        nombreLabel = null;
    }
    if (descripcion_poli) {
        descripcion_poli.remove();
        descripcion_poli = null;
        descripcionLabel.remove();
        descripcionLabel = null;
    }
}

/* 
    Funcion que maneja la creacion de linea que representa la zona de interés
    antes de marcarla como poligono
*/
function createPolygon(e) {
    if (!linea) {
        linea = L.polyline([e.latlng], { color: 'black' }).addTo(map);
    } else {
        linea.addLatLng(e.latlng);
    }
}

/*
    Funcion que segmenta las lineas de las zonas de interes en base al valor delta ingresado
*/
function segmentLines(){
    poly_segmentos.forEach(poly => {
        map.removeLayer(poly);
    });
    poly_segmentos = [];
    conjunto.forEach(polygon => {
        let delta_aux = polygon.features[1].properties.delta;
        if(delta_aux > 0 && polygon.features[1].geometry.type === 'LineString'){
            let segmentos = turf.lineChunk(polygon.features[1].geometry, delta_aux, {units: 'meters'});
            let lineas_segmentadas = [];
            let i = 0;
            segmentos.features.forEach(segmento => {
                
                let coords = turf.getCoords(segmento);
                let end = coords[coords.length-1];
                let bearing = turf.bearing(coords[0], end);
                let point1 = turf.rhumbDestination(end, area, bearing + 90, {units: 'meters'});
                let point2 = turf.rhumbDestination(end, area, bearing - 90, {units: 'meters'});
                if(i === 0){   
                    bearing = turf.bearing(end, coords[0]);
                    let point3 = turf.rhumbDestination(coords[0], area, bearing - 90, {units: 'meters'});
                    let point4 = turf.rhumbDestination(coords[0], area, bearing + 90, {units: 'meters'});
                    let linea_segmento = turf.lineString([point3.geometry.coordinates, point4.geometry.coordinates]);
                    lineas_segmentadas.push(linea_segmento);
                    
                }
                let linea_segmento = turf.lineString([point1.geometry.coordinates, point2.geometry.coordinates]);
                lineas_segmentadas.push(linea_segmento);
                    
                
                /*let randomColor = 'white';
                if (i%2 === 0) randomColor = 'black';
                L.geoJSON(segmento, {
                    style: {
                        color: randomColor,
                        weight: 2
                    }
                }).addTo(map);*/
                i++;
            });
            for(i = 0; i < lineas_segmentadas.length - 1; i++){
                let randomColor = 'white';
                if (i%2 === 0) randomColor = 'black';
                let poly_segmento = L.polygon(
                    [[lineas_segmentadas[i].geometry.coordinates[1][1], lineas_segmentadas[i].geometry.coordinates[1][0]],
                     [lineas_segmentadas[i].geometry.coordinates[0][1], lineas_segmentadas[i].geometry.coordinates[0][0]],
                     [lineas_segmentadas[i+1].geometry.coordinates[0][1], lineas_segmentadas[i+1].geometry.coordinates[0][0]],
                     [lineas_segmentadas[i+1].geometry.coordinates[1][1], lineas_segmentadas[i+1].geometry.coordinates[1][0]]],
                    {color: randomColor}).addTo(map);
                poly_segmentos.push(poly_segmento);
            }
        }
    });
}

/*
    Funcion que toma valor delta ingresado en popup y lo asigna a la zona de interes correspondiente
*/
map.on('popupclose', function(e) {
    console.log(e.popup._source);
    let delta = document.getElementById('deltaInput').value;
    if (delta === "" || isNaN(delta) || !Number.isInteger(Number(delta))) {
        console.log("Ingresa un numero entero valido");
    } else {
        let activePolygon = null;
        conjunto.forEach(polygon => {
            //Se busca el poligono correspondiente al popup cerrado en base al nombre de este, tomando en cuenta
            //que el popup puede venir de un poligono directo o un geoJSON
            if(e.popup._source.feature !== undefined){
                if (polygon.features[0].properties.nombre === e.popup._source.feature.properties.nombre) {
                    activePolygon = polygon;
                    //console.log("Encontrado: " + activePolygon.features[1].geometry.properties.nombre);
                    activePolygon.features[1].properties.delta = parseInt(delta);
                    //console.log("Nuevo delta: " + activePolygon.features[0].geometry.properties.delta);
                }
            }else{
                if (polygon.features[0].properties.nombre === e.popup._source.properties.nombre) {
                    activePolygon = polygon;
                    //console.log("Encontrado: " + activePolygon.features[1].geometry.properties.nombre);
                    activePolygon.features[1].properties.delta = parseInt(delta);
                    //console.log("Nuevo delta: " + activePolygon.features[0].geometry.properties.delta);
                } 
            };
        });
        segmentLines();
    }


    
});

document.getElementById('togglePolygonMode').addEventListener('click', togglePolygonMode);
document.getElementById('measurementSelector').addEventListener('change', function(e) {
    const id = e.target.value;
    fetch('http://127.0.0.1:8000/api/v1/geojson/'+id, {method: 'GET'})
    .then(response => response.json())
    .then(data => {
        console.log(data);
        mediciones.push(data);
        console.log("Empezando a crear recorrido");
        let latlngs = [];
        let start_time = performance.now();
        data.features.forEach(medicion => {
            let latlng = [medicion.geometry.coordinates[0], medicion.geometry.coordinates[1]];
            latlngs.push(latlng);
        });
        let finish_time = performance.now();
        
        let recorrido = L.polyline(latlngs, {color: 'red', weight: 3}).addTo(map);
        recorridos.push(recorrido);

        const execution_time = finish_time - start_time;
        console.log(`Tiempo de ejecucion: ${execution_time} milisegundos`);
    });
});