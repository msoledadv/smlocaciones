// js/app.js

let mapa;
let capaMarcadores;
let datosLocaciones = [];

// Inicialización cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
    inicializarMapa();
    cargarDatosCSV();
});

// Configuración inicial del mapa
function inicializarMapa() {
    mapa = L.map('map').setView([-34.575, -58.535], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapa);

    capaMarcadores = L.layerGroup().addTo(mapa);
}

// Función auxiliar para leer campos del CSV sin importar mayúsculas, minúsculas o tildes
function getCampo(obj, ...posiblesNombres) {
    if (!obj) return '';
    const keys = Object.keys(obj);
    for (let nombre of posiblesNombres) {
        const match = keys.find(k => k.trim().toLowerCase() === nombre.toLowerCase());
        if (match && obj[match] !== undefined && obj[match] !== null) {
            return obj[match].toString().trim();
        }
    }
    return '';
}

// Parsea coordenadas para corregir problemas de formato en Excel
function formatearCoordenada(valor) {
    if (!valor) return null;
    let str = valor.toString().trim().replace(/,/g, '.').replace(/\./g, '');
    if (!str || str === '-') return null;

    if (!str.startsWith('-')) str = '-' + str;
    if (str.length > 3) str = str.substring(0, 3) + '.' + str.substring(3);
    
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

// Carga y parseo del archivo CSV
function cargarDatosCSV() {
    Papa.parse('locaciones.csv', {
        download: true,
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        complete: function(results) {
            datosLocaciones = results.data;
            
            const statusBox = document.getElementById('status-box');
            if (statusBox) {
                statusBox.innerText = `${datosLocaciones.length} locaciones cargadas`;
            }
            
            poblarFiltrosMultiselect();
            poblarSugerenciasAutocompletado();
            filtrarLocaciones();
        },
        error: function(err) {
            console.error('Error al cargar el CSV:', err);
            const statusBox = document.getElementById('status-box');
            if (statusBox) {
                statusBox.innerText = 'Error al cargar los datos';
            }
        }
    });
}

// Llena los desplegables con checkboxes a partir de los datos del CSV
function poblarFiltrosMultiselect() {
    poblarDesplegable('dropdown-subsecretaria', 'SUBSECRETARÍA', 'Subsecretaria', 'Subsecretaría');
    poblarDesplegable('dropdown-regimen', 'PROPIO/ALQUILADO', 'Régimen', 'Regimen');
    poblarDesplegable('dropdown-pertenencia', 'PROPIO/ALQUILADO - Copia', 'Pertenencia', 'Titular');
    poblarDesplegable('dropdown-seguro', 'COBERTURA', 'Seguro', 'Cobertura de Seguro');
}

function poblarDesplegable(idContenedor, ...posiblesColumnas) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    const opciones = [...new Set(
        datosLocaciones
            .map(item => getCampo(item, ...posiblesColumnas))
            .filter(val => val !== '')
    )].sort();

    contenedor.innerHTML = '';

    opciones.forEach(opcion => {
        const itemLabel = document.createElement('label');
        itemLabel.className = 'dropdown-item';
        
        itemLabel.innerHTML = `
            <input type="checkbox" value="${opcion}" onchange="alCambiarFiltro('${idContenedor}')">
            <span>${opcion}</span>
        `;
        contenedor.appendChild(itemLabel);
    });
}

// Carga opciones en los datalist para autocompletar espacios y direcciones
function poblarSugerenciasAutocompletado() {
    const datalistEspacio = document.getElementById('sugerencias-espacio');
    const datalistDireccion = document.getElementById('sugerencias-direccion');

    if (datalistEspacio) {
        const espacios = [...new Set(datosLocaciones.map(item => getCampo(item, 'ESPACIO', 'Espacio')).filter(Boolean))].sort();
        datalistEspacio.innerHTML = espacios.map(e => `<option value="${e}">`).join('');
    }

    if (datalistDireccion) {
        const direcciones = [...new Set(datosLocaciones.map(item => getCampo(item, 'DIRECCION', 'Dirección', 'Direccion')).filter(Boolean))].sort();
        datalistDireccion.innerHTML = direcciones.map(d => `<option value="${d}">`).join('');
    }
}

