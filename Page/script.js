let map = L.map('map').setView([-36.837257189962260,-73.088282006863680], 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


let conjunto = [];
let poly_segmentos = [];
let activos = [];
let lineas = [];
const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple',];
let area = 15;

let polygonMode = false;
let linea = null;
let nombre_poli = null;
let descripcion_poli = null;
let nombreLabel = null;
let descripcionLabel = null;


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
            linea.feature = {};
            linea.feature.properties = {};
            linea.feature.properties.delta = 0;
            poly_din.feature = {};
            poly_din.feature.properties = {};
            poly_din.feature.properties.color = poly_din.options.color;
            if(nombre_poli.value.trim() !== ""){
                poly_din.feature.properties.nombre = nombre_poli.value;
                poly_din.feature.properties.descripcion = descripcion_poli.value;
                poly_din.bindPopup("<b>"+poly_din.feature.properties.nombre+"</b><br>"+"Ingrese un valor en metros para segmentar esta zona"+"<br><input type='text' id='deltaInput'>");
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

            let features_poli = L.geoJSON();
            features_poli.addLayer(poly_din);
            features_poli.addLayer(linea);
            conjunto.push(features_poli.toGeoJSON());

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
        let delta_aux = polygon.features[0].geometry.properties.delta;
        if(delta_aux > 0 && polygon.features[0].geometry.geometry.type === 'LineString'){
            let segmentos = turf.lineChunk(polygon.features[0].geometry.geometry, delta_aux, {units: 'meters'});
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
    if (activos.includes(e.popup._source)) {
        let delta = document.getElementById('deltaInput').value;
        if (delta === "" || isNaN(delta) || !Number.isInteger(Number(delta))) {
            console.log("aweonao");
        } else {
            let activePolygon = null;
            conjunto.forEach(polygon => {
                //Se busca el poligono correspondiente al popup cerrado en base al nombre de este
                if (polygon.features[1].geometry.properties.nombre === e.popup._source.feature.properties.nombre) {
                    activePolygon = polygon;
                    //console.log("Encontrado: " + activePolygon.features[1].geometry.properties.nombre);
                    activePolygon.features[0].geometry.properties.delta = parseInt(delta);
                    //console.log("Nuevo delta: " + activePolygon.features[0].geometry.properties.delta);
                }
            });
            segmentLines();
        }
    }
});

document.getElementById('togglePolygonMode').addEventListener('click', togglePolygonMode);

