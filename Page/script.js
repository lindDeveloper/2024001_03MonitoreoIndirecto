var baseMap = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});
var lyr_satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'",
  {
    id: "MapID",
    maxZoom: 20,
    attribution: "© Esri © OpenStreetMap Contributors",
  }
);

let map = L.map("map", {
  center: [-36.83725718996226, -73.08828200686368],
  zoom: 12,
  layers: [baseMap],
});

let baseMaps = {
  Básico: baseMap,
  Satélite: lyr_satellite,
};

L.control.layers(baseMaps).setPosition("bottomleft").addTo(map);

let conjunto = [];
let mediciones = [];
let recorridos = [];
let poly_segmentos = [];
let caracterizar = [];
let activos = [];
let points = [];
let data_pasadas = [];
const colors = ["green"];
const user = "admin";
const uri_api = "https://apiim-lind.ngrok.app/";
const uri_aa = "https://apiam-lind.ngrok.app/";
let area = 20;

let polygonMode = false;
let linea = null;
let nombre_poli = null;
let descripcion_poli = null;
let descripcionLabel = null;

/*
    Fetch que trae los activos del usuario y se encarga de manejar la representacion
    de estos en el mapa, ademas de almacenarlos en un conjunto
 */
fetch(uri_api + "api/v1/activos/" + user, { method: "GET" })
  .then((response) => response.json())
  .then((data) => {
    if (data.length === 0) {
      return;
    }
    data.forEach((activos) => {
      //console.log(activos);
      conjunto.push(activos);
      let poly_din = L.geoJSON(activos.features[0], {
        color: activos.features[0].properties.color,
      }).addTo(map);
      poly_din.bindPopup(
        "<b>" +
          activos.features[0].properties.nombre +
          "</b><br>" +
          "Ingrese un valor en metros para segmentar esta zona" +
          "<br><input type='text' id='deltaInput'>"
      );
      activos.features.forEach((feature) => {
        if (feature.properties.es_segmento) {
          let poly_dyn = L.geoJSON(feature, {
            color: feature.properties.color,
          }).addTo(map);
          poly_segmentos.push(poly_dyn);
        }
      });
    });
  });

/*
    Los siguientes fetchs son para llenar los selectores de mediciones, pasadas y
    activos a caracterizar, estos ultimos se llenan con el administrador de activos
*/
fetch(uri_api + "api/v1/geojsonAll", { method: "GET" })
  .then((response) => response.json())
  .then((data) => {
    if (data.length === 0) {
      return;
    }
    data.forEach((opcion) => {
      //console.log(opcion);
      addMeasurementOptions(opcion._id, opcion.filename);
    });
  });

function addMeasurementOptions(id, name) {
  const selector = document.getElementById("measurementSelector");
  const optionElement = document.createElement("option");
  optionElement.value = id;
  optionElement.textContent = name;
  selector.appendChild(optionElement);
}

fetch(uri_api + "api/v1/pasadas/?user=" + user, { method: "GET" })
  .then((response) => response.json())
  .then((data) => {
    if (data.length === 0) {
      return;
    }
    data.forEach((pasada) => {
      addPasadaOptions(pasada._id, pasada.filename);
    });
  });

function addPasadaOptions(id, name) {
  const selector = document.getElementById("pasadaSelector");
  const optionElement = document.createElement("option");
  optionElement.value = id;
  optionElement.textContent = name;
  selector.appendChild(optionElement);
}

fetch(uri_aa + "api/v1/assets", {
  method: "GET",
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
})
  .then((response) => response.json())
  .then((data) => {
    data = data.filter(
      (activo) => activo.Latitud !== "" || activo.Longitud !== ""
    );
    const aiFingerprintSelector = document.getElementById("AISelector");
    addAISelectorOptions(aiFingerprintSelector, 1, "Puente Biobio");
    data.forEach((activo) => {
      caracterizar.push(activo);
      addCaracterizationOptions(activo.ID, activo.Nombre);
    });
  });

function addCaracterizationOptions(id, name) {
  const selector = document.getElementById("caracterizationSelector");
  const optionElement = document.createElement("option");
  optionElement.value = id;
  optionElement.textContent = name;
  selector.appendChild(optionElement);
}