// Actualiza etiqueta del botón y aplica el filtro
function alCambiarFiltro(idContenedor) {
    actualizarTextoBoton(idContenedor);
    filtrarLocaciones();
}

// Cambia el texto del botón según la cantidad de ítems seleccionados
function actualizarTextoBoton(idContenedor) {
    const checked = document.querySelectorAll(`#${idContenedor} input[type="checkbox"]:checked`);
    let idLabel = '';

    if (idContenedor === 'dropdown-subsecretaria') idLabel = 'label-subsecretaria';
    if (idContenedor === 'dropdown-regimen') idLabel = 'label-regimen';
    if (idContenedor === 'dropdown-pertenencia') idLabel = 'label-pertenencia';
    if (idContenedor === 'dropdown-seguro') idLabel = 'label-seguro';

    const labelElement = document.getElementById(idLabel);
    if (!labelElement) return;

    if (checked.length === 0) {
        labelElement.innerText = 'Todos / Todas';
    } else if (checked.length === 1) {
        labelElement.innerText = checked[0].value;
    } else {
        labelElement.innerText = `${checked.length} seleccionados`;
    }
}

// Función principal de filtrado
function filtrarLocaciones() {
    if (!datosLocaciones || datosLocaciones.length === 0) return;

    const getCheckedValues = (id) => {
        const inputs = document.querySelectorAll(`#${id} input[type="checkbox"]:checked`);
        return inputs ? Array.from(inputs).map(c => c.value) : [];
    };

    const selSubsecretaria = getCheckedValues('dropdown-subsecretaria');
    const selRegimen = getCheckedValues('dropdown-regimen');
    const selPertenencia = getCheckedValues('dropdown-pertenencia');
    const selSeguro = getCheckedValues('dropdown-seguro');

    const inputEspacio = document.getElementById('search-espacio');
    const inputDireccion = document.getElementById('search-direccion');

    const textEspacio = inputEspacio ? inputEspacio.value.toLowerCase().trim() : '';
    const textDireccion = inputDireccion ? inputDireccion.value.toLowerCase().trim() : '';

    const filtrados = datosLocaciones.filter(item => {
        const valSub = getCampo(item, 'SUBSECRETARÍA', 'Subsecretaria', 'Subsecretaría');
        const valReg = getCampo(item, 'PROPIO/ALQUILADO', 'Régimen', 'Regimen');
        const valPert = getCampo(item, 'PROPIO/ALQUILADO - Copia', 'Pertenencia', 'Titular');
        const valSeg = getCampo(item, 'COBERTURA', 'Seguro', 'Cobertura de Seguro');

        const valEspacio = getCampo(item, 'ESPACIO', 'Espacio');
        const valDireccion = getCampo(item, 'DIRECCION', 'Dirección', 'Direccion');

        const matchSub = selSubsecretaria.length === 0 || selSubsecretaria.includes(valSub);
        const matchReg = selRegimen.length === 0 || selRegimen.includes(valReg);
        const matchPert = selPertenencia.length === 0 || selPertenencia.includes(valPert);
        const matchSeg = selSeguro.length === 0 || selSeguro.includes(valSeg);

        const matchEspacio = !textEspacio || valEspacio.toLowerCase().includes(textEspacio);
        const matchDireccion = !textDireccion || valDireccion.toLowerCase().includes(textDireccion);

        return matchSub && matchReg && matchPert && matchSeg && matchEspacio && matchDireccion;
    });

    actualizarInterfaz(filtrados);
}

