/**
 * Módulo para gerenciamento de templates de perguntas de avaliações (RH/T&D)
 */

const AvaliacoesTemplates = {
    state: {
        templateAtual: '45',
        perguntas: [],
        perguntasOriginais: [],
        perguntaEditando: null,
        opcoes: [],
        alteracoesPendentes: {
            '45': { adicionar: [], editar: [], excluir: [] },
            '90': { adicionar: [], editar: [], excluir: [] }
        }
    },

    /**
     * Abre o modal de edição de templates
     */
    async abrirModalEdicao() {
        this.state.templateAtual = '45';

        // Resetar botões para 45 dias
        document.querySelectorAll('.btn-template-selector').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-template') === '45');
        });

        Modal.open('editar-questionarios-modal');
        await this.carregarPerguntas('45');
        this.refreshIcons();
    },

    /**
     * Salva todas as alterações pendentes no backend (ambos templates)
     */
    async salvarAlteracoes() {
        try {
            // Salvar estado atual antes de processar
            this.state[`perguntas_${this.state.templateAtual}`] = JSON.parse(JSON.stringify(this.state.perguntas));

            // Processar ambos os templates
            for (const tipo of ['45', '90']) {
                const alteracoes = this.state.alteracoesPendentes[tipo];

                // Excluir perguntas
                for (const id of alteracoes.excluir) {
                    await API.delete(`/api/avaliacoes/templates/${tipo}/perguntas/${id}`);
                }

                // Adicionar novas perguntas
                for (const pergunta of alteracoes.adicionar) {
                    const dados = {
                        pergunta: pergunta.Pergunta,
                        tipoPergunta: pergunta.TipoPergunta,
                        obrigatoria: pergunta.Obrigatoria,
                        escalaMinima: pergunta.EscalaMinima,
                        escalaMaxima: pergunta.EscalaMaxima,
                        escalaLabelMinima: pergunta.EscalaLabelMinima,
                        escalaLabelMaxima: pergunta.EscalaLabelMaxima,
                        opcoes: pergunta.opcoes
                    };
                    await API.post(`/api/avaliacoes/templates/${tipo}/perguntas`, dados);
                }

                // Editar perguntas existentes
                for (const pergunta of alteracoes.editar) {
                    const dados = {
                        pergunta: pergunta.Pergunta,
                        tipoPergunta: pergunta.TipoPergunta,
                        obrigatoria: pergunta.Obrigatoria,
                        escalaMinima: pergunta.EscalaMinima,
                        escalaMaxima: pergunta.EscalaMaxima,
                        escalaLabelMinima: pergunta.EscalaLabelMinima,
                        escalaLabelMaxima: pergunta.EscalaLabelMaxima,
                        opcoes: pergunta.opcoes
                    };
                    await API.put(`/api/avaliacoes/templates/${tipo}/perguntas/${pergunta.Id}`, dados);
                }

                // Reordenar perguntas
                const perguntasSalvas = this.state[`perguntas_${tipo}`] || [];
                const perguntasIds = perguntasSalvas.filter(p => p.Id > 0).map(p => p.Id);
                if (perguntasIds.length > 0) {
                    await API.put(`/api/avaliacoes/templates/${tipo}/perguntas/reordenar`, { perguntasIds });
                }
            }

            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Alterações salvas com sucesso!', 'success');
            }

            // Limpar estados e fechar modal
            this.state.alteracoesPendentes = {
                '45': { adicionar: [], editar: [], excluir: [] },
                '90': { adicionar: [], editar: [], excluir: [] }
            };
            delete this.state.perguntas_45;
            delete this.state.perguntas_90;

            Modal.close('editar-questionarios-modal');
        } catch (error) {
            console.error('Erro ao salvar alterações:', error);
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Erro ao salvar alterações', 'error');
            }
        }
    },

    /**
     * Fecha o modal de edição de templates
     */
    fecharModalEdicao() {
        const temAlteracoes =
            this.state.alteracoesPendentes['45'].adicionar.length > 0 ||
            this.state.alteracoesPendentes['45'].editar.length > 0 ||
            this.state.alteracoesPendentes['45'].excluir.length > 0 ||
            this.state.alteracoesPendentes['90'].adicionar.length > 0 ||
            this.state.alteracoesPendentes['90'].editar.length > 0 ||
            this.state.alteracoesPendentes['90'].excluir.length > 0;

        if (temAlteracoes) {
            this.state.modalCallback = () => {
                Modal.close('editar-questionarios-modal');
                this.state.perguntas = [];
                this.state.perguntasOriginais = [];
                this.state.alteracoesPendentes = {
                    '45': { adicionar: [], editar: [], excluir: [] },
                    '90': { adicionar: [], editar: [], excluir: [] }
                };
                delete this.state.perguntas_45;
                delete this.state.perguntas_90;
                this.state.templateAtual = '45';
            };
            Modal.open('confirmar-descartar-alteracoes-modal');
            return;
        }

        Modal.close('editar-questionarios-modal');
        this.state.perguntas = [];
        this.state.perguntasOriginais = [];
        this.state.alteracoesPendentes = {
            '45': { adicionar: [], editar: [], excluir: [] },
            '90': { adicionar: [], editar: [], excluir: [] }
        };
        delete this.state.perguntas_45;
        delete this.state.perguntas_90;
        this.state.templateAtual = '45';
    },

    /**
     * Confirma o descarte de alterações
     */
    confirmarDescarte() {
        Modal.close('confirmar-descartar-alteracoes-modal');
        if (this.state.modalCallback) {
            this.state.modalCallback();
            this.state.modalCallback = null;
        }
    },

    /**
     * Cancela o descarte de alterações
     */
    cancelarDescarte() {
        Modal.close('confirmar-descartar-alteracoes-modal');
        this.state.modalCallback = null;
    },

    /**
     * Seleciona um template para edição
     */
    async selecionarTemplate(tipo) {
        // Salvar estado atual antes de trocar
        if (this.state.templateAtual) {
            this.state[`perguntas_${this.state.templateAtual}`] = JSON.parse(JSON.stringify(this.state.perguntas));
        }

        // Atualizar botões
        document.querySelectorAll('.btn-template-selector').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-template') === tipo) {
                btn.classList.add('active');
            }
        });

        this.state.templateAtual = tipo;

        // Restaurar estado salvo ou carregar do servidor
        if (this.state[`perguntas_${tipo}`]) {
            this.state.perguntas = JSON.parse(JSON.stringify(this.state[`perguntas_${tipo}`]));
            await new Promise(resolve => requestAnimationFrame(resolve));
            this.renderizarPerguntas();
        } else {
            await this.carregarPerguntas(tipo);
        }
    },

    /**
     * Carrega as perguntas do template selecionado
     */
    async carregarPerguntas(tipo) {
        try {
            const container = document.getElementById('lista-perguntas-edicao');
            container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando perguntas...</div>';

            const perguntas = await API.get(`/api/avaliacoes/templates/${tipo}/perguntas`);
            this.state.perguntas = JSON.parse(JSON.stringify(perguntas));
            this.state.perguntasOriginais = JSON.parse(JSON.stringify(perguntas));

            await new Promise(resolve => requestAnimationFrame(resolve));
            this.renderizarPerguntas();
        } catch (error) {
            console.error('Erro ao carregar perguntas:', error);
            const container = document.getElementById('lista-perguntas-edicao');
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc2626;">Erro ao carregar perguntas</div>';
        }
    },

    /**
     * Renderiza a lista de perguntas
     */
    renderizarPerguntas() {
        const container = document.getElementById('lista-perguntas-edicao');

        if (this.state.perguntas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #f9fafb; border-radius: 8px;">
                    <i data-lucide="inbox" style="width: 48px; height: 48px; color: #9ca3af; margin-bottom: 12px;"></i>
                    <p style="color: #6b7280; margin: 0;">Nenhuma pergunta cadastrada</p>
                    <p style="color: #9ca3af; font-size: 14px; margin: 8px 0 0 0;">Clique em "Nova Pergunta" para adicionar</p>
                </div>
            `;
            this.refreshIcons();
            return;
        }

        container.innerHTML = this.state.perguntas.map((pergunta, index) => `
            <div class="pergunta-item${pergunta.marcadaExclusao ? ' marcada-exclusao' : ''}" data-id="${pergunta.Id}" draggable="${!pergunta.marcadaExclusao}">
                <div class="pergunta-drag-handle">
                    <i data-lucide="grip-vertical" style="width: 20px; height: 20px; color: #9ca3af;"></i>
                </div>
                <div class="pergunta-conteudo">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                    ${index + 1}
                                </span>
                                <span style="background: ${this.getCorTipoPergunta(pergunta.TipoPergunta).bg}; color: ${this.getCorTipoPergunta(pergunta.TipoPergunta).text}; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                    ${this.getLabelTipoPergunta(pergunta.TipoPergunta)}
                                </span>
                                ${pergunta.Obrigatoria ? '<span style="color: #dc2626; font-size: 12px;">*</span>' : ''}
                            </div>
                            <p style="margin: 0; color: #111827; font-weight: 500;">${this.escapeHtml(pergunta.Pergunta)}</p>
                            ${pergunta.TipoPergunta === 'escala' ? `
                                <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 13px; color: #6b7280;">
                                    <span>${pergunta.EscalaMinima} - ${pergunta.EscalaLabelMinima || 'Mínimo'}</span>
                                    <span>|</span>
                                    <span>${pergunta.EscalaMaxima} - ${pergunta.EscalaLabelMaxima || 'Máximo'}</span>
                                </div>
                            ` : ''}
                            ${pergunta.TipoPergunta === 'multipla_escolha' ? `
                                <div style="margin-top: 8px; font-size: 13px; color: #6b7280;">
                                    <i data-lucide="list" style="width: 14px; height: 14px;"></i>
                                    Múltipla escolha (${pergunta.opcoes ? pergunta.opcoes.length : (pergunta.NumOpcoes || 0)} opções)
                                </div>
                            ` : ''}
                            ${pergunta.TipoPergunta === 'sim_nao' ? `
                                <div style="margin-top: 8px; font-size: 13px; color: #6b7280;">
                                    <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i>
                                    Resposta: Sim ou Não
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-icon" onclick="AvaliacoesTemplates.editarPergunta(${pergunta.Id})" title="Editar" ${pergunta.marcadaExclusao ? 'disabled' : ''}>
                                <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                            </button>
                            <button class="btn-icon ${pergunta.marcadaExclusao ? 'btn-icon-success' : 'btn-icon-danger'}" onclick="AvaliacoesTemplates.excluirPergunta(${pergunta.Id})" title="${pergunta.marcadaExclusao ? 'Reativar' : 'Excluir'}">
                                <i data-lucide="${pergunta.marcadaExclusao ? 'rotate-ccw' : 'trash-2'}" style="width: 16px; height: 16px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        requestAnimationFrame(() => {
            this.refreshIcons();
            this.setupDragAndDrop();
        });
    },

    /**
     * Configura drag and drop para reordenação
     */
    setupDragAndDrop() {
        const items = document.querySelectorAll('.pergunta-item');
        let draggedItem = null;

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (draggedItem !== item) {
                    const allItems = [...document.querySelectorAll('.pergunta-item')];
                    const draggedIndex = allItems.indexOf(draggedItem);
                    const targetIndex = allItems.indexOf(item);

                    if (draggedIndex > targetIndex) {
                        item.parentNode.insertBefore(draggedItem, item);
                    } else {
                        item.parentNode.insertBefore(draggedItem, item.nextSibling);
                    }

                    await this.salvarNovaOrdem();
                }
            });
        });
    },

    /**
     * Atualiza a ordem das perguntas em memória
     */
    salvarNovaOrdem() {
        const items = document.querySelectorAll('.pergunta-item');
        const novaOrdem = [];

        items.forEach((item, index) => {
            const id = parseInt(item.getAttribute('data-id'));
            const pergunta = this.state.perguntas.find(p => p.Id === id);
            if (pergunta) {
                pergunta.Ordem = index + 1;
                novaOrdem.push(pergunta);
            }
        });

        this.state.perguntas = novaOrdem;
        this.renderizarPerguntas();
    },

    /**
     * Abre modal para adicionar nova pergunta
     */
    abrirModalNovaPergunta() {
        this.state.perguntaEditando = null;
        this.state.opcoes = [];
        document.getElementById('titulo-modal-pergunta').innerHTML = '<i data-lucide="help-circle"></i> Nova Pergunta';
        this.limparFormularioPergunta();
        const modal = document.getElementById('modal-pergunta-avaliacao');
        modal.setAttribute('data-mode', 'template');
        Modal.open('modal-pergunta-avaliacao');

        // Restore buttons
        const btnSalvar = document.getElementById('btn-salvar-pergunta');
        const btnCancelar = document.getElementById('btn-cancelar-pergunta');

        if (btnSalvar) {
            btnSalvar.removeAttribute('onclick');
            btnSalvar.onclick = () => this.salvarPergunta();
        }
        if (btnCancelar) {
            btnCancelar.removeAttribute('onclick');
            btnCancelar.onclick = () => this.fecharModalPergunta();
        }

        const btnAdicionarOpcao = document.getElementById('btn-adicionar-opcao');
        if (btnAdicionarOpcao) {
            btnAdicionarOpcao.removeAttribute('onclick');
            btnAdicionarOpcao.onclick = () => this.adicionarOpcao();
        }
        this.refreshIcons();
    },

    /**
     * Abre modal para editar pergunta existente
     */
    async editarPergunta(id) {
        const pergunta = this.state.perguntas.find(p => p.Id === id);
        if (!pergunta) return;

        this.state.perguntaEditando = pergunta;
        this.state.opcoes = [];
        document.getElementById('titulo-modal-pergunta').innerHTML = '<i data-lucide="edit"></i> Editar Pergunta';

        document.getElementById('input-pergunta-texto').value = pergunta.Pergunta;
        document.getElementById('input-tipo-pergunta').value = pergunta.TipoPergunta;
        document.getElementById('input-obrigatoria').value = pergunta.Obrigatoria ? 'true' : 'false';

        if (pergunta.TipoPergunta === 'escala') {
            document.getElementById('input-escala-minima').value = pergunta.EscalaMinima || 1;
            document.getElementById('input-escala-maxima').value = pergunta.EscalaMaxima || 5;
            document.getElementById('input-escala-label-minima').value = pergunta.EscalaLabelMinima || '';
            document.getElementById('input-escala-label-maxima').value = pergunta.EscalaLabelMaxima || '';
        }

        if (pergunta.TipoPergunta === 'multipla_escolha') {
            if (pergunta.Id < 0) {
                this.state.opcoes = pergunta.opcoes ? [...pergunta.opcoes] : [];
                this.renderizarOpcoes();
            } else {
                try {
                    const opcoes = await API.get(`/api/avaliacoes/templates/${this.state.templateAtual}/perguntas/${id}/opcoes`);
                    this.state.opcoes = opcoes.map(o => o.TextoOpcao);
                    this.renderizarOpcoes();
                } catch (error) {
                    console.error('Erro ao carregar opções:', error);
                }
            }
        }

        this.toggleCamposEscala();
        const modal = document.getElementById('modal-pergunta-avaliacao');
        modal.setAttribute('data-mode', 'template');
        Modal.open('modal-pergunta-avaliacao');

        // Restore buttons
        const btnSalvar = document.getElementById('btn-salvar-pergunta');
        const btnCancelar = document.getElementById('btn-cancelar-pergunta');

        if (btnSalvar) {
            btnSalvar.removeAttribute('onclick');
            btnSalvar.onclick = () => this.salvarPergunta();
        }
        if (btnCancelar) {
            btnCancelar.removeAttribute('onclick');
            btnCancelar.onclick = () => this.fecharModalPergunta();
        }

        const btnAdicionarOpcao = document.getElementById('btn-adicionar-opcao');
        if (btnAdicionarOpcao) {
            btnAdicionarOpcao.removeAttribute('onclick');
            btnAdicionarOpcao.onclick = () => this.adicionarOpcao();
        }
        this.refreshIcons();
    },

    /**
     * Exclui uma pergunta (marca para exclusão)
     */
    excluirPergunta(id) {
        const index = this.state.perguntas.findIndex(p => p.Id === id);
        if (index === -1) return;

        const pergunta = this.state.perguntas[index];

        if (pergunta.marcadaExclusao) {
            this.reativarPergunta(id);
            return;
        }

        this.state.perguntaParaExcluir = id;
        Modal.open('confirmar-exclusao-pergunta-modal');
    },

    /**
     * Confirma a exclusão da pergunta
     */
    confirmarExclusaoPergunta() {
        const id = this.state.perguntaParaExcluir;
        if (!id) return;

        const index = this.state.perguntas.findIndex(p => p.Id === id);
        if (index === -1) return;

        const pergunta = this.state.perguntas[index];
        const tipo = this.state.templateAtual;

        if (pergunta.Id < 0) {
            const addIndex = this.state.alteracoesPendentes[tipo].adicionar.findIndex(p => p.Id === id);
            if (addIndex !== -1) {
                this.state.alteracoesPendentes[tipo].adicionar.splice(addIndex, 1);
            }
            this.state.perguntas.splice(index, 1);
        } else {
            if (!this.state.alteracoesPendentes[tipo].excluir.includes(id)) {
                this.state.alteracoesPendentes[tipo].excluir.push(id);
            }
            pergunta.marcadaExclusao = true;
        }

        Modal.close('confirmar-exclusao-pergunta-modal');
        this.state.perguntaParaExcluir = null;
        this.renderizarPerguntas();
    },

    /**
     * Cancela a exclusão da pergunta
     */
    cancelarExclusaoPergunta() {
        this.state.perguntaParaExcluir = null;
        Modal.close('confirmar-exclusao-pergunta-modal');
    },

    /**
     * Reativa uma pergunta marcada para exclusão
     */
    reativarPergunta(id) {
        const index = this.state.perguntas.findIndex(p => p.Id === id);
        if (index === -1) return;

        const pergunta = this.state.perguntas[index];
        const tipo = this.state.templateAtual;

        pergunta.marcadaExclusao = false;

        const excluirIndex = this.state.alteracoesPendentes[tipo].excluir.indexOf(id);
        if (excluirIndex !== -1) {
            this.state.alteracoesPendentes[tipo].excluir.splice(excluirIndex, 1);
        }

        this.renderizarPerguntas();
    },

    /**
     * Adiciona uma opção à lista
     */
    adicionarOpcao() {
        const input = document.getElementById('nova-opcao-input');
        const texto = input.value.trim();

        if (!texto) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Digite o texto da opção', 'error');
            }
            return;
        }

        if (this.state.opcoes.includes(texto)) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Esta opção já existe', 'error');
            }
            return;
        }

        this.state.opcoes.push(texto);
        input.value = '';
        this.renderizarOpcoes();
    },

    /**
     * Remove uma opção da lista
     */
    removerOpcao(index) {
        this.state.opcoes.splice(index, 1);
        this.renderizarOpcoes();
    },

    /**
     * Move uma opção para cima
     */
    moverOpcaoCima(index) {
        if (index === 0) return;
        const temp = this.state.opcoes[index];
        this.state.opcoes[index] = this.state.opcoes[index - 1];
        this.state.opcoes[index - 1] = temp;
        this.renderizarOpcoes();
    },

    /**
     * Move uma opção para baixo
     */
    moverOpcaoBaixo(index) {
        if (index === this.state.opcoes.length - 1) return;
        const temp = this.state.opcoes[index];
        this.state.opcoes[index] = this.state.opcoes[index + 1];
        this.state.opcoes[index + 1] = temp;
        this.renderizarOpcoes();
    },

    /**
     * Renderiza a lista de opções
     */
    renderizarOpcoes() {
        const container = document.getElementById('lista-opcoes-multipla');

        if (this.state.opcoes.length === 0) {
            container.innerHTML = '<p style="color: #9ca3af; font-size: 14px; text-align: center; padding: 20px;">Nenhuma opção adicionada</p>';
            return;
        }

        container.innerHTML = this.state.opcoes.map((opcao, index) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
                <span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; min-width: 24px; text-align: center;">
                    ${index + 1}
                </span>
                <span style="flex: 1; color: #111827;">${this.escapeHtml(opcao)}</span>
                <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn-icon" onclick="AvaliacoesTemplates.moverOpcaoCima(${index})" title="Mover para cima" ${index === 0 ? 'disabled' : ''}>
                        <i data-lucide="chevron-up" style="width: 16px; height: 16px;"></i>
                    </button>
                    <button type="button" class="btn-icon" onclick="AvaliacoesTemplates.moverOpcaoBaixo(${index})" title="Mover para baixo" ${index === this.state.opcoes.length - 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-down" style="width: 16px; height: 16px;"></i>
                    </button>
                    <button type="button" class="btn-icon btn-icon-danger" onclick="AvaliacoesTemplates.removerOpcao(${index})" title="Remover">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.refreshIcons();
    },

    /**
     * Salva a pergunta (adiciona/edita em memória)
     */
    salvarPergunta() {
        const pergunta = document.getElementById('input-pergunta-texto').value.trim();
        const tipoPergunta = document.getElementById('input-tipo-pergunta').value;
        const obrigatoria = document.getElementById('input-obrigatoria').value === 'true';

        if (!pergunta) {
            if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                window.EmailPopup.showToast('Por favor, preencha o texto da pergunta', 'error');
            }
            return;
        }

        const dados = {
            Pergunta: pergunta,
            TipoPergunta: tipoPergunta,
            Obrigatoria: obrigatoria
        };

        if (tipoPergunta === 'escala') {
            dados.EscalaMinima = parseInt(document.getElementById('input-escala-minima').value);
            dados.EscalaMaxima = parseInt(document.getElementById('input-escala-maxima').value);
            dados.EscalaLabelMinima = document.getElementById('input-escala-label-minima').value.trim();
            dados.EscalaLabelMaxima = document.getElementById('input-escala-label-maxima').value.trim();

            if (dados.EscalaMinima >= dados.EscalaMaxima) {
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('O valor mínimo deve ser menor que o máximo', 'error');
                }
                return;
            }
        }

        if (tipoPergunta === 'multipla_escolha') {
            if (this.state.opcoes.length < 2) {
                if (window.EmailPopup && typeof window.EmailPopup.showToast === 'function') {
                    window.EmailPopup.showToast('Por favor, adicione pelo menos duas opções', 'error');
                }
                return;
            }
            dados.opcoes = [...this.state.opcoes];
        }

        const tipo = this.state.templateAtual;

        if (this.state.perguntaEditando) {
            const index = this.state.perguntas.findIndex(p => p.Id === this.state.perguntaEditando.Id);
            if (index !== -1) {
                dados.Id = this.state.perguntaEditando.Id;
                dados.Ordem = this.state.perguntas[index].Ordem;
                this.state.perguntas[index] = dados;

                if (dados.Id > 0) {
                    const editIndex = this.state.alteracoesPendentes[tipo].editar.findIndex(p => p.Id === dados.Id);
                    if (editIndex !== -1) {
                        this.state.alteracoesPendentes[tipo].editar[editIndex] = dados;
                    } else {
                        this.state.alteracoesPendentes[tipo].editar.push(dados);
                    }
                } else {
                    const addIndex = this.state.alteracoesPendentes[tipo].adicionar.findIndex(p => p.Id === dados.Id);
                    if (addIndex !== -1) {
                        this.state.alteracoesPendentes[tipo].adicionar[addIndex] = dados;
                    }
                }
            }
        } else {
            dados.Id = -(Date.now());
            dados.Ordem = this.state.perguntas.length + 1;
            this.state.perguntas.push(dados);
            this.state.alteracoesPendentes[tipo].adicionar.push(dados);
        }

        this.fecharModalPergunta();
        this.renderizarPerguntas();
    },

    /**
     * Fecha o modal de pergunta
     */
    fecharModalPergunta() {
        Modal.close('modal-pergunta-avaliacao');
        this.limparFormularioPergunta();
        this.state.perguntaEditando = null;
    },

    /**
     * Limpa o formulário de pergunta
     */
    limparFormularioPergunta() {
        document.getElementById('input-pergunta-texto').value = '';
        document.getElementById('input-tipo-pergunta').value = 'texto';
        document.getElementById('input-obrigatoria').value = 'true';
        document.getElementById('input-escala-minima').value = 1;
        document.getElementById('input-escala-maxima').value = 5;
        document.getElementById('input-escala-label-minima').value = '';
        document.getElementById('input-escala-label-maxima').value = '';

        const novaOpcaoInput = document.getElementById('nova-opcao-input');
        if (novaOpcaoInput) novaOpcaoInput.value = '';

        this.state.opcoes = [];
        this.toggleCamposEscala();
    },

    /**
     * Mostra/oculta campos conforme o tipo selecionado
     */
    toggleCamposEscala() {
        const tipo = document.getElementById('input-tipo-pergunta').value;
        const camposEscala = document.getElementById('campos-escala');
        const camposMultipla = document.getElementById('campos-multipla-escolha');

        camposEscala.style.display = tipo === 'escala' ? 'block' : 'none';
        camposMultipla.style.display = tipo === 'multipla_escolha' ? 'block' : 'none';

        if (tipo === 'multipla_escolha') {
            this.renderizarOpcoes();
        }
    },

    /**
     * Retorna a cor de fundo e texto para cada tipo de pergunta
     */
    getCorTipoPergunta(tipo) {
        const cores = {
            'texto': { bg: '#f3f4f6', text: '#4b5563' },
            'multipla_escolha': { bg: '#fef3c7', text: '#92400e' },
            'escala': { bg: '#dbeafe', text: '#1e40af' },
            'sim_nao': { bg: '#e0e7ff', text: '#3730a3' }
        };
        return cores[tipo] || cores['texto'];
    },

    /**
     * Retorna o label amigável para cada tipo de pergunta
     */
    getLabelTipoPergunta(tipo) {
        const labels = {
            'texto': 'Texto Livre',
            'multipla_escolha': 'Múltipla Escolha',
            'escala': 'Escala',
            'sim_nao': 'Sim/Não'
        };
        return labels[tipo] || tipo;
    },

    /**
     * Escapa HTML para segurança
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * Atualiza os ícones Lucide
     */
    refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
        }
    }
};

// Tornar globalmente acessível
window.AvaliacoesTemplates = AvaliacoesTemplates;