function addAISelectorOptions(selector, id, name) {
  const optionElement = document.createElement("option");
  optionElement.value = id;
  optionElement.textContent = name;
  selector.appendChild(optionElement);
}

function isZoneDrawnForAsset(assetId) {
  let assetExists = conjunto.find(
    (activo) => activo.features[0].properties.act_id === assetId
  );
  return assetExists !== undefined;
}

/* 
    Funcion que maneja un modo de creacion de poligonos,
    que permite crear poligonos los cuales representan una zona de interés a partir de una linea
*/
function togglePolygonMode() {
  if (
    isZoneDrawnForAsset(
      document.getElementById("caracterizationSelector").value
    )
  ) {
    showToast("Ya se ha caracterizado este activo", false);
    polygonMode = !polygonMode;
    return;
  }
  enablePolygonCreationMode();
}

function enablePolygonCreationMode() {
  const polygonCreationButton = document.getElementById("togglePolygonMode");
  polygonCreationButton.innerHTML =
    'Dibujando Activo <span class="spinner-grow spinner-grow-sm text-light" role="status" aria-hidden="true"></span>';
  polygonCreationButton.classList.remove("btn-primary");
  polygonCreationButton.classList.add("btn-secondary");
  polygonCreationButton.style.disabled = true;
  map.on("click", createPolygon);
  document.getElementById("caracterizationSelector").disabled = true;
  document.getElementById("map").style.cursor = "crosshair";
  showEditionButtons();
}

function showEditionButtons() {
  document.getElementById("editionButtons").style.display = "block";
}

function hideEditionButtons() {
  document.getElementById("editionButtons").style.display = "none";
}

function disablePolygonCreationMode() {
  map.off("click", createPolygon);
  document.getElementById("map").style.cursor = "grab";
  const polygonCreationButton = document.getElementById("togglePolygonMode");
  polygonCreationButton.innerHTML = "Caracterizar Activo";
  polygonCreationButton.classList.remove("btn-secondary");
  polygonCreationButton.classList.add("btn-primary");
  polygonCreationButton.style.disabled = false;
  document.getElementById("caracterizationSelector").disabled = false;
  hideEditionButtons();

  if (linea) {
    if (linea && linea.getLatLngs().length < 2) {
      showToast("Debe dibujar al menos 2 puntos para crear el polígono", false);
      linea = null;
      return;
    }
    createPolygonFromLine();
  }
}

function createPolygonFromLine() {
  let latlngs = linea.getLatLngs().map((coord) => [coord.lat, coord.lng]);
  let linePoints = turf.lineString(latlngs);
  let polygon = turf.buffer(linePoints, 25, { units: "meters" });
  let coordinates = polygon.geometry.coordinates[0].map((coord) => [
    coord[0],
    coord[1],
  ]);
  let randomColor = colors[Math.floor(Math.random() * colors.length)];
  let dynamicPolygon = L.polygon(coordinates, { color: randomColor }).addTo(
    map
  );

  initializeProperties(dynamicPolygon);

  storeComponents(dynamicPolygon);

  map.removeLayer(linea);
  linea = null;
  points = [];
}

function initializeProperties(dynamicPolygon) {
  const selectedAsset = document.getElementById("caracterizationSelector");
  if (selectedAsset.selectedOptions.length === 0) {
    showToast("Seleccione un activo a caracterizar", false);
    return;
  }

  selectedAssetName = selectedAsset.selectedOptions[0].text;
  linea.properties = {};
  linea.properties.delta = 0;
  dynamicPolygon.properties = {};
  dynamicPolygon.properties.color = dynamicPolygon.options.color;
  if (selectedAssetName.trim() !== "" || selectedAssetName.trim() !== null) {
    dynamicPolygon.properties.nombre = selectedAssetName;
    dynamicPolygon.properties.act_id = selectedAsset.value;
    dynamicPolygon.bindPopup(
      "<b>" +
        dynamicPolygon.properties.nombre +
        "</b><br>" +
        "Ingrese un valor en metros para segmentar esta zona" +
        "<br><input type='text' id='deltaInput'>"
    );
  } else {
    map.removeLayer(dynamicPolygon);
    map.removeLayer(linea);
    linea = null;
    removeTextField();
    return;
  }
}

