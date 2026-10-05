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
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: '© Esri'
    }).addTo(mapa);
    capaMarcadores = L.layerGroup().addTo(mapa);
    setTimeout(() => { mapa.invalidateSize(); }, 300);
}

function getCampo(obj, ...posiblesNombres) {
    if (!obj) return '';
    const keys = Object.keys(obj);
    for (let nombre of posiblesNombres) {
        const match = keys.find(k => k.trim().toLowerCase() === nombre.toLowerCase());
        if (match && obj[match] !== undefined && obj[match] !== null) return obj[match].toString().trim();
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
    return isNaN(num) ? null : num;
}

// Escapa texto para insertarlo de forma segura en HTML
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Detecta "NO" en el seguro
function esSinSeguro(valor) {
    if (!valor) return true;
    const v = valor.toString().trim().toLowerCase();
    return v === 'no' || v === 'n' || v.startsWith('no ') || v === 'sin cobertura' || v.includes('sin seguro') || v.includes('no tiene');
}

// Texto del seguro, en rojo solo si es NO
function formatearSeguro(valor) {
    const texto = esc(valor || 'Sin cobertura registrada');
    if (esSinSeguro(valor)) {
        return `<span class="seguro-no">${texto}</span>`;
    }
    return texto;
}

// Detecta "NO" en planos
function esNo(valor) {
    const v = (valor || '').toString().trim().toLowerCase();
    return v === 'no' || v === 'n' || v.startsWith('no ') || v.includes('sin plano') || v === 'inexistente';
}

// ---------- FICHA EMERGENTE ----------
function dividirItems(valor) {
    return valor
        .split(/\r?\n|;|•|\.\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
        .map(s => s.trim().replace(/\.$/, ''))
        .filter(Boolean);
}

function toggleDocs(btn) {
    const fila = document.getElementById('fila-docs');
    if (!fila) return;
    const abierto = fila.classList.toggle('show');
    btn.textContent = abierto ? 'VER MENOS' : 'VER MÁS';
}

function abrirFicha(loc) {
    const nombre = getCampo(loc, 'ESPACIO', 'Espacio') || 'Sin nombre';
    const esDoc = k => /documentaci[oó]n/i.test(k);

    // Bloque con la documentación 1 y 2, en lista
    const bloqueDocs = Object.keys(loc).filter(esDoc).map(k => {
        const v = (loc[k] ?? '').toString().trim();
        if (!v) return '';
        const items = dividirItems(v);
        return `<div class="doc-bloque"><h4>${esc(k)}</h4><ul class="doc-lista">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
    }).join('');

    const filas = Object.keys(loc)
        .filter(k => !k.startsWith('_') && k.trim() !== '' && !esDoc(k))
        .map(k => {
            const valor = (loc[k] ?? '').toString().trim();
            const kn = k.toLowerCase();
            let celda;
            let filaExtra = '';
            if (kn.includes('plano')) {
                celda = esNo(valor) ? `<span class="planos-no">${esc(valor)}</span>` : esc(valor || '-');
            } else if (kn.includes('cobertura') || kn.includes('seguro')) {
                celda = `<div class="cobertura-wrap">${formatearSeguro(valor)}` +
                    (bloqueDocs ? `<button type="button" class="btn-vermas" onclick="toggleDocs(this)">VER MÁS</button>` : '') +
                    `</div>`;
                if (bloqueDocs) filaExtra = `<tr id="fila-docs" class="fila-docs"><td colspan="2">${bloqueDocs}</td></tr>`;
            } else if (kn === 'propio/alquilado') {
                celda = `<span class="badge ${obtenerClaseBadge(valor)}">${esc(valor || 'N/A')}</span>`;
            } else {
                celda = esc(valor || '-');
            }
            return `<tr><th>${esc(k)}</th><td>${celda}</td></tr>${filaExtra}`;
        }).join('');

    document.getElementById('modal-body').innerHTML =
        `<h3>${esc(nombre)}</h3><table class="ficha-tabla">${filas}</table>`;
    document.getElementById('modal-ficha').classList.add('show');
}

function cerrarFicha() {
    document.getElementById('modal-ficha').classList.remove('show');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarFicha(); });

// ---------- CARGA DE DATOS ----------
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

function poblarDesplegable(idContenedor, ...posiblesColumnas) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    const opciones = [...new Set(datosLocaciones.map(item => getCampo(item, ...posiblesColumnas)).filter(Boolean))].sort();
    contenedor.innerHTML = '';
    opciones.forEach(opcion => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.innerHTML = `<input type="checkbox" value="${esc(opcion)}" onchange="alCambiarFiltro('${idContenedor}')"><span>${esc(opcion)}</span>`;
        contenedor.appendChild(label);
    });
}

function poblarSugerenciasAutocompletado() {
    const d1 = document.getElementById('sugerencias-espacio');
    const d2 = document.getElementById('sugerencias-direccion');
    if (d1) d1.innerHTML = [...new Set(datosLocaciones.map(i => getCampo(i, 'ESPACIO', 'Espacio')).filter(Boolean))].sort().map(e => `<option value="${esc(e)}">`).join('');
    if (d2) d2.innerHTML = [...new Set(datosLocaciones.map(i => getCampo(i, 'DIRECCION', 'Dirección', 'Direccion')).filter(Boolean))].sort().map(d => `<option value="${esc(d)}">`).join('');
}

function alCambiarFiltro(idContenedor) { actualizarTextoBoton(idContenedor); filtrarLocaciones(); }

function actualizarTextoBoton(idContenedor) {
    const checked = document.querySelectorAll(`#${idContenedor} input[type="checkbox"]:checked`);
    let idLabel = idContenedor.replace('dropdown-', 'label-');
    const el = document.getElementById(idLabel);
    if (!el) return;
    if (checked.length === 0) el.innerText = 'Todos / Todas';
    else if (checked.length === 1) el.innerText = checked[0].value;
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
        return (selSub.length === 0 || selSub.includes(vSub)) && (selReg.length === 0 || selReg.includes(vReg)) && (selPert.length === 0 || selPert.includes(vPert)) && (selSeg.length === 0 || selSeg.includes(vSeg)) && (!txtEsp || vEsp.toLowerCase().includes(txtEsp)) && (!txtDir || vDir.toLowerCase().includes(txtDir));
    });
    actualizarInterfaz(filtrados);
}

// ---------- MAPA Y LISTA ----------
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
        const seguroRaw = getCampo(loc, 'COBERTURA', 'Seguro') || 'Sin cobertura registrada';
        const sinSeguro = esSinSeguro(seguroRaw);
        const lat = formatearCoordenada(getCampo(loc, 'LATITUD', 'Latitud', 'Lat'));
        const lng = formatearCoordenada(getCampo(loc, 'LONGITUD', 'Longitud', 'Lng'));

        // Pin rojo si no tiene seguro; al hacer clic abre la ficha completa
        loc._marker = null;
        if (lat && lng) {
            const marker = L.marker([lat, lng], { icon: sinSeguro ? iconoRojo : iconoAzul });
            marker.on('click', () => abrirFicha(loc));
            capaMarcadores.addLayer(marker);
            loc._marker = marker;
            if (!primerPin) primerPin = [lat, lng];
        }

        // Tarjeta lateral
        if (contenedorLista) {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'list-item' + (sinSeguro ? ' sin-seguro' : '');
            tarjeta.innerHTML = `
                <h4>${esc(nombreEspacio)}</h4>
                <p>📍 <strong>Dirección:</strong> ${esc(direccion)}</p>
                <p>🏢 <strong>Subsecretaría:</strong> ${esc(subsecretaria)}</p>
                <p>📋 <strong>Régimen:</strong> ${esc(regimen)} (${esc(pertenencia)})</p>
                <p>🛡 <strong>Seguro:</strong> ${formatearSeguro(seguroRaw)}</p>
            `;
            tarjeta.onclick = () => {
                if (loc._marker) mapa.setView(loc._marker.getLatLng(), 16);
                abrirFicha(loc);
            };
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