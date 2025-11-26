/**
 * Módulo para gerenciamento de templates de perguntas de avaliações (RH/T&D)
 */

const AvaliacoesTemplates = {
    state: {
        templateAtual: '45', // '45' ou '90'
        perguntas: [],
        perguntaEditando: null
    },

    /**
     * Abre o modal de edição de templates
     */
    async abrirModalEdicao() {
        this.state.templateAtual = '45';
        Modal.open('editar-questionarios-modal');
        await this.carregarPerguntas('45');
        this.refreshIcons();
    },

    /**
     * Fecha o modal de edição de templates
     */
    fecharModalEdicao() {
        Modal.close('editar-questionarios-modal');
        this.state.perguntas = [];
        this.state.templateAtual = '45';
    },

    /**
     * Seleciona um template para edição
     */
    async selecionarTemplate(tipo) {
        this.state.templateAtual = tipo;
        
        // Atualizar botões
        document.querySelectorAll('.btn-template-selector').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-template') === tipo) {
                btn.classList.add('active');
            }
        });

        await this.carregarPerguntas(tipo);
    },

    /**
     * Carrega as perguntas do template selecionado
     */
    async carregarPerguntas(tipo) {
        try {
            const container = document.getElementById('lista-perguntas-edicao');
            container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando perguntas...</div>';

            const perguntas = await API.get(`/api/avaliacoes/templates/${tipo}/perguntas`);
            this.state.perguntas = perguntas;
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
            <div class="pergunta-item" data-id="${pergunta.Id}" draggable="true">
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
                                <span style="background: ${pergunta.TipoPergunta === 'escala' ? '#dbeafe' : '#f3f4f6'}; color: ${pergunta.TipoPergunta === 'escala' ? '#1e40af' : '#4b5563'}; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                    ${pergunta.TipoPergunta === 'escala' ? 'Escala' : 'Texto'}
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
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-icon" onclick="AvaliacoesTemplates.editarPergunta(${pergunta.Id})" title="Editar">
                                <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                            </button>
                            <button class="btn-icon btn-icon-danger" onclick="AvaliacoesTemplates.excluirPergunta(${pergunta.Id})" title="Excluir">
                                <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        this.refreshIcons();
        this.setupDragAndDrop();
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
     * Salva a nova ordem das perguntas no backend
     */
    async salvarNovaOrdem() {
        try {
            const items = document.querySelectorAll('.pergunta-item');
            const perguntasIds = Array.from(items).map(item => parseInt(item.getAttribute('data-id')));

            await API.put(`/api/avaliacoes/templates/${this.state.templateAtual}/perguntas/reordenar`, {
                perguntasIds
            });

            // Recarregar para atualizar os números de ordem
            await this.carregarPerguntas(this.state.templateAtual);
        } catch (error) {
            console.error('Erro ao reordenar perguntas:', error);
            alert('Erro ao salvar nova ordem');
        }
    },

    /**
     * Abre modal para adicionar nova pergunta
     */
    abrirModalNovaPergunta() {
        this.state.perguntaEditando = null;
        document.getElementById('titulo-modal-pergunta').textContent = 'Nova Pergunta';
        this.limparFormularioPergunta();
        Modal.open('modal-pergunta-avaliacao');
        this.refreshIcons();
    },

    /**
     * Abre modal para editar pergunta existente
     */
    editarPergunta(id) {
        const pergunta = this.state.perguntas.find(p => p.Id === id);
        if (!pergunta) return;

        this.state.perguntaEditando = pergunta;
        document.getElementById('titulo-modal-pergunta').textContent = 'Editar Pergunta';
        
        document.getElementById('input-pergunta-texto').value = pergunta.Pergunta;
        document.getElementById('input-tipo-pergunta').value = pergunta.TipoPergunta;
        document.getElementById('input-obrigatoria').checked = pergunta.Obrigatoria;
        
        if (pergunta.TipoPergunta === 'escala') {
            document.getElementById('input-escala-minima').value = pergunta.EscalaMinima || 1;
            document.getElementById('input-escala-maxima').value = pergunta.EscalaMaxima || 5;
            document.getElementById('input-escala-label-minima').value = pergunta.EscalaLabelMinima || '';
            document.getElementById('input-escala-label-maxima').value = pergunta.EscalaLabelMaxima || '';
        }

        this.toggleCamposEscala();
        Modal.open('modal-pergunta-avaliacao');
        this.refreshIcons();
    },

    /**
     * Exclui uma pergunta
     */
    async excluirPergunta(id) {
        if (!confirm('Tem certeza que deseja excluir esta pergunta?')) return;

        try {
            await API.delete(`/api/avaliacoes/templates/${this.state.templateAtual}/perguntas/${id}`);
            await this.carregarPerguntas(this.state.templateAtual);
        } catch (error) {
            console.error('Erro ao excluir pergunta:', error);
            alert('Erro ao excluir pergunta');
        }
    },

    /**
     * Salva a pergunta (nova ou editada)
     */
    async salvarPergunta() {
        const pergunta = document.getElementById('input-pergunta-texto').value.trim();
        const tipoPergunta = document.getElementById('input-tipo-pergunta').value;
        const obrigatoria = document.getElementById('input-obrigatoria').checked;

        if (!pergunta) {
            alert('Por favor, preencha o texto da pergunta');
            return;
        }

        const dados = {
            pergunta,
            tipoPergunta,
            obrigatoria
        };

        if (tipoPergunta === 'escala') {
            dados.escalaMinima = parseInt(document.getElementById('input-escala-minima').value);
            dados.escalaMaxima = parseInt(document.getElementById('input-escala-maxima').value);
            dados.escalaLabelMinima = document.getElementById('input-escala-label-minima').value.trim();
            dados.escalaLabelMaxima = document.getElementById('input-escala-label-maxima').value.trim();

            if (dados.escalaMinima >= dados.escalaMaxima) {
                alert('O valor mínimo deve ser menor que o máximo');
                return;
            }
        }

        try {
            if (this.state.perguntaEditando) {
                // Editar
                await API.put(`/api/avaliacoes/templates/${this.state.templateAtual}/perguntas/${this.state.perguntaEditando.Id}`, dados);
            } else {
                // Criar
                await API.post(`/api/avaliacoes/templates/${this.state.templateAtual}/perguntas`, dados);
            }

            this.fecharModalPergunta();
            await this.carregarPerguntas(this.state.templateAtual);
        } catch (error) {
            console.error('Erro ao salvar pergunta:', error);
            alert('Erro ao salvar pergunta');
        }
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
        document.getElementById('input-obrigatoria').checked = true;
        document.getElementById('input-escala-minima').value = 1;
        document.getElementById('input-escala-maxima').value = 5;
        document.getElementById('input-escala-label-minima').value = '';
        document.getElementById('input-escala-label-maxima').value = '';
        this.toggleCamposEscala();
    },

    /**
     * Mostra/oculta campos de escala conforme o tipo selecionado
     */
    toggleCamposEscala() {
        const tipo = document.getElementById('input-tipo-pergunta').value;
        const camposEscala = document.getElementById('campos-escala');
        camposEscala.style.display = tipo === 'escala' ? 'block' : 'none';
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