function storeComponents(dynamicPolygon) {
  let dynamicPolygonGeojson = {
    type: "Feature",
    geometry: dynamicPolygon.toGeoJSON().geometry,
    properties: dynamicPolygon.properties,
  };
  let lineGeojson = {
    type: "Feature",
    geometry: linea.toGeoJSON().geometry,
    properties: linea.properties,
  };

  let featuresPolygon = {
    type: "FeatureCollection",
    features: [dynamicPolygonGeojson, lineGeojson],
    properties: {
      user: user,
    },
  };
  let characterized = caracterizar.find(
    (activo) =>
      activo.ID === document.getElementById("caracterizationSelector").value
  );
  postFeatures(featuresPolygon, characterized);
  updateAssetFlags(characterized);
}

function postFeatures(featuresPolygon, characterized) {
  fetch(uri_api + "api/v1/activos", {
    method: "POST",
    body: JSON.stringify(featuresPolygon),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      featuresPolygon._id = data._id;
      conjunto.push(featuresPolygon);
      map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      let selector = document.getElementById("caracterizationSelector");
      selector.removeChild(selector.options[selector.selectedIndex]);
      toggleActivate("");
    });
}

function updateAssetFlags(characterized) {
  fetch(uri_aa + "api/v1/assets/" + characterized.ID + "/flags", {
    method: "PATCH",
    body: JSON.stringify({ flags: { hasMI: true } }),
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
    });
}

/* 
    Funcion para crear los textfields y labels correspondientes a nombre y descripcion de zona de interés
*/
/* function createTextField() {
  let activo_id = document.getElementById("caracterizationSelector").value;
  let activo = caracterizar.find((activo) => activo.ID === activo_id);
  console.log(activo);
  let container = document.getElementById("textfield_container");
  nombreLabel = document.createElement("label");
  descripcionLabel = document.createElement("label");
  nombreLabel.textContent = "Nombre";
  descripcionLabel.textContent = "Descripcion";
  nombre_poli = document.createElement("input");
  nombre_poli.type = "text";
  nombre_poli.classList.add("textfield");
  container.appendChild(nombreLabel);
  container.appendChild(nombre_poli);
  descripcion_poli = document.createElement("input");
  descripcion_poli.type = "text";
  descripcion_poli.classList.add("textfield");
  container.appendChild(descripcionLabel);
  container.appendChild(descripcion_poli);
  descripcion_poli.value = activo.Descripcion;
  nombre_poli.value = activo.Nombre;
} */

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
  points.push(e.latlng);

  if (!linea) {
    linea = L.polyline([e.latlng], { color: "black" }).addTo(map);
  } else {
    linea.addLatLng(e.latlng);
  }
}

function revertLastLinePoint() {
  if (points.length > 0) {
    points.pop();

    map.removeLayer(linea);

    linea = L.polyline(points, { color: "black" }).addTo(map);
  }
}

function cancelPolygonCreation() {
  if (linea) {
    map.removeLayer(linea);
    points = [];
    linea = null;
  }

  disablePolygonCreationMode();
}

/* 
    Funcion que llama a la api para procesar una medicion y obtener las pasadas
*/
function processMeasurement() {
  let valor = document.getElementById("measurementSelector").value;
  if (valor === "") {
    showToast("Seleccione un recorrido para procesar", false);
    return;
  }
  const processButton = document.getElementById("processMeasurement");
  processButton.disabled = true;
  processButton.innerHTML =
    'Procesando ... <div class="spinner-border spinner-border-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>';

  fetch(uri_api + "api/v1/geojson/" + user + "/process/" + valor, {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      data.forEach((pasada) => {
        console.log(pasada);
        addPasadaOptions(pasada.pasada_id, pasada.filename);
      });
      processButton.disabled = false;
      processButton.innerText = "Procesar Pasadas";
      showToast("Pasadas Generadas", true);
    })
    .catch((error) => {
      processButton.disabled = false;
      processButton.innerText = "Procesar Pasadas";
      showToast(
        "No se logró procesar el recorrido. Porfavor inténtelo nuevamente.",
        false
      );
    });
}

