// js/app.js

let mapa;
let capaMarcadores;
let datosLocaciones = [];

const iconoAzul = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const iconoRojo = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

document.addEventListener('DOMContentLoaded', () => {
    inicializarMapa();
    cargarDatosCSV();
});

function inicializarMapa() {
    mapa = L.map('map').setView([-34.575, -58.535], 13);
    // Sin marca de agua y sin bloqueo de la Muni
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: '© Esri'
    }).addTo(mapa);
    capaMarcadores = L.layerGroup().addTo(mapa);
    setTimeout(() => { mapa.invalidateSize(); }, 300);
}

function getCampo(obj,...posiblesNombres) {
    if (!obj) return '';
    const keys = Object.keys(obj);
    for (let nombre of posiblesNombres) {
        const match = keys.find(k => k.trim().toLowerCase() === nombre.toLowerCase());
        if (match && obj[match]!== undefined && obj[match]!== null) return obj[match].toString().trim();
    }
    return '';
}
function formatearCoordenada(valor) {
    if (!valor) return null;
    let str = valor.toString().trim().replace(/,/g, '.').replace(/\./g, '');
    if (!str || str === '-') return null;
    if (!str.startsWith('-')) str = '-' + str;
    if (str.length > 3) str = str.substring(0, 3) + '.' + str.substring(3);
    const num = parseFloat(str);
    return isNaN(num)? null : num;
}

// SOLO DETECTA EL "NO"
function esSinSeguro(valor) {
    if (!valor) return true;
    const v = valor.toString().trim().toLowerCase();
    return v === 'no' || v === 'n' || v.startsWith('no ') || v === 'sin cobertura' || v.includes('sin seguro') || v.includes('no tiene');
}

// Devuelve el texto del seguro, en rojo solo si es NO
function formatearSeguro(valor) {
    const texto = valor || 'Sin cobertura registrada';
    if (esSinSeguro(valor)) {
        return `<span class="seguro-no">${texto}</span>`;
    }
    return texto;
}

function cargarDatosCSV() {
    Papa.parse('locaciones.csv', {
        download: true, header: true, delimiter: ";", skipEmptyLines: true,
        complete: function(results) {
            datosLocaciones = results.data;
            document.getElementById('status-box').innerText = `${datosLocaciones.length} locaciones cargadas`;
            poblarFiltrosMultiselect();
            poblarSugerenciasAutocompletado();
            filtrarLocaciones();
        }
    });
}
function poblarFiltrosMultiselect() {
    poblarDesplegable('dropdown-subsecretaria', 'SUBSECRETARÍA', 'Subsecretaria', 'Subsecretaría');
    poblarDesplegable('dropdown-regimen', 'PROPIO/ALQUILADO', 'Régimen', 'Regimen');
    poblarDesplegable('dropdown-pertenencia', 'PROPIO/ALQUILADO - Copia', 'Pertenencia', 'Titular');
    poblarDesplegable('dropdown-seguro', 'COBERTURA', 'Seguro', 'Cobertura de Seguro');
}
function poblarDesplegable(idContenedor,...posiblesColumnas) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    const opciones = [...new Set(datosLocaciones.map(item => getCampo(item,...posiblesColumnas)).filter(Boolean))].sort();
    contenedor.innerHTML = '';
    opciones.forEach(opcion => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.innerHTML = `<input type="checkbox" value="${opcion}" onchange="alCambiarFiltro('${idContenedor}')"><span>${opcion}</span>`;
        contenedor.appendChild(label);
    });
}
function poblarSugerenciasAutocompletado() {
    const d1 = document.getElementById('sugerencias-espacio');
    const d2 = document.getElementById('sugerencias-direccion');
    if (d1) d1.innerHTML = [...new Set(datosLocaciones.map(i => getCampo(i, 'ESPACIO', 'Espacio')).filter(Boolean))].sort().map(e => `<option value="${e}">`).join('');
    if (d2) d2.innerHTML = [...new Set(datosLocaciones.map(i => getCampo(i, 'DIRECCION', 'Dirección', 'Direccion')).filter(Boolean))].sort().map(d => `<option value="${d}">`).join('');
}
function alCambiarFiltro(idContenedor) { actualizarTextoBoton(idContenedor); filtrarLocaciones(); }
function actualizarTextoBoton(idContenedor) {
    const checked = document.querySelectorAll(`#${idContenedor} input[type="checkbox"]:checked`);
    let idLabel = idContenedor.replace('dropdown-','label-');
    const el = document.getElementById(idLabel);
    if (!el) return;
    if (checked.length===0) el.innerText = 'Todos / Todas';
    else if (checked.length===1) el.innerText = checked[0].value;
    else el.innerText = `${checked.length} seleccionados`;
}
function filtrarLocaciones() {
    const getChecked = (id) => Array.from(document.querySelectorAll(`#${id} input[type="checkbox"]:checked`)).map(c => c.value);
    const selSub = getChecked('dropdown-subsecretaria'), selReg = getChecked('dropdown-regimen'), selPert = getChecked('dropdown-pertenencia'), selSeg = getChecked('dropdown-seguro');
    const txtEsp = document.getElementById('search-espacio')?.value.toLowerCase().trim() || '', txtDir = document.getElementById('search-direccion')?.value.toLowerCase().trim() || '';
    const filtrados = datosLocaciones.filter(item => {
        const vSub = getCampo(item, 'SUBSECRETARÍA', 'Subsecretaria', 'Subsecretaría');
        const vReg = getCampo(item, 'PROPIO/ALQUILADO', 'Régimen', 'Regimen');
        const vPert = getCampo(item, 'PROPIO/ALQUILADO - Copia', 'Pertenencia', 'Titular');
        const vSeg = getCampo(item, 'COBERTURA', 'Seguro', 'Cobertura de Seguro');
        const vEsp = getCampo(item, 'ESPACIO', 'Espacio'), vDir = getCampo(item, 'DIRECCION', 'Dirección', 'Direccion');
        return (selSub.length===0 || selSub.includes(vSub)) && (selReg.length===0 || selReg.includes(vReg)) && (selPert.length===0 || selPert.includes(vPert)) && (selSeg.length===0 || selSeg.includes(vSeg)) && (!txtEsp || vEsp.toLowerCase().includes(txtEsp)) && (!txtDir || vDir.toLowerCase().includes(txtDir));
    });
    actualizarInterfaz(filtrados);
}

