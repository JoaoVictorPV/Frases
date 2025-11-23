document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/frases';
    const searchInput = document.getElementById('search-input');
    const resultadosContainer = document.getElementById('resultados-container');

    let todasAsFrases = [];

    // Carrega todas as frases da API
    async function carregarFrases() {
        try {
            resultadosContainer.innerHTML = '<p style="text-align:center; color:#95a5a6;">Carregando frases...</p>';
            
            // Tenta conectar na API (seja local ou Vercel)
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Erro na API');
            
            const dados = await response.json();
            processarDados(dados);
            
            resultadosContainer.innerHTML = '<p style="text-align:center; color:#95a5a6;">Digite algo acima para buscar.</p>';
        } catch (error) {
            console.error(error);
            resultadosContainer.innerHTML = '<p style="text-align:center; color:#e74c3c;">Erro ao carregar frases. Verifique a conexão.</p>';
        }
    }

    // Transforma a estrutura aninhada em um array plano para facilitar a busca
    function processarDados(dados) {
        todasAsFrases = [];
        
        for (const segId in dados) {
            const segmento = dados[segId];
            for (const estId in segmento.estruturas) {
                const estrutura = segmento.estruturas[estId];
                for (const alias in estrutura.frases) {
                    todasAsFrases.push({
                        alias: alias,
                        texto: estrutura.frases[alias],
                        segmentoNome: segmento.nome,
                        estruturaNome: estrutura.nome,
                        fullSearch: `${alias} ${segmento.nome} ${estrutura.nome} ${estrutura.frases[alias]}`.toLowerCase()
                    });
                }
            }
        }
    }

    // Filtra e renderiza os resultados
    function realizarBusca(termo) {
        if (!termo) {
            resultadosContainer.innerHTML = '<p style="text-align:center; color:#95a5a6;">Digite algo acima para buscar.</p>';
            return;
        }

        const termoLower = termo.toLowerCase();
        // Filtra as frases
        const resultados = todasAsFrases.filter(item => item.fullSearch.includes(termoLower));

        // Limita a exibição para não travar em caso de busca muito genérica (opcional, mas bom pra UX)
        renderizarResultados(resultados.slice(0, 50));
    }

    function renderizarResultados(lista) {
        resultadosContainer.innerHTML = '';

        if (lista.length === 0) {
            resultadosContainer.innerHTML = '<div class="no-results">Nenhuma frase encontrada.</div>';
            return;
        }

        lista.forEach(item => {
            const div = document.createElement('div');
            div.className = 'resultado-item';
            div.onclick = () => copiarFrase(item.texto, div);

            div.innerHTML = `
                <div class="resultado-header">
                    <span class="resultado-alias">${item.alias}</span>
                    <span class="resultado-meta">${item.segmentoNome} &bull; ${item.estruturaNome}</span>
                </div>
                <div class="resultado-texto">${item.texto}</div>
                <div class="copy-hint" style="text-align:right; margin-top:0.5rem;">Clique para copiar</div>
            `;
            resultadosContainer.appendChild(div);
        });
    }

    function copiarFrase(texto, elemento) {
        navigator.clipboard.writeText(texto).then(() => {
            // Feedback visual
            const originalColor = elemento.style.backgroundColor;
            elemento.classList.add('copiado');
            const hint = elemento.querySelector('.copy-hint');
            const originalText = hint.textContent;
            hint.textContent = 'Copiado!';
            hint.style.opacity = '1';

            setTimeout(() => {
                elemento.classList.remove('copiado');
                hint.textContent = originalText;
                hint.style.opacity = '';
            }, 1500);
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            alert('Não foi possível copiar automaticamente.');
        });
    }

    // Event Listener para Input (Debounce simples pode ser adicionado se necessário, mas com array local é rápido)
    searchInput.addEventListener('input', (e) => {
        realizarBusca(e.target.value);
    });

    // Inicia
    carregarFrases();
});
