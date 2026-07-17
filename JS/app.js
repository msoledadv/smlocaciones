// js/app.js - Versión de Diagnóstico Avanzado para GitHub Pages

let map;
let markersGroup;
let locacionesData = []; 
let marcadoresActivos = {}; 

// Ponemos la inicialización en una función segura para que si algo falla, sepamos qué fue
function inicializarMapa() {
    try {
        console.log("Inicializando Leaflet...");
        map = L.map('map').setView([-34.5478, -58.5810], 12); 

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        markersGroup = L.layerGroup().addTo(map);
        console.log("Mapa e infraestructura listos.");
        
        // Una vez que el mapa base levantó de forma segura, llamamos al CSV
        cargarDatosDesdeCSV();
    } catch (error) {
        document.getElementById("status-box").innerText = "Error al iniciar mapa base.";
        console.error("Error crítico en Leaflet:", error);
        alert("⚠️ Error al cargar el mapa base de OpenStreetMap. Revisá la consola (F12).");
    }
}

function cargarDatosDesdeCSV() {
    // Calculamos la ruta absoluta exacta para evitar problemas de subcarpetas en GitHub
    const urlBase = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const urlCompletaCSV = window.location.origin + urlBase + "/locaciones.csv";
    
    console.log("Buscando CSV en:", urlCompletaCSV);

    fetch(urlCompletaCSV)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Estado HTTP: ${response.status}`);
            }
            return response.text();
        })
        .then(textoCSV => {
            document.getElementById("status-box").innerText = "Procesando CSV...";
            
            Papa.parse(textoCSV, {
                header: true,
                delimiter: ";", 
                skipEmptyLines: true,
                complete: function(results) {
                    locacionesData = results.data;
                    
                    if (locacionesData.length > 0) {
                        console.log("Columnas detectadas:", Object.keys(locacionesData[0]));
                        generarFiltrosDinamicos();
                        document.getElementById("status-box").innerText = `Datos listos. Registros: ${locacionesData.length}`;
                    } else {
                        document.getElementById("status-box").innerText = "El CSV está vacío o mal formateado.";
                    }
                    
                    filtrarLocaciones();
                }
            });
        })
        .catch(error => {
            document.getElementById("status-box").innerText = "Error al abrir archivo CSV.";
            console.error("Error en Fetch/PapaParse:", error);
        });
}

function generarFiltrosDinamicos() {
    const subsecretarias = new Set();
    const regimenes = new Set();
    const pertenencias = new Set();
    const seguros = new Set();
    const espaciosUnicos = new Set();
    const direccionesUnicas = new Set();

    locacionesData.forEach(loc => {
        if (loc["SUBSECRETARÍA"]) subsecretarias.add(loc["SUBSECRETARÍA"].trim());
        if (loc["PROPIO/ALQUILADO"]) regimenes.add(loc["PROPIO/ALQUILADO"].trim());
        if (loc["PROPIO/ALQUILADO - Copia"]) pertenencias.add(loc["PROPIO/ALQUILADO - Copia"].trim());
        if (loc["COBERTURA"]) seguros.add(loc["COBERTURA"].trim());
        if (loc["ESPACIO"]) espaciosUnicos.add(loc["ESPACIO"].trim());
        if (loc["DIRECCION"]) direccionesUnicas.add(loc["DIRECCION"].trim());
    });

    llenarSelect("filter-subsecretaria", subsecretarias);
    llenarSelect("filter-regimen", regimenes);
    llenarSelect("filter-pertenencia", pertenencias);
    llenarSelect("filter-seguro", seguros);
    llenarDatalist("sugerencias-espacio", espaciosUnicos);
    llenarDatalist("sugerencias-direccion", direccionesUnicas);
}

function llenarSelect(idSelect, conjuntoValores) {
    const select = document.getElementById(idSelect);
    if (!select) return;
    select.innerHTML = `<option value="todos">${select.id === 'filter-seguro' ? 'Todas las Coberturas' : (select.id === 'filter-subsecretaria' ? 'Todas' : 'Todos')}</option>`;
    
    Array.from(conjuntoValores).sort().forEach(valor => {
        if(valor !== "") {
            const el = document.createElement("option");
            el.value = valor;
            el.textContent = valor;
            select.appendChild(el);
        }
    });
}

function llenarDatalist(idDatalist, conjuntoValores) {
    const datalist = document.getElementById(idDatalist);
    if (!datalist) return;
    datalist.innerHTML = ""; 
    Array.from(conjuntoValores).sort().forEach(valor => {
        if(valor !== "") {
            const opcion = document.createElement("option");
            opcion.value = valor;
            datalist.appendChild(opcion);
        }
    });
}

function enfocarLocacion(id) {
    const marker = marcadoresActivos[id];
    if (marker && map) {
        map.setView(marker.getLatLng(), 15);
        marker.openPopup();
    }
}

function filtrarLocaciones() {
    if (!markersGroup) return;
    markersGroup.clearLayers();
    marcadoresActivos = {}; 
    
    const contenedorLista = document.getElementById("contenedor-lista");
    if (contenedorLista) contenedorLista.innerHTML = ""; 

    const fSubsec = document.getElementById('filter-subsecretaria').value;
    const fRegimen = document.getElementById('filter-regimen').value;
    const fPertenencia = document.getElementById('filter-pertenencia').value;
    const fSeguro = document.getElementById('filter-seguro').value;

    const sEspacio = document.getElementById('search-espacio').value.toLowerCase().trim();
    const sDireccion = document.getElementById('search-direccion').value.toLowerCase().trim();

    let contadorPines = 0;
    let primerPinValido = null;

    locacionesData.forEach((loc, index) => {
        const subsecretariaCelda = loc["SUBSECRETARÍA"] ? loc["SUBSECRETARÍA"].trim() : "";
        const regimenCelda = loc["PROPIO/ALQUILADO"] ? loc["PROPIO/ALQUILADO"].trim() : "";
        const pertenenciaCelda = loc["PROPIO/ALQUILADO - Copia"] ? loc["PROPIO/ALQUILADO - Copia"].trim() : "";
        const seguroCelda = loc["COBERTURA"] ? loc["COBERTURA"].trim() : "";
        
        const espacioCelda = loc["ESPACIO"] ? loc["ESPACIO"].trim() : "Sin Nombre";
        const direccionCelda = loc["DIRECCION"] ? loc["DIRECCION"].trim() : "No informada";

        const matchSubsec = (fSubsec === 'todos' || subsecretariaCelda === fSubsec);
        const matchRegimen = (fRegimen === 'todos' || regimenCelda === fRegimen);
        const matchPertenencia = (fPertenencia === 'todos' || pertenenciaCelda === fPertenencia);
        const matchSeguro = (fSeguro === 'todos' || seguroCelda === fSeguro);
        
        const matchEspacioTexto = (sEspacio === "" || espacioCelda.toLowerCase().includes(sEspacio));
        const matchDireccionTexto = (sDireccion === "" || direccionCelda.toLowerCase().includes(sDireccion));

        let latRaw = loc["LATITUD"] ? loc["LATITUD"].toString().replace(',', '.') : "";
        let lngRaw = loc["LONGITUD"] ? loc["LONGITUD"].toString().replace(',', '.') : "";
        
        const lat = parseFloat(latRaw);
        const lng = parseFloat(lngRaw);

        if (matchSubsec && matchRegimen && matchPertenencia && matchSeguro && matchEspacioTexto && matchDireccionTexto) {
            if (!isNaN(lat) && !isNaN(lng)) {
                
                let badgeColorClass = regimenCelda.toLowerCase().replace(" ", "-");
                if (!['propio', 'alquiler', 'comodato', 'ceamse', 'ferrocarril'].includes(badgeColorClass)) {
                    badgeColorClass = 'otros';
                }
                
                const idUnico = "loc-" + index;

                const popupHTML = `
                    <div class="popup-ficha">
                        <h3>${espacioCelda}</h3>
                        <p><strong>Dirección:</strong> ${direccionCelda}</p>
                        <p><strong>Subsecretaría:</strong> ${subsecretariaCelda}</p>
                        <p><strong>Régimen:</strong> <span class="badge ${badgeColorClass}">${regimenCelda}</span></p>
                        <p><strong>Pertenencia / Titular:</strong> ${pertenenciaCelda || '-'}</p>
                        <p><strong>Inventario:</strong> ${loc["INVENTARIO "] || '-'}</p>
                        <p><strong>Partida ALSMI:</strong> ${loc["PARTIDA ALSMI"] || '-'}</p>
                        <p><strong>Partida ARBA:</strong> ${loc["PARTIDA ARBA"] || '-'}</p>
                        
                        <table class="tabla-catastro">
                            <thead>
                                <tr><th>C</th><th>S</th><th>Fr.</th><th>Mz.</th><th>Parc.</th><th>Subp.</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${loc["C"] || '-'}</td>
                                    <td>${loc["S"] || '-'}</td>
                                    <td>${loc["FR."] || '-'}</td>
                                    <td>${loc["MANZANA"] || '-'}</td>
                                    <td>${loc["PARCELA"] || '-'}</td>
                                    <td>${loc["SUBP."] || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <p><strong>Seguro:</strong> ${seguroCelda || 'Sin cobertura registrada'}</p>
                    </div>
                `;

                const m = L.marker([lat, lng]).bindPopup(popupHTML).addTo(markersGroup);
                marcadoresActivos[idUnico] = m;
                
                if (contenedorLista) {
                    const itemHTML = `
                        <div class="list-item" style="border-left-color: ${badgeColorClass === 'propio' ? '#10b981' : (badgeColorClass === 'alquiler' ? '#f59e0b' : '#3b82f6')};" onclick="enfocarLocacion('${idUnico}')">
                            <h4>${espacioCelda}</h4>
                            <p>📍 <strong>Dirección:</strong> ${direccionCelda}</p>
                            <p>🏢 <strong>Subsecretaría:</strong> ${subsecretariaCelda}</p>
                            <p>📋 <strong>Régimen:</strong> ${regimenCelda} (${pertenenciaCelda || '-'})</p>
                            <p>🛡️ <strong>Seguro:</strong> ${seguroCelda || 'Sin cobertura registrada'}</p>
                        </div>
                    `;
                    contenedorLista.insertAdjacentHTML('beforeend', itemHTML);
                }

                if (!primerPinValido) primerPinValido = [lat, lng];
                contadorPines++;
            }
        }
    });

    const badgContador = document.getElementById("contador-resultados");
    if (badgContador) badgContador.innerText = contadorPines;

    if (primerPinValido && map) {
        map.panTo(primerPinValido);
    }
}

// Arrancamos el mapa de forma segura al cargar la ventana
window.onload = inicializarMapa;