/* 
    Funcion que calcula el KPI RMS de una pasada obtenida segun su id
*/
function RMScalc(id, calculateButton) {
  let pasada = data_pasadas.find((pasada) => pasada._id === id);
  let activo = conjunto.find(
    (activo) => activo._id === pasada.properties.act_id
  );
  let segmentos = activo.features.filter(
    (feature) => feature.properties.es_segmento
  );
  let data = [];
  let data_transpose = [];
  segmentos.forEach((segmento) => {
    data.push([]);
  });
  pasada.features.forEach((medicion) => {
    if (medicion.properties.segmento) {
      let index = medicion.properties.segmento - 1;
      let feature_data = [];
      let i = 1;
      while (
        medicion.properties[`x${i}`] !== undefined &&
        medicion.properties[`y${i}`] !== undefined &&
        medicion.properties[`z${i}`] !== undefined
      ) {
        let x = medicion.properties[`x${i}`];
        let y = medicion.properties[`y${i}`];
        let z = medicion.properties[`z${i}`];
        feature_data.push(x, y, z);
        i++;
      }
      data[index].push(feature_data);
    }
  });

  data.forEach((segmento) => {
    let segmento_transpose = transpose(segmento);
    data_transpose.push(segmento_transpose);
  });

  pasada.properties.RMS = [];
  data_transpose.forEach((segmento) => {
    let rms = [];
    segmento.forEach((componente) => {
      let sum = 0;
      componente.forEach((valor) => {
        sum += valor * valor;
      });
      rms.push(Math.sqrt(sum / componente.length));
    });
    console.log(rms);
    pasada.properties.RMS.push(rms);
  });
  updateKPI(pasada);
  openKPIChartModal();
  calculateButton.disabled = false;
  calculateButton.innerText = "Calcular y Graficar KPI";
}

function openKPIChartModal() {
  let modal = new bootstrap.Modal(document.getElementById("KPIChartModal"));
  modal.show();
}
/* 
    Funcion que dibuja el KPI RMS de una pasada en forma de grafico
    segun parametros seleccionados por el usuario
*/
function RMSpaint(pasada) {
  const axisContainer = document.getElementById("axisSelector");
  const axisValue = axisContainer.value;
  const axisName = axisContainer.options[axisContainer.selectedIndex].text;

  const deviceContainer = document.getElementById("deviceSelector");
  const deviceValue = deviceContainer.value;
  const deviceName =
    deviceContainer.options[deviceContainer.selectedIndex].text;

  if (axisValue === "" || deviceValue === "") {
    showToast("Seleccione un eje y un acelerometro", false);
    return;
  }
  let RMS = pasada.properties.RMS;
  let lim_inf = parseInt(axisValue) * 4;
  let lim_sup = lim_inf;

  if (deviceValue === "4") {
    lim_sup += 4;
  } else {
    lim_inf += parseInt(deviceValue);
    lim_sup = lim_inf + 1;
  }

  let x_aux = [];
  for (let i = 1; i <= RMS.length; i++) {
    x_aux.push(i);
  }
  let data = [];
  for (let i = lim_inf; i < lim_sup; i++) {
    let aux = [];
    for (let j = 0; j < RMS.length; j++) {
      aux.push(RMS[j][i]);
    }
    let accel_aux = i + 1 - lim_inf;
    let deviceNameAux = deviceContainer.options[accel_aux - 1].text;
    let trace = {
      x: x_aux,
      y: aux,
      type: "scatter",
      mode: "lines+markers",
      name: `${deviceNameAux} ${axisName}`,
    };
    data.push(trace);
  }
  var layout = {
    title: "RMS",
    autosize: true,
    xaxis: {
      title: "Segmento",
      automargin: true,
    },
    yaxis: {
      title: "RMS",
      automargin: true,
    },
  };
  var config = { responsive: true };

  Plotly.newPlot("graphPlot", data, layout, config);
}

/* 
    Funcion que actualiza el KPI de una pasada en la base de datos,
    busca ser llamada al final del calculo de un KPI
*/
function updateKPI(pasada) {
  fetch(uri_api + "api/v1/pasadas/" + pasada._id, {
    method: "PUT",
    body: JSON.stringify(pasada),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
    });
}

