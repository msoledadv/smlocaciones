// js/app.js

// 1. Inicializamos el mapa centrado (Ajustá estas coordenadas al centro de tu municipio)
const map = L.map('map').setView([-34.5478, -58.5810], 12); 

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markersGroup = L.layerGroup().addTo(map);
let locacionesData = []; 
let marcadoresActivos = {}; 

// 2. Carga del archivo CSV local
function cargarDatosDesdeCSV() {
    console.log("Intentando buscar el archivo 'locaciones.csv'...");

    fetch("locaciones.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error(`No se encontró el archivo 'locaciones.csv'. Estado: ${response.status}`);
            }
            return response.text();
        })
        .then(textoCSV => {
            document.getElementById("status-box").innerText = "Procesando CSV...";
            
            Papa.parse(textoCSV, {
                header: true,
                delimiter: ";", // Formato típico de punto y coma de Excel en español
                skipEmptyLines: true,
                complete: function(results) {
                    locacionesData = results.data;
                    
                    if (locacionesData.length > 0) {
                        console.log("Columnas reales detectadas:", Object.keys(locacionesData[0]));
                        
                        // Generamos los filtros desplegables dinámicamente con los datos reales
                        generarFiltrosDinamicos();
                        
                        document.getElementById("status-box").innerText = `Datos listos. Registros: ${locacionesData.length}`;
                    } else {
                        document.getElementById("status-box").innerText = "El CSV está vacío.";
                    }
                    
                    filtrarLocaciones();
                }
            });
        })
        .catch(error => {
            document.getElementById("status-box").innerText = "Error de carga.";
            alert(`⚠️ ERROR DE CARGA:\n${error.message}`);
        });
}

// 3. Extracción de valores únicos del CSV para armar las opciones de los selectores
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
    datalist.innerHTML = ""; 
    Array.from(conjuntoValores).sort().forEach(valor => {
        if(valor !== "") {
            const opcion = document.createElement("option");
            opcion.value = valor;
            datalist.appendChild(opcion);
        }
    });
}

// Función interactiva: enfoca el mapa al hacer clic en un elemento de la lista derecha
function enfocarLocacion(id) {
    const marker = marcadoresActivos[id];
    if (marker) {
        map.setView(marker.getLatLng(), 15);
        marker.openPopup();
    }
}

// 4. Lógica de Filtrado y Renderizado de Pines e inyección en panel lateral
function filtrarLocaciones() {
    markersGroup.clearLayers();
    marcadoresActivos = {}; 
    
    const contenedorLista = document.getElementById("contenedor-lista");
    contenedorLista.innerHTML = ""; 

    // Valores seleccionados en los filtros del HTML
    const fSubsec = document.getElementById('filter-subsecretaria').value;
    const fRegimen = document.getElementById('filter-regimen').value;
    const fPertenencia = document.getElementById('filter-pertenencia').value;
    const fSeguro = document.getElementById('filter-seguro').value;

    // Texto copiado en los buscadores abiertos
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

        // Cruzamos las condiciones de los selectores
        const matchSubsec = (fSubsec === 'todos' || subsecretariaCelda === fSubsec);
        const matchRegimen = (fRegimen === 'todos' || regimenCelda === fRegimen);
        const matchPertenencia = (fPertenencia === 'todos' || pertenenciaCelda === fPertenencia);
        const matchSeguro = (fSeguro === 'todos' || seguroCelda === fSeguro);
        
        // Cruzamos las condiciones de las barras de búsqueda por texto
        const matchEspacioTexto = (sEspacio === "" || espacioCelda.toLowerCase().includes(sEspacio));
        const matchDireccionTexto = (sDireccion === "" || direccionCelda.toLowerCase().includes(sDireccion));

        // Leemos las coordenadas limpias
        let latRaw = loc["LATITUD"] ? loc["LATITUD"].toString().replace(',', '.') : "";
        let lngRaw = loc["LONGITUD"] ? loc["LONGITUD"].toString().replace(',', '.') : "";
        
        const lat = parseFloat(latRaw);
        const lng = parseFloat(lngRaw);

        // Si pasa todos los filtros, dibujamos la ficha catastral en el mapa y en la lista
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

                // Creamos el pin en el mapa
                const m = L.marker([lat, lng]).bindPopup(popupHTML).addTo(markersGroup);
                marcadoresActivos[idUnico] = m;
                
                // INYECTAMOS LA TARJETA EN LA LISTA DERECHA INCLUYENDO EL CAMPO SEGURO
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

                if (!primerPinValido) primerPinValido = [lat, lng];
                contadorPines++;
            }
        }
    });

    // Actualizamos el número del contador flotante
    document.getElementById("contador-resultados").innerText = contadorPines;

    if (primerPinValido) {
        map.panTo(primerPinValido);
    }
    console.log(`Pines renderizados con los criterios actuales: ${contadorPines}`);
}

cargarDatosDesdeCSV();