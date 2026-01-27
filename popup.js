document.addEventListener('DOMContentLoaded', function() {
    
 
    let geoJsonData = null;  
    let geoJsonUBS = null;   
 
    const arquivoUVIS = 'Territórios_UVIS.geojson'; 
    const arquivoUBS = 'Territorios_UBS.geojson';

    const btn = document.getElementById('btn-consultar');
    const loading = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    
 
    const cepInput = document.getElementById('cep');
    const logradouroInput = document.getElementById('logradouro');
    const numeroInput = document.getElementById('numero');

 
    let cidadeViaCEP = ""; 
    let bairroViaCEP = "";

 
    Promise.all([
        fetch(chrome.runtime.getURL(arquivoUVIS)).then(r => r.json()),
        fetch(chrome.runtime.getURL(arquivoUBS)).then(r => r.json())
    ])
    .then(([dataUVIS, dataUBS]) => {
        geoJsonData = dataUVIS;
        geoJsonUBS = dataUBS;
        console.log("Bases carregadas.");
        if (btn) {
            btn.innerText = "🔍 CONSULTAR";
            btn.disabled = false;
        }
    })
    .catch(err => {
        console.error(err);
        mostrarErro("Erro ao carregar arquivos GeoJSON. Verifique se os arquivos estão na pasta da extensão.");
    });

 
    
 
    if(cepInput) {
        cepInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2');
            e.target.value = value;

 
            if (value.replace(/\D/g, '').length === 8) {
                preencherEnderecoPeloCEP(value.replace(/\D/g, ''));
            }
        });
    }

 
    if(logradouroInput) {
        logradouroInput.addEventListener('input', function() {
            if(cepInput.value !== "") {
                cepInput.value = "";
                cidadeViaCEP = ""; 
            }
        });
    }

 
    if(btn) btn.addEventListener('click', buscarEndereco);
    
 
    document.getElementById('btn-limpar').addEventListener('click', function() {
        if(cepInput) cepInput.value = "";
        if(logradouroInput) logradouroInput.value = "";
        if(numeroInput) numeroInput.value = "";
        resultsDiv.style.display = 'none';
        cidadeViaCEP = "";
        bairroViaCEP = "";
    });

 
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function (e) { 
            if (e.key === 'Enter') buscarEndereco(); 
        });
    });

 

    async function preencherEnderecoPeloCEP(cep) {
        try {
            logradouroInput.placeholder = "Buscando...";
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                logradouroInput.value = data.logradouro;
                cidadeViaCEP = data.localidade;
                bairroViaCEP = data.bairro;
 
                if(numeroInput) numeroInput.focus();
            } else {
                logradouroInput.placeholder = "CEP não encontrado";
            }
        } catch (error) {
            console.error(error);
            logradouroInput.placeholder = "Erro na busca";
        }
    }

    async function buscarEndereco() {
        if (!geoJsonData) return mostrarErro("Aguarde o carregamento das bases.");

        let cep = cepInput.value.replace(/\D/g, '');
        let logradouro = logradouroInput.value.trim();
        let numero = numeroInput.value.trim();

        if (logradouro === "") return mostrarErro("Preencha o logradouro.");

        loading.style.display = 'block';
        resultsDiv.style.display = 'none';

 
        if (cep.length === 8 && cidadeViaCEP === "") {
            await preencherEnderecoPeloCEP(cep);
            logradouro = logradouroInput.value;
        }

 
        let query = `${logradouro}`;
        if (numero !== "") query += `, ${numero}`;
        
 
        const cidadeAlvo = cidadeViaCEP !== "" ? cidadeViaCEP : "São Paulo";
        query += `, ${cidadeAlvo}, Brazil`;

        const params = new URLSearchParams({
            format: 'json',
            limit: 1,
            q: query,
            addressdetails: 1
        });

 
        if (cidadeAlvo === "São Paulo") {
            params.append('viewbox', '-47.20,-23.10,-46.10,-24.00'); 
            params.append('bounded', '1'); 
        }

        fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.length > 0) {
                    processarResultado(data[0]);
                } else {
 
                    if(numero !== "") {
                        fazerBuscaSemNumero(logradouro, cidadeAlvo);
                    } else {
                        loading.style.display = 'none';
                        mostrarErro("Endereço não localizado.");
                    }
                }
            })
            .catch(err => {
                loading.style.display = 'none';
                mostrarErro("Erro de conexão com o mapa.");
            });
    }

    function fazerBuscaSemNumero(logradouro, cidadeAlvo) {
        const query = `${logradouro}, ${cidadeAlvo}, Brazil`;
        const params = new URLSearchParams({
            format: 'json',
            limit: 1,
            q: query,
            addressdetails: 1
        });

        if (cidadeAlvo === "São Paulo") {
            params.append('viewbox', '-47.20,-23.10,-46.10,-24.00'); 
            params.append('bounded', '1'); 
        }

        fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.length > 0) {
                    processarResultado(data[0]);
                } else {
                    loading.style.display = 'none';
                    mostrarErro("Rua não localizada.");
                }
            });
    }

    function processarResultado(item) {
        try {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const addr = item.address || {};

 
            setText('res-log', `${logradouroInput.value}, ${numeroInput.value}`);
            setText('res-bairro', cidadeViaCEP !== "" ? bairroViaCEP : (addr.suburb || addr.neighbourhood || "-"));
            setText('res-cidade', cidadeViaCEP !== "" ? cidadeViaCEP : (addr.city || addr.town || "São Paulo"));
            setText('res-cep', cepInput.value || addr.postcode || "-");

 
            if (typeof turf === 'undefined') {
                throw new Error("Biblioteca Turf.js não carregada.");
            }

            const ponto = turf.point([lon, lat]);
            let uvisEncontrada = "Fora da área mapeada";
            let daEncontrada = "-";
            let ubsEncontrada = "Não identificada";

 
            turf.featureEach(geoJsonData, function (feat) {
                if (turf.booleanPointInPolygon(ponto, feat)) {
                    const props = feat.properties;
                    
 
                    for (const [key, val] of Object.entries(props)) {
                        const k = key.toLowerCase();
                        
 
                        if (k.includes('uvis') && !k.includes('endereco') && !k.includes('logradouro')) {
 
                             if (k.includes('nome') || k.includes('nm')) {
                                 uvisEncontrada = val;
                             } 
 
                             else if (uvisEncontrada === "Fora da área mapeada" && isNaN(val)) {
                                 uvisEncontrada = val;
                             }
                        }

                        if ((k.includes('da') || k.includes('distrito')) && isNaN(val)) daEncontrada = val;
                    }
                }
            });

 
            if (geoJsonUBS) {
                turf.featureEach(geoJsonUBS, function (feat) {
                    if (turf.booleanPointInPolygon(ponto, feat)) {
                        const p = feat.properties;
                        ubsEncontrada = p.Name || p.name || p.NOME || p.NO_FANTASIA || "Sem Nome";
                    }
                });
            }

 
            setText('res-uvis', uvisEncontrada);
            setText('res-da', daEncontrada);
            
            const ubsEl = document.getElementById('res-ubs');
            if (ubsEncontrada !== "Não identificada") {
                ubsEl.style.color = "#198754";
                ubsEl.innerText = ubsEncontrada;
            } else {
                ubsEl.style.color = "#6c757d";
                ubsEl.innerText = (uvisEncontrada !== "Fora da área mapeada") 
                    ? "Endereço na área, mas sem UBS vinculada" 
                    : "Fora da área de cobertura";
                
                if (uvisEncontrada !== "Fora da área mapeada") {
                    ubsEl.style.color = "#ffc107";  
                }
            }

            loading.style.display = 'none';
            resultsDiv.style.display = 'block';

        } catch (e) {
            console.error(e);
            mostrarErro("Erro ao processar dados: " + e.message);
        }
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if(el) el.innerText = text;
    }

    function mostrarErro(msg) {
        loading.style.display = 'block';
        loading.style.color = 'red';
        loading.innerText = msg;
    }

 
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const el = document.getElementById(targetId);
            if(el) {
                navigator.clipboard.writeText(el.innerText).then(() => {
                    const original = this.innerText;
                    this.innerText = "✓";
                    setTimeout(() => { this.innerText = original; }, 1500);
                });
            }
        });
    });
});