/* 
    Funcion auxiliar que se encarga de obtener la matriz transpuesta
    de una matriz dada, se utiliza para el calculo de RMS
*/
function transpose(matrix) {
  console.log(matrix);
  if (matrix.length === 0) return [];
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}

/*
    Funcion que segmenta las lineas de las zonas de interes en base al valor delta ingresado
    y despues actualiza la base de datos con los cambios realizados
*/
function segmentLines(id) {
  let activePolygon = conjunto.find((polygon) => polygon._id === id);
  poly_segmentos.forEach((poly) => {
    for (let layerID in poly._layers) {
      let layer = poly._layers[layerID];
      let feature = layer.feature;
      let act_id = feature.properties.act_id;
      if (act_id === activePolygon._id) {
        map.removeLayer(poly);
        poly_segmentos = poly_segmentos.filter((segment) => segment !== poly);
      }
    }
  });
  activePolygon.features = activePolygon.features.filter(
    (feature) => !feature.properties.es_segmento
  );
  if (activePolygon) {
    let delta_aux = activePolygon.features[1].properties.delta;
    if (
      delta_aux > 0 &&
      activePolygon.features[1].geometry.type === "LineString"
    ) {
      let segmentos = turf.lineChunk(
        activePolygon.features[1].geometry,
        delta_aux,
        { units: "meters" }
      );
      let lineas_segmentadas = [];
      let i = 0;
      segmentos.features.forEach((segmento) => {
        let coords = turf.getCoords(segmento);
        let end = coords[coords.length - 1];
        let bearing = turf.bearing(coords[0], end);
        let point1 = turf.rhumbDestination(end, area, bearing + 90, {
          units: "meters",
        });
        let point2 = turf.rhumbDestination(end, area, bearing - 90, {
          units: "meters",
        });
        if (i === 0) {
          bearing = turf.bearing(end, coords[0]);
          let point3 = turf.rhumbDestination(coords[0], area, bearing - 90, {
            units: "meters",
          });
          let point4 = turf.rhumbDestination(coords[0], area, bearing + 90, {
            units: "meters",
          });
          let linea_segmento = turf.lineString([
            point3.geometry.coordinates,
            point4.geometry.coordinates,
          ]);
          lineas_segmentadas.push(linea_segmento);
        }
        let linea_segmento = turf.lineString([
          point1.geometry.coordinates,
          point2.geometry.coordinates,
        ]);
        lineas_segmentadas.push(linea_segmento);
        i++;
      });
      for (i = 0; i < lineas_segmentadas.length - 1; i++) {
        let randomColor = "white";
        if (i % 2 === 0) randomColor = "black";
        let latlngs = [
          [
            lineas_segmentadas[i].geometry.coordinates[1][0],
            lineas_segmentadas[i].geometry.coordinates[1][1],
          ],
          [
            lineas_segmentadas[i].geometry.coordinates[0][0],
            lineas_segmentadas[i].geometry.coordinates[0][1],
          ],
          [
            lineas_segmentadas[i + 1].geometry.coordinates[0][0],
            lineas_segmentadas[i + 1].geometry.coordinates[0][1],
          ],
          [
            lineas_segmentadas[i + 1].geometry.coordinates[1][0],
            lineas_segmentadas[i + 1].geometry.coordinates[1][1],
          ],
          [
            lineas_segmentadas[i].geometry.coordinates[1][0],
            lineas_segmentadas[i].geometry.coordinates[1][1],
          ],
        ];
        let poly_segmento = turf.polygon([latlngs]);
        poly_segmento.properties = {};
        poly_segmento.properties.es_segmento = true;
        poly_segmento.properties.color = randomColor;
        poly_segmento.properties.act_id = activePolygon._id;
        let poly_dyn = L.geoJSON(poly_segmento, { color: randomColor }).addTo(
          map
        );

        activePolygon.features.push(poly_segmento);
        poly_segmentos.push(poly_dyn);
      }
    }
    console.log(activePolygon);

    fetch(uri_api + "api/v1/activos/" + activePolygon._id, {
      method: "PUT",
      body: JSON.stringify(activePolygon),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
      });
  }
}

function showToast(message, isSuccess) {
  var toastEl = document.getElementById("myToast");
  var toast = new bootstrap.Toast(toastEl);

  toastEl.classList.remove("bg-success-subtle", "bg-danger-subtle");
  toastEl.classList.add(isSuccess ? "bg-success-subtle" : "bg-danger-subtle");

  var toastBodyEl = toastEl.querySelector(".toast-body");
  toastBodyEl.textContent = message;

  toast.show();
}

/*
    Funcion que se encarga de disponibilizar el boton para crear la caracterizacion
    de un activo no caracterizado
*/
function toggleActivate(id) {
  const activateButton = document.getElementById("togglePolygonMode");
  if (id !== "") {
    activateButton.disabled = false;
    activateButton.classList.remove("btn-secondary");
    activateButton.classList.add("btn-primary");
  } else {
    activateButton.disabled = true;
    activateButton.classList.remove("btn-primary");
    activateButton.classList.add("btn-secondary");
  }
}

/*
    Funcion que toma valor delta ingresado en popup y lo asigna a la zona de interes correspondiente
*/
map.on("popupclose", function (e) {
  console.log(e);
  if (
    e.popup._source.feature === undefined &&
    e.popup._source.properties === undefined
  )
    return;
  console.log(e.popup._source);
  let delta = document.getElementById("deltaInput").value;
  if (delta === "" || isNaN(delta) || !Number.isInteger(Number(delta))) {
    console.log("Ingresa un numero entero valido");
  } else {
    let activePolygon = null;
    conjunto.forEach((polygon) => {
      //Se busca el poligono correspondiente al popup cerrado en base al nombre de este, tomando en cuenta
      //que el popup puede venir de un poligono directo o un geoJSON
      if (e.popup._source.feature !== undefined) {
        if (
          polygon.features[0].properties.nombre ===
          e.popup._source.feature.properties.nombre
        ) {
          activePolygon = polygon;
          //console.log("Encontrado: " + activePolygon.features[1].geometry.properties.nombre);
          activePolygon.features[1].properties.delta = parseInt(delta);
          //console.log("Nuevo delta: " + activePolygon.features[0].geometry.properties.delta);
        }
      } else {
        if (
          polygon.features[0].properties.nombre ===
          e.popup._source.properties.nombre
        ) {
          activePolygon = polygon;
          //console.log("Encontrado: " + activePolygon.features[1].geometry.properties.nombre);
          activePolygon.features[1].properties.delta = parseInt(delta);
          //console.log("Nuevo delta: " + activePolygon.features[0].geometry.properties.delta);
        }
      }
    });
    segmentLines(activePolygon._id);
  }
});

/*
    Event listener para el boton de caracterizar activo
*/
document
  .getElementById("togglePolygonMode")
  .addEventListener("click", togglePolygonMode);

document
  .getElementById("savePolygon")
  .addEventListener("click", disablePolygonCreationMode);

document
  .getElementById("cancelPolygonCreation")
  .addEventListener("click", cancelPolygonCreation);
document
  .getElementById("revertLastLinePoint")
  .addEventListener("click", revertLastLinePoint);

/* 
    Event listeners para los selectores de mediciones y pasadas, que se encargan de
    recuperar de la base de datos las mediciones y pasadas seleccionadas
*/
document
  .getElementById("measurementSelector")
  .addEventListener("change", function (e) {
    const id = e.target.value;
    fetch(uri_api + "api/v1/geojson/" + id, { method: "GET" })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        mediciones.push(data);
        console.log("Empezando a crear recorrido");
        let latlngs = [];
        let start_time = performance.now();
        data.features.forEach((medicion) => {
          let latlng = [
            medicion.geometry.coordinates[1],
            medicion.geometry.coordinates[0],
          ];
          latlngs.push(latlng);
        });
        let finish_time = performance.now();
        let fin = [latlngs[0][1], latlngs[0][0]];

        let recorrido = L.polyline(latlngs, { color: "red", weight: 3 }).addTo(
          map
        );
        recorridos.push(recorrido);

        const execution_time = finish_time - start_time;
        console.log(`Tiempo de ejecucion: ${execution_time} milisegundos`);
      });
  });