// Redibuja los marcadores en el mapa y la lista lateral derecha
function actualizarInterfaz(locaciones) {
    capaMarcadores.clearLayers();
    
    // Soporte para ambos IDs de contenedor de lista (según la versión del HTML)
    const contenedorLista = document.getElementById('locations-list') || document.getElementById('contenedor-lista');
    if (contenedorLista) contenedorLista.innerHTML = '';

    const contadorBadge = document.getElementById('total-count') || document.getElementById('contador-resultados');
    if (contadorBadge) contadorBadge.innerText = locaciones.length;

    let primerPinValido = null;

    locaciones.forEach(loc => {
        const nombreEspacio = getCampo(loc, 'ESPACIO', 'Espacio') || 'Sin Nombre';
        const direccion = getCampo(loc, 'DIRECCION', 'Dirección', 'Direccion') || 'Sin dirección';
        const subsecretaria = getCampo(loc, 'SUBSECRETARÍA', 'Subsecretaria', 'Subsecretaría') || '-';
        const regimen = getCampo(loc, 'PROPIO/ALQUILADO', 'Régimen', 'Regimen') || 'N/A';
        const pertenencia = getCampo(loc, 'PROPIO/ALQUILADO - Copia', 'Pertenencia') || '-';
        const seguro = getCampo(loc, 'COBERTURA', 'Seguro') || 'Sin cobertura registrada';

        const lat = formatearCoordenada(getCampo(loc, 'LATITUD', 'Latitud', 'Lat'));
        const lng = formatearCoordenada(getCampo(loc, 'LONGITUD', 'Longitud', 'Lng'));

        if (lat && lng) {
            const popupHTML = `
                <div class="popup-ficha">
                    <h3>${nombreEspacio}</h3>
                    <p><strong>Dirección:</strong> ${direccion}</p>
                    <p><strong>Subsecretaría:</strong> ${subsecretaria}</p>
                    <p><strong>Régimen:</strong> <span class="badge ${obtenerClaseBadge(regimen)}">${regimen}</span></p>
                    <p><strong>Pertenencia / Titular:</strong> ${pertenencia}</p>
                    <p><strong>Inventario:</strong> ${getCampo(loc, 'INVENTARIO ', 'INVENTARIO') || '-'}</p>
                    <p><strong>Partida ALSMI:</strong> ${getCampo(loc, 'PARTIDA ALSMI') || '-'}</p>
                    <p><strong>Partida ARBA:</strong> ${getCampo(loc, 'PARTIDA ARBA') || '-'}</p>
                    
                    <table class="tabla-catastro">
                        <thead>
                            <tr><th>C</th><th>S</th><th>Fr.</th><th>Mz.</th><th>Parc.</th><th>Subp.</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${getCampo(loc, 'C') || '-'}</td>
                                <td>${getCampo(loc, 'S') || '-'}</td>
                                <td>${getCampo(loc, 'FR.') || '-'}</td>
                                <td>${getCampo(loc, 'MANZANA', 'Mz') || '-'}</td>
                                <td>${getCampo(loc, 'PARCELA', 'Parc') || '-'}</td>
                                <td>${getCampo(loc, 'SUBP.') || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <p><strong>Seguro:</strong> ${seguro}</p>
                </div>
            `;

            const marker = L.marker([lat, lng]).bindPopup(popupHTML);
            capaMarcadores.addLayer(marker);
            loc._marker = marker;

            if (!primerPinValido) primerPinValido = [lat, lng];
        }

        if (contenedorLista) {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'list-item';
            tarjeta.innerHTML = `
                <h4>${nombreEspacio}</h4>
                <p>📍 <strong>Dirección:</strong> ${direccion}</p>
                <p>🏢 <strong>Subsecretaría:</strong> ${subsecretaria}</p>
                <p>📋 <strong>Régimen:</strong> ${regimen} (${pertenencia})</p>
                <p>🛡️ <strong>Seguro:</strong> ${seguro}</p>
            `;

            tarjeta.onclick = () => {
                if (loc._marker) {
                    mapa.setView(loc._marker.getLatLng(), 16);
                    loc._marker.openPopup();
                }
            };

            contenedorLista.appendChild(tarjeta);
        }
    });

    if (primerPinValido && mapa) {
        mapa.panTo(primerPinValido);
    }
}

// Devuelve la clase CSS para el badge de color según el régimen
function obtenerClaseBadge(regimen) {
    if (!regimen) return 'otros';
    const reg = regimen.toLowerCase();
    if (reg.includes('propio')) return 'propio';
    if (reg.includes('alquiler') || reg.includes('alquilado')) return 'alquiler';
    if (reg.includes('comodato')) return 'comodato';
    if (reg.includes('ceamse')) return 'ceamse';
    if (reg.includes('ferrocarril')) return 'ferrocarril';
    return 'otros';
}