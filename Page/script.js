
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
let data_pasadas = []; 
const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple',];
const user = 'admin';
const uri = 'http://192.168.1.125:8000/'
let area = 15;

let polygonMode = false;
let linea = null;
let nombre_poli = null;
let descripcion_poli = null;
let nombreLabel = null;
let descripcionLabel = null;

fetch(uri+"api/v1/activos", {method: 'GET'})
.then(response => response.json())
.then(data => {
    data.forEach(activos => {
        //console.log(activos);
        conjunto.push(activos);
        let poly_din = L.geoJSON(activos.features[0], {color: activos.features[0].properties.color}).addTo(map);
        poly_din.bindPopup("<b>"+activos.features[0].properties.nombre+"</b><br>"+"Ingrese un valor en metros para segmentar esta zona"+"<br><input type='text' id='deltaInput'>");
        activos.features.forEach(feature => {
            if(feature.properties.es_segmento){
                let poly_dyn = L.geoJSON(feature, {color: feature.properties.color}).addTo(map);
                poly_segmentos.push(poly_dyn);
            }
        });
    });
});


/*
    Tanto este fetch como la funcion addMeasurementOptions se encargan de llenar
    el selector de archivos de mediciones con los archivos disponibles en la base de datos
*/
fetch(uri+"api/v1/geojsonAll", {method: 'GET'})
.then(response => response.json())
.then(data => {
    data.forEach(opcion => {
        //console.log(opcion);
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

fetch(uri+"api/v1/pasadas", {method: 'GET'})
.then(response => response.json())
.then(data => {
    data.forEach(pasada => {
        addPasadaOptions(pasada._id, pasada.filename);
    });
});

function addPasadaOptions(id, name) {
    const selector = document.getElementById('pasadaSelector');    
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
            //activos.push(poly_din);
            //lineas.push(linea);
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
            
            fetch(uri+"api/v1/activos", {
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

function processMeasurement(){
    console.log('Procesando medicion');
    let valor = document.getElementById('measurementSelector').value;
    console.log(valor); 
    fetch(uri+"api/v1/geojson/"+valor+"/process", {method: 'GET'})
    .then(response => response.json())
    .then(data => {
        console.log(data);
        addPasadaOptions(data._id, data.filename);
    });
}

function RMScalc(id){
    let pasada = data_pasadas.find(pasada => pasada._id === id);
    let activo = conjunto.find(activo => activo._id === pasada.properties.act_id);
    let segmentos = activo.features.filter(feature => feature.properties.es_segmento);
    let data = [];
    let data_transpose = [];
    segmentos.forEach(segmento => {
        data.push([]);
    });
    pasada.features.forEach(medicion => {
        if(medicion.properties.segmento){
            let index = medicion.properties.segmento - 1;
            let feature_data = [];
            feature_data.push(medicion.properties.x1);
            feature_data.push(medicion.properties.x2);
            feature_data.push(medicion.properties.x3);
            feature_data.push(medicion.properties.x4);
            feature_data.push(medicion.properties.y1);
            feature_data.push(medicion.properties.y2);
            feature_data.push(medicion.properties.y3);
            feature_data.push(medicion.properties.y4);
            feature_data.push(medicion.properties.z1);
            feature_data.push(medicion.properties.z2);
            feature_data.push(medicion.properties.z3);
            feature_data.push(medicion.properties.z4);
            data[index].push(feature_data);
        }
    });
    console.log(data);
    data.forEach(segmento => {
        let segmento_transpose = transpose(segmento);
        data_transpose.push(segmento_transpose);
    });
    console.log(data_transpose);
    pasada.properties.RMS = [];
    data_transpose.forEach(segmento => {
        let rms = [];
        segmento.forEach(componente => {
            let sum = 0;
            componente.forEach(valor => {
                sum += valor*valor;
            });
            rms.push(Math.sqrt(sum/componente.length));
        });
        console.log(rms);
        pasada.properties.RMS.push(rms);
        
    });
    updateKPI(pasada);
}

function RMSpaint(pasada){
    
    let eje = document.getElementById('axisSelector').value;
    let accel = document.getElementById('deviceSelector').value;
    
    if(eje === "" || accel === ""){
        console.log("Selecciona un eje y un acelerometro");
        return;
    }
    let RMS = pasada.properties.RMS;
    let lim_inf = parseInt(eje)*4;
    let lim_sup = lim_inf;
    let eje_aux = "X";
    if(eje === "1"){
        eje_aux = "Y";
    }else if(eje === "2"){
        eje_aux = "Z";
    }
    if(accel === "4"){
        lim_sup += 4;
    }else{
        lim_inf += parseInt(accel);
        lim_sup = lim_inf+ 1;
    }
    console.log('lim_inf: '+lim_inf + ' lim_sup: '+lim_sup);

    let x_aux = [];
    for(let i = 1; i<=RMS.length; i++){
        x_aux.push(i);
    }
    let data = [];
    for(let i = lim_inf; i<lim_sup; i++){
        let aux = [];
        for(let j = 0; j<RMS.length; j++){
            aux.push(RMS[j][i]);
        }
        let accel_aux = i+1 - lim_inf;
        console.log(accel_aux);
        let trace = {
            x: x_aux,
            y: aux,
            type: 'scatter',
            mode: 'lines+markers',
            name: `${eje_aux} ${accel_aux}`
        };
        data.push(trace);
    
    }
    var layout = {
        title: 'RMS',
        width: 285,
        height: 280,
        margin: {
            l: 40,
            r: 1,
            b: 35,
            t: 25,
            pad: 2
        },
        xaxis: {
            title: 'Segmento'
            
        },
        yaxis: {
            title: 'RMS'
        }
    };
    Plotly.newPlot('graphPlot', data, layout);
    
}

function updateKPI(pasada){
    fetch(uri+"api/v1/pasadas/"+pasada._id, {
        method: 'PUT',
        body: JSON.stringify(pasada),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => response.json()).then(data => {
        console.log(data);
    });
}

function transpose(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

/*
    Funcion que segmenta las lineas de las zonas de interes en base al valor delta ingresado
*/
function segmentLines(id){
    let activePolygon = conjunto.find(polygon => polygon._id === id);
    poly_segmentos.forEach(poly => {
        for(let layerID in poly._layers){
            let layer = poly._layers[layerID];
            let feature = layer.feature;
            let act_id = feature.properties.act_id;
            console.log(act_id);
            if(act_id === activePolygon._id){
                map.removeLayer(poly);
                poly_segmentos = poly_segmentos.filter(segment => segment !== poly);
            }
        };
    });
    activePolygon.features = activePolygon.features.filter(feature => !feature.properties.es_segmento);
    if(activePolygon){
        let delta_aux = activePolygon.features[1].properties.delta;
        if(delta_aux > 0 && activePolygon.features[1].geometry.type === 'LineString'){
            let segmentos = turf.lineChunk(activePolygon.features[1].geometry, delta_aux, {units: 'meters'});
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
                i++;
            });
            for(i = 0; i < lineas_segmentadas.length - 1; i++){
                let randomColor = 'white';
                if (i%2 === 0) randomColor = 'black';
                let latlngs = [[lineas_segmentadas[i].geometry.coordinates[1][0], lineas_segmentadas[i].geometry.coordinates[1][1]],
                    [lineas_segmentadas[i].geometry.coordinates[0][0], lineas_segmentadas[i].geometry.coordinates[0][1]],
                    [lineas_segmentadas[i+1].geometry.coordinates[0][0], lineas_segmentadas[i+1].geometry.coordinates[0][1]],
                    [lineas_segmentadas[i+1].geometry.coordinates[1][0], lineas_segmentadas[i+1].geometry.coordinates[1][1]],
                    [lineas_segmentadas[i].geometry.coordinates[1][0], lineas_segmentadas[i].geometry.coordinates[1][1]]];
                let poly_segmento = turf.polygon([latlngs]);
                poly_segmento.properties = {};
                poly_segmento.properties.es_segmento = true;
                poly_segmento.properties.color = randomColor;
                poly_segmento.properties.act_id = activePolygon._id;
                let poly_dyn = L.geoJSON(poly_segmento, {color: randomColor}).addTo(map);
                
                activePolygon.features.push(poly_segmento);
                poly_segmentos.push(poly_dyn);
            }
        }
        console.log(activePolygon);
        
        fetch(uri+"api/v1/activos/"+activePolygon._id, {
            method: 'PUT',
            body: JSON.stringify(activePolygon),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
        });
        
    }
}

/*
    Funcion que toma valor delta ingresado en popup y lo asigna a la zona de interes correspondiente
*/
map.on('popupclose', function(e) {
    if(e.popup._source.feature === undefined) return;
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
        segmentLines(activePolygon._id);
    }


    
});

document.getElementById('togglePolygonMode').addEventListener('click', togglePolygonMode);
document.getElementById('measurementSelector').addEventListener('change', function(e) {
    const id = e.target.value;
    fetch(uri+"api/v1/geojson/"+id, {method: 'GET'})
    .then(response => response.json())
    .then(data => {
        console.log(data);
        mediciones.push(data);
        console.log("Empezando a crear recorrido");
        let latlngs = [];
        let start_time = performance.now();
        data.features.forEach(medicion => {
            
            let latlng = [medicion.geometry.coordinates[1], medicion.geometry.coordinates[0]];
            latlngs.push(latlng);
        });
        let finish_time = performance.now();
        let fin = [latlngs[0][1], latlngs[0][0]];
        
        
        let recorrido = L.polyline(latlngs, {color: 'red', weight: 3}).addTo(map);
        recorridos.push(recorrido);

        const execution_time = finish_time - start_time;
        console.log(`Tiempo de ejecucion: ${execution_time} milisegundos`);
    });
});
document.getElementById('pasadaSelector').addEventListener('change', function(e) {
    const id = e.target.value;
    if(id !== ""){
        fetch(uri+"api/v1/pasadas/"+id, {method: 'GET'})
        .then(response => response.json())
        .then(data => {
            console.log(data);
            data_pasadas.push(data);
            console.log("Empezando a crear recorrido");
            let latlngs = [];
            data.features.forEach(pasada => {
                if(pasada.properties.segmento){
                    let latlng = [pasada.geometry.coordinates[1], pasada.geometry.coordinates[0]];
                    latlngs.push(latlng);
                };
                
            });
            let recorrido = L.polyline(latlngs, {color: 'blue', weight: 5}).addTo(map);
            recorridos.push(recorrido);
            
        });
    }
});
document.getElementById('uploadButton').addEventListener('click', function() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    const data = new FormData();
    data.append('file', file);
    
    if (file) {
        fetch(uri+"api/v1/geojsonUpload", {
            method: 'POST',
            body: data
        }).then(response => response.json())
        .then(data => {
            console.log(data);
            addMeasurementOptions(data._id, data.filename);
        });
        // Perform file upload logic here
        console.log('File selected:', file.name);
        fileInput.value = '';
    } else {
        console.log('No file selected');
    }
});
document.getElementById('processMeasurement').addEventListener('click', processMeasurement);
document.getElementsByClassName('openbutton')[0].addEventListener('click', function() {
    document.getElementById('sidebar1').style.width = '285px';
    document.getElementById('main').style.marginRight = '285px';
});
document.getElementsByClassName('closebutton')[0].addEventListener('click', function() {
    document.getElementById('sidebar1').style.width = '0';
    document.getElementById('main').style.marginRight = '0';
});
document.getElementById('calculateKPI').addEventListener('click', function() {
    const pasada_id = document.getElementById('pasadaSelector').value;
    const KPI = document.getElementById('KPIselector').value;
    if(pasada_id === "" || KPI === ""){
        console.log("Selecciona una pasada y un KPI");
    }else{
        if(KPI === "RMS") RMScalc(pasada_id);
    }
});
document.getElementById('plotGraph').addEventListener('click', function() {
    const pasada_id = document.getElementById('pasadaSelector').value;

    if(pasada_id === ""){
        console.log("Selecciona una pasada");
    }else{
        let pasada = data_pasadas.find(pasada => pasada._id === pasada_id);
        if(pasada.properties.RMS){
            RMSpaint(pasada);
        }else{
            console.log("No se ha calculado el KPI");
        }
    }
});