document
  .getElementById("pasadaSelector")
  .addEventListener("change", function (e) {
    const id = e.target.value;
    console.log(id);
    if (id !== "") {
      fetch(uri_api + "api/v1/pasadas/" + id, { method: "GET" })
        .then((response) => response.json())
        .then((data) => {
          console.log(data);
          data_pasadas.push(data);
          console.log("Empezando a crear recorrido");
          let latlngs = [];
          data.features.forEach((pasada) => {
            if (pasada.properties.segmento) {
              let latlng = [
                pasada.geometry.coordinates[1],
                pasada.geometry.coordinates[0],
              ];
              latlngs.push(latlng);
            }
          });
          let recorrido = L.polyline(latlngs, {
            color: "blue",
            weight: 5,
          }).addTo(map);
          recorridos.push(recorrido);
        });
    }
  });

/*
    Event listener para el selector de activos a caracterizar, que se encarga de
    llamar la funcion para activar el boton de caracterizacion
*/
document
  .getElementById("caracterizationSelector")
  .addEventListener("change", function (e) {
    map.eachLayer(function (layer) {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });
    const id = e.target.value;
    toggleActivate(id);
    if (id === "") return;
    let activo = caracterizar.find((activo) => activo.ID === id);
    map.setView([activo.Latitud, activo.Longitud], 15);
    L.marker([activo.Latitud, activo.Longitud]).addTo(map);
  });

document.getElementById("AIRedirect").addEventListener("click", function () {
  window.open("https://web.lind.global/webapps/home/session.html?app=APPS_CTF%2FCORFO_Huella_AI", "_blank");
});

/*
    Event listener para el boton de subir archivo de medicion,
    si se ha ingresado un archivo, se sube usando la api y se añade al selector de mediciones
*/
document.getElementById("uploadButton").addEventListener("click", function () {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const data = new FormData();
  data.append("file", file);

  if (file) {
    const uploadButton = document.getElementById("uploadButton");
    uploadButton.disabled = true;
    uploadButton.innerHTML =
      'Subiendo archivo... <div class="spinner-border spinner-border-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>';

    fetch(uri_api + "api/v1/geojsonUpload", {
      method: "POST",
      body: data,
    })
      .then((response) => response.json())
      .then((data) => {
        addMeasurementOptions(data._id, data.filename);
        uploadButton.disabled = false;
        uploadButton.innerText = "Subir Recorrido";
        showToast("Recorrido cargado", true);
      })
      .catch((error) => {
        uploadButton.disabled = false;
        uploadButton.innerText = "Subir Recorrido";
        showToast(
          "No se logró subir Recorrido. Porfavor inténtelo nuevamente.",
          false
        );
      });

    // Perform file upload logic here
    fileInput.value = "";
  } else {
    showToast("Seleccione un Recorrido para subir", false);
  }
});

document
  .getElementById("processMeasurement")
  .addEventListener("click", processMeasurement);

/*
    Event listeners para el boton de calcular KPI y el boton de graficar KPI
    que se encargan de llamar las funciones correspondientes segun parametros seleccionados
*/
document.getElementById("calculateKPI").addEventListener("click", function () {
  const pasada_id = document.getElementById("pasadaSelector").value;
  const KPI = document.getElementById("KPIselector").value;

  if (pasada_id === "" || KPI === "") {
    showToast("Seleccione una pasada y un KPI", false);
  } else {
    const calculateButton = document.getElementById("calculateKPI");
    calculateButton.disabled = true;
    calculateButton.innerHTML =
      'Calculando ... <div class="spinner-border spinner-border-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>';

    if (KPI === "RMS") {
      RMScalc(pasada_id, calculateButton);
    }
  }
});
document.getElementById("plotGraph").addEventListener("click", function () {
  const pasada_id = document.getElementById("pasadaSelector").value;

  if (pasada_id === "") {
    console.log("Selecciona una pasada");
  } else {
    let pasada = data_pasadas.find((pasada) => pasada._id === pasada_id);
    if (pasada.properties.RMS) {
      RMSpaint(pasada);
    } else {
      console.log("No se ha calculado el KPI");
    }
  }
});