function actualizarInterfaz(locaciones) {
    capaMarcadores.clearLayers();
    const contenedorLista = document.getElementById('locations-list');
    if (contenedorLista) contenedorLista.innerHTML = '';
    document.getElementById('total-count').innerText = locaciones.length;
    let primerPin = null;

    locaciones.forEach(loc => {
        const nombreEspacio = getCampo(loc, 'ESPACIO', 'Espacio') || 'Sin Nombre';
        const direccion = getCampo(loc, 'DIRECCION', 'Dirección', 'Direccion') || 'Sin dirección';
        const subsecretaria = getCampo(loc, 'SUBSECRETARÍA', 'Subsecretaria', 'Subsecretaría') || '-';
        const regimen = getCampo(loc, 'PROPIO/ALQUILADO', 'Régimen', 'Regimen') || 'N/A';
        const pertenencia = getCampo(loc, 'PROPIO/ALQUILADO - Copia', 'Pertenencia') || '-';
        const seguroRaw = getCampo(loc, 'COBERTURA', 'Seguro', 'COBERTURA') || 'Sin cobertura registrada';
        const sinSeguro = esSinSeguro(seguroRaw);
        const lat = formatearCoordenada(getCampo(loc, 'LATITUD', 'Latitud', 'Lat')), lng = formatearCoordenada(getCampo(loc, 'LONGITUD', 'Longitud', 'Lng'));

        if (lat && lng) {
            const popupHTML = `
                <div class="popup-ficha">
                    <h3>${nombreEspacio}</h3>
                    <p><strong>Dirección:</strong> ${direccion}</p>
                    <p><strong>Subsecretaría:</strong> ${subsecretaria}</p>
                    <p><strong>Régimen:</strong> <span class="badge ${obtenerClaseBadge(regimen)}">${regimen}</span></p>
                    <p><strong>Pertenencia:</strong> ${pertenencia}</p>
                    <p><strong>Seguro:</strong> ${formatearSeguro(seguroRaw)}</p>
                </div>`;
            // PIN ROJO SI NO TIENE
            const marker = L.marker([lat, lng], { icon: sinSeguro? iconoRojo : iconoAzul }).bindPopup(popupHTML);
            capaMarcadores.addLayer(marker);
            loc._marker = marker;
            if (!primerPin) primerPin = [lat, lng];
        }

        // FICHA LATERAL EXACTA COMO TU CAPTURA
        if (contenedorLista) {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'list-item';
            tarjeta.innerHTML = `
                <h4>${nombreEspacio}</h4>
                <p>📍 <strong>Dirección:</strong> ${direccion}</p>
                <p>🏢 <strong>Subsecretaría:</strong> ${subsecretaria}</p>
                <p>📋 <strong>Régimen:</strong> ${regimen} (${pertenencia})</p>
                <p>🛡 <strong>Seguro:</strong> ${formatearSeguro(seguroRaw)}</p>
            `;
            tarjeta.onclick = () => { if (loc._marker) { mapa.setView(loc._marker.getLatLng(), 16); loc._marker.openPopup(); } };
            contenedorLista.appendChild(tarjeta);
        }
    });
    if (primerPin) mapa.panTo(primerPin);
}
function obtenerClaseBadge(regimen) {
    if (!regimen) return 'otros';
    const r = regimen.toLowerCase();
    if (r.includes('propio')) return 'propio';
    if (r.includes('alquiler') || r.includes('alquilado')) return 'alquiler';
    if (r.includes('comodato')) return 'comodato';
    if (r.includes('ceamse')) return 'ceamse';
    if (r.includes('ferrocarril')) return 'ferrocarril';
    return 'otros';
}