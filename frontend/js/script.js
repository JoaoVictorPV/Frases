document.addEventListener('DOMContentLoaded', () => {
    // Usa caminho relativo para funcionar tanto local quanto na Vercel
    const API_URL = '/api/frases';

    const form = document.getElementById('form-adicionar-frase');
    const selectSegmento = document.getElementById('select-segmento');
    const selectEstrutura = document.getElementById('select-estrutura');
    const acervoContainer = document.getElementById('acervo-container');
    const mensagemSucesso = document.getElementById('mensagem-sucesso');
    const grupoLetraManual = document.getElementById('grupo-letra-manual');
    const inputLetraManual = document.getElementById('input-letra-manual');
    const radiosTipo = document.querySelectorAll('input[name="tipo"]');
    const contadorFrasesContainer = document.getElementById('contador-frases');

    let dadosFrases = {};
    let filtrosAnteriores = { segmento: '', estrutura: '' };

    // Função para carregar e renderizar todas as frases
    async function carregarAcervo() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error('Erro ao carregar os dados do acervo.');
            }
            dadosFrases = await response.json();
            
            renderizarAcervo();
            preencherSelectSegmento();
        } catch (error) {
            console.error('Falha na requisição:', error);
            acervoContainer.innerHTML = '<p>Não foi possível carregar o acervo. Verifique se o servidor está rodando.</p>';
        }
    }

    // Função para renderizar o acervo na tela
    function renderizarAcervo() {
        acervoContainer.innerHTML = '';
        let totalFrases = 0;
        const contagemSegmentos = {};

        const sortedSegmentos = Object.keys(dadosFrases).sort();

        for (const segmentoId of sortedSegmentos) {
            const segmento = dadosFrases[segmentoId];
            let frasesNoSegmento = 0;

            const segmentoItem = document.createElement('div');
            segmentoItem.className = 'segmento-item';

            const segmentoHeader = document.createElement('div');
            segmentoHeader.className = 'segmento-header';
            segmentoHeader.textContent = `${segmento.nome} (${segmentoId})`;

            const estruturaContent = document.createElement('div');
            estruturaContent.className = 'estrutura-content';

            const sortedEstruturas = Object.keys(segmento.estruturas).sort((a, b) => a - b);

            for (const estruturaId of sortedEstruturas) {
                const estrutura = segmento.estruturas[estruturaId];
                const frasesOrdenadas = Object.entries(estrutura.frases).sort((a, b) => a[0].localeCompare(b[0]));

                if (frasesOrdenadas.length > 0) {
                    const estruturaTitulo = document.createElement('h4');
                    estruturaTitulo.textContent = estrutura.nome;
                    estruturaContent.appendChild(estruturaTitulo);

                    for (const [alias, frase] of frasesOrdenadas) {
                        frasesNoSegmento++;
                        const fraseItem = document.createElement('div');
                        fraseItem.className = 'frase-item';
                        fraseItem.dataset.alias = alias;

                        fraseItem.innerHTML = `
                            <div class="frase-alias">
                                <span>${alias}</span>
                                <div class="alias-actions">
                                    <button class="btn-renomear-alias" title="Renomear Alias">✏️</button>
                                </div>
                            </div>
                            <div class="frase-texto" contenteditable="false">${frase}</div>
                            <div class="frase-actions">
                                <button class="btn-editar-frase" title="Editar Frase">📝</button>
                                <button class="btn-salvar-frase" title="Salvar" style="display:none;">✅</button>
                                <button class="btn-cancelar-edicao" title="Cancelar" style="display:none;">❌</button>
                                <button class="btn-deletar-frase" title="Deletar Frase">🗑️</button>
                            </div>
                        `;
                        estruturaContent.appendChild(fraseItem);
                    }
                }
            }

            if (frasesNoSegmento > 0) {
                segmentoItem.appendChild(segmentoHeader);
                segmentoItem.appendChild(estruturaContent);
                acervoContainer.appendChild(segmentoItem);
                totalFrases += frasesNoSegmento;
                contagemSegmentos[segmentoId] = frasesNoSegmento;
            }
        }
        
        // Atualiza a contagem de frases
        let contagemHTML = `<strong>Total de Frases:</strong> ${totalFrases}<br/>`;
        for(const segId in contagemSegmentos) {
            contagemHTML += `<strong>${segId}:</strong> ${contagemSegmentos[segId]} | `;
        }
        contadorFrasesContainer.innerHTML = contagemHTML.slice(0, -2); // Remove o último " | "
    }

    // Preenche o select de segmentos
    function preencherSelectSegmento() {
        selectSegmento.innerHTML = '<option value="" disabled selected>Selecione um segmento...</option>';
        for (const segmentoId in dadosFrases) {
            const segmento = dadosFrases[segmentoId];
            const option = document.createElement('option');
            option.value = segmentoId;
            option.textContent = `${segmento.nome} (${segmentoId})`;
            selectSegmento.appendChild(option);
        }
    }

    // Atualiza o select de estruturas com base no segmento selecionado
    selectSegmento.addEventListener('change', () => {
        const segmentoId = selectSegmento.value;
        const estruturas = dadosFrases[segmentoId]?.estruturas || {};
        
        selectEstrutura.innerHTML = '<option value="" disabled selected>Selecione uma estrutura...</option>';
        for (const estruturaId in estruturas) {
            const estrutura = estruturas[estruturaId];
            const option = document.createElement('option');
            option.value = estruturaId;
            option.textContent = `${estrutura.nome} (${estruturaId})`;
            selectEstrutura.appendChild(option);
        }
    });

    // Mostra/oculta o campo de letra manual baseado na seleção do tipo de frase
    radiosTipo.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === '|' && radio.checked) {
                grupoLetraManual.style.display = 'block';
                inputLetraManual.required = true;
            } else {
                grupoLetraManual.style.display = 'none';
                inputLetraManual.required = false;
            }
        });
    });

    // Lida com o envio do formulário
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const formData = new FormData(form);
        const dados = {
            tipo: formData.get('tipo'),
            segmento: formData.get('segmento'),
            estrutura: formData.get('estrutura'),
            texto: formData.get('texto'),
            letra_manual: formData.get('letra_manual')
        };

        // Salva os filtros para manter a seleção
        filtrosAnteriores.segmento = dados.segmento;
        filtrosAnteriores.estrutura = dados.estrutura;

        // Lógica de confirmação para sobrescrever conclusão
        if (dados.tipo === '|') {
            const aliasPotencial = `${dados.tipo}${dados.segmento.toLowerCase()}${dados.estrutura}${dados.letra_manual.toLowerCase()}`;
            const frasesExistentes = dadosFrases[dados.segmento]?.estruturas[dados.estrutura]?.frases || {};
            
            if (frasesExistentes[aliasPotencial]) {
                const querSubstituir = confirm(`Já existe uma conclusão com o alias "${aliasPotencial}". Deseja substituí-la?`);
                if (!querSubstituir) {
                    return; // Aborta o envio se o usuário cancelar
                }
            }
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dados),
            });

            if (!response.ok) {
                throw new Error('Erro ao adicionar a frase.');
            }

            const resultado = await response.json();
            
            // Mostra mensagem de sucesso
            mensagemSucesso.textContent = `Frase adicionada com sucesso! Alias gerado: ${resultado.alias}`;
            mensagemSucesso.style.display = 'block';
            setTimeout(() => {
                mensagemSucesso.style.display = 'none';
            }, 4000);

            form.reset();
            
            // === RESET DO FORMULÁRIO PARA CORPO DO LAUDO ===
            document.getElementById('tipo-corpo').checked = true; // Volta para Corpo
            document.getElementById('tipo-conclusao').checked = false;
            grupoLetraManual.style.display = 'none'; // Esconde campo de letra
            inputLetraManual.value = ''; // Limpa campo de letra
            // ================================================

            // Recarrega o acervo e reaplica os filtros
            await carregarAcervo();
            
            selectSegmento.value = filtrosAnteriores.segmento;
            selectSegmento.dispatchEvent(new Event('change')); // Força a atualização das estruturas
            selectEstrutura.value = filtrosAnteriores.estrutura;


        } catch (error) {
            console.error('Falha ao enviar formulário:', error);
            alert('Não foi possível adicionar a frase. Verifique o console para mais detalhes.');
        }
    });

    // Adiciona funcionalidade de acordeão para o acervo
    acervoContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const fraseItem = target.closest('.frase-item');
        if (!fraseItem) {
            if (target.classList.contains('segmento-header')) {
                target.parentElement.classList.toggle('open');
            }
            return;
        }

        const alias = fraseItem.dataset.alias;
        const fraseTextoDiv = fraseItem.querySelector('.frase-texto');

        // Lógica para Deletar
        if (target.classList.contains('btn-deletar-frase')) {
            // Executa diretamente sem confirmação e sem avisos
            try {
                // encodeURIComponent é CRITICO para aliases com caracteres como '|'
                const response = await fetch(`${API_URL}/${encodeURIComponent(alias)}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Falha ao deletar');
                fraseItem.remove();
                carregarAcervo(); 
            } catch (error) {
                console.error('Erro ao deletar:', error);
                // Silencioso como solicitado
            }
        }

        // Lógica para Editar
        if (target.classList.contains('btn-editar-frase')) {
            fraseTextoDiv.contentEditable = true;
            fraseTextoDiv.focus();
            fraseItem.querySelector('.btn-editar-frase').style.display = 'none';
            fraseItem.querySelector('.btn-deletar-frase').style.display = 'none';
            fraseItem.querySelector('.btn-salvar-frase').style.display = 'inline-block';
            fraseItem.querySelector('.btn-cancelar-edicao').style.display = 'inline-block';
        }

        // Lógica para Cancelar Edição
        if (target.classList.contains('btn-cancelar-edicao')) {
            fraseTextoDiv.contentEditable = false;
            // Recarrega a frase original
            fraseTextoDiv.textContent = dadosFrases[alias.substring(1, 4).toUpperCase()].estruturas[alias.substring(4, 5)].frases[alias];
            fraseItem.querySelector('.btn-editar-frase').style.display = 'inline-block';
            fraseItem.querySelector('.btn-deletar-frase').style.display = 'inline-block';
            fraseItem.querySelector('.btn-salvar-frase').style.display = 'none';
            fraseItem.querySelector('.btn-cancelar-edicao').style.display = 'none';
        }

        // Lógica para Salvar Edição
        if (target.classList.contains('btn-salvar-frase')) {
            const novoTexto = fraseTextoDiv.textContent;
            try {
                const response = await fetch(`${API_URL}/${encodeURIComponent(alias)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto: novoTexto })
                });
                if (!response.ok) throw new Error('Falha ao salvar');
                
                fraseTextoDiv.contentEditable = false;
                fraseItem.querySelector('.btn-editar-frase').style.display = 'inline-block';
                fraseItem.querySelector('.btn-deletar-frase').style.display = 'inline-block';
                fraseItem.querySelector('.btn-salvar-frase').style.display = 'none';
                fraseItem.querySelector('.btn-cancelar-edicao').style.display = 'none';
                // Sem alert de sucesso
                
                // Atualiza localmente
                try {
                    dadosFrases[alias.substring(1, 4).toUpperCase()].estruturas[alias.substring(4, 5)].frases[alias] = novoTexto;
                } catch(e) {}
            } catch (error) {
                console.error('Erro ao salvar:', error);
            }
        }

        // Lógica para Renomear Alias
        if (target.classList.contains('btn-renomear-alias')) {
            const novaLetra = prompt(`Digite a nova letra para o alias "${alias}":`, alias.slice(-1));
            if (novaLetra && novaLetra.length === 1 && /^[a-zA-Z]+$/.test(novaLetra)) {
                try {
                    const response = await fetch(`${API_URL}/rename`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ alias_antigo: alias, nova_letra: novaLetra })
                    });
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.erro || 'Falha ao renomear');
                    }
                    alert('Alias renomeado com sucesso! O acervo será recarregado.');
                    carregarAcervo();
                } catch (error) {
                    console.error('Erro ao renomear:', error);
                    alert(`Não foi possível renomear: ${error.message}`);
                }
            } else if (novaLetra !== null) {
                alert('Por favor, insira uma única letra válida.');
            }
        }
    });

    // Adiciona evento de clique para o botão de exportar
    const btnExportar = document.getElementById('btn-exportar-txt');
    btnExportar.addEventListener('click', () => {
        window.location.href = '/api/export/txt';
    });

    // Carga inicial dos dados
    carregarAcervo();
});
