// Pesquisas Tab Module
const Pesquisas = {
    state: {
        currentPesquisa: null,
        selectedResposta: null
    },

    icon(name, size = 18, color = 'currentColor') {
        const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
        const icons = {
            'check-circle': `<svg ${attrs}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            'clock': `<svg ${attrs}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
            'lock': `<svg ${attrs}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
            'calendar': `<svg ${attrs}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
            'calendar-check': `<svg ${attrs}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`,
            'edit': `<svg ${attrs}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
            'eye': `<svg ${attrs}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
            'lock-filled': `<svg ${attrs}><path d="M7 11V7a5 5 0 0 1 10 0v4"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/></svg>`
        };
        return icons[name] || '';
    },

    async load() {
        await this.loadList();
        await this.checkPermissions();
    },

    async loadList() {
        try {
            const container = document.getElementById('user-surveys-list');
            if (!container) return;

            container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando pesquisas...</div>';

            const pesquisas = await API.get('/api/pesquisas');
            this.updateList(pesquisas);
        } catch (error) {
            console.error('Erro ao carregar pesquisas:', error);
        }
    },

    updateList(data) {
        const container = document.getElementById('user-surveys-list');
        if (!container) return;

        const pesquisas = data.surveys || data;
        if (!pesquisas || pesquisas.length === 0) {
            container.innerHTML = '<div class="loading">Nenhuma pesquisa disponível.</div>';
            return;
        }

        container.innerHTML = pesquisas.map(pesquisa => {
            const status = pesquisa.ja_respondeu ? 'Respondida' : (pesquisa.pode_responder ? 'Pendente' : 'Encerrada');
            const statusColor = pesquisa.ja_respondeu ? '#10b981' : (pesquisa.pode_responder ? '#f59e0b' : '#6b7280');
            const statusIcon = pesquisa.ja_respondeu ? 'check-circle' : (pesquisa.pode_responder ? 'clock' : 'lock');

            return `
                <div class="pesquisa-item" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <h4 style="margin: 0 0 4px 0;">${pesquisa.titulo}</h4>
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">${pesquisa.descricao || 'Sem descrição'}</p>
                        </div>
                        <span class="badge" style="background-color: ${statusColor}; color: white; display: inline-flex; align-items: center; gap: 6px;">
                            ${this.icon(statusIcon, 16, 'white')} ${status}
                        </span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px; font-size: 14px; color: #6b7280;">
                        <span style="display: inline-flex; align-items: center; gap: 6px;">${this.icon('calendar', 16)} ${this.formatDate(pesquisa.data_inicio)}</span>
                        <span>até</span>
                        <span style="display: inline-flex; align-items: center; gap: 6px;">${this.icon('calendar-check', 16)} ${this.formatDate(pesquisa.data_encerramento)}</span>
                    </div>
                    ${pesquisa.pode_responder ? `
                        <button class="btn btn-amber btn-sm" onclick="Pesquisas.open(${pesquisa.Id})">
                            ${this.icon('edit', 16)} Responder Pesquisa
                        </button>
                    ` : pesquisa.ja_respondeu ? `
                        <button class="btn btn-secondary btn-sm" onclick="Pesquisas.viewResponse(${pesquisa.Id})">
                            ${this.icon('eye', 16)} Ver Resposta
                        </button>
                    ` : `
                        <button class="btn btn-secondary btn-sm" disabled>
                            ${this.icon('lock', 16)} Pesquisa Encerrada
                        </button>
                    `}
                </div>
            `;
        }).join('');

        // Ícones são inline SVG agora; não é necessário recriar via lucide
    },

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const [ano, mes, dia] = dateString.split('T')[0].split('-');
            return `${dia}/${mes}/${ano}`;
        } catch {
            return 'Data inválida';
        }
    },

    async open(pesquisaId) {
        try {
            const pesquisa = await API.get(`/api/pesquisas/${pesquisaId}`);
            this.state.currentPesquisa = pesquisa;

            // Verificar se há perguntas
            if (!pesquisa.perguntas || pesquisa.perguntas.length === 0) {
                alert('Esta pesquisa não possui perguntas.');
                return;
            }

            // Usar apenas a primeira pergunta por enquanto (simplificação)
            const primeiraPergunta = pesquisa.perguntas[0];

            document.getElementById('responder-pesquisa-title').innerHTML = `${this.icon('edit', 18)} ${pesquisa.titulo}`;
            document.getElementById('responder-pergunta').textContent = primeiraPergunta.pergunta;

            const opcoesContainer = document.getElementById('responder-opcoes-container');
            const escalaContainer = document.getElementById('responder-escala-container');
            const textoContainer = document.getElementById('responder-texto-container');

            opcoesContainer.style.display = 'none';
            escalaContainer.style.display = 'none';
            textoContainer.style.display = 'none';

            if (primeiraPergunta.tipo === 'multipla_escolha' && primeiraPergunta.opcoes) {
                opcoesContainer.style.display = 'block';
                document.getElementById('responder-opcoes').innerHTML = primeiraPergunta.opcoes.map((opcao, index) => `
                    <div class="opcao-resposta" onclick="Pesquisas.selectOption(${index})" data-opcao="${index}">
                        <input type="radio" name="pesquisa-opcao" value="${opcao.opcao}" id="opcao-${index}">
                        <label for="opcao-${index}">${opcao.opcao}</label>
                    </div>
                `).join('');
            } else if (primeiraPergunta.tipo === 'escala') {
                escalaContainer.style.display = 'block';
                document.querySelectorAll('.escala-option').forEach(opt => {
                    opt.classList.remove('selected');
                    opt.onclick = () => {
                        document.querySelectorAll('.escala-option').forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                        this.state.selectedResposta = opt.dataset.score;
                    };
                });
            } else {
                textoContainer.style.display = 'block';
            }

            Modal.open('responder-pesquisa-modal');
        } catch (error) {
            console.error('Erro ao abrir pesquisa:', error);
            alert('Erro ao carregar pesquisa');
        }
    },

    selectOption(index) {
        document.getElementById(`opcao-${index}`).checked = true;
        this.state.selectedResposta = document.getElementById(`opcao-${index}`).value;
    },

    async submit() {
        if (!this.state.currentPesquisa) return;

        // Verificar se há perguntas
        if (!this.state.currentPesquisa.perguntas || this.state.currentPesquisa.perguntas.length === 0) {
            alert('Esta pesquisa não possui perguntas.');
            return;
        }

        const primeiraPergunta = this.state.currentPesquisa.perguntas[0];
        let resposta = null;

        if (primeiraPergunta.tipo === 'multipla_escolha' || primeiraPergunta.tipo === 'escala') {
            resposta = this.state.selectedResposta;
        } else {
            resposta = document.getElementById('responder-resposta-texto').value;
        }

        if (!resposta) {
            alert('Por favor, forneça uma resposta');
            return;
        }

        try {
            // Preparar dados no formato esperado pelo backend
            const respostaData = [{
                question_id: primeiraPergunta.Id,
                resposta_texto: primeiraPergunta.tipo === 'texto' ? resposta : null,
                resposta_numerica: primeiraPergunta.tipo === 'escala' ? parseInt(resposta) : null,
                option_id: primeiraPergunta.tipo === 'multipla_escolha' ? this.getSelectedOptionId(resposta, primeiraPergunta.opcoes) : null
            }];

            await API.post(`/api/pesquisas/${this.state.currentPesquisa.Id}/responder`, { respostas: respostaData });
            this.closeModal();
            await this.loadList();
            Notifications.success('Resposta enviada com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar resposta:', error);
            alert('Erro ao enviar resposta');
        }
    },

    getSelectedOptionId(selectedValue, opcoes) {
        if (!opcoes) return null;
        const opcao = opcoes.find(opt => opt.opcao === selectedValue);
        return opcao ? opcao.Id : null;
    },

    closeModal() {
        Modal.close('responder-pesquisa-modal');
        this.state.currentPesquisa = null;
        this.state.selectedResposta = null;
    },

    async viewResponse(pesquisaId) {
        try {
            const data = await API.get(`/api/pesquisas/${pesquisaId}/my-response`);
            let message = `Pesquisa: ${data.survey.titulo}\n\n`;
            data.responses.forEach(response => {
                message += `Pergunta: ${response.pergunta_texto}\n`;
                if (response.resposta_texto) {
                    message += `Resposta: ${response.resposta_texto}\n`;
                } else if (response.resposta_numerica) {
                    message += `Resposta: ${response.resposta_numerica}\n`;
                }
                message += '\n';
            });
            message += `Respondido em: ${new Date(data.response_date).toLocaleString('pt-BR')}`;
            alert(message);
        } catch (error) {
            console.error('Erro ao carregar resposta:', error);
            alert('Erro ao carregar sua resposta');
        }
    },

    async checkPermissions() {
        try {
            const user = State.getUser();
            const isHRTD = user && user.departamento && (
                user.departamento.toUpperCase().includes('RH') ||
                user.departamento.toUpperCase().includes('TREINAM&DESENVOLV') ||
                user.departamento.toUpperCase().includes('DEPARTAMENTO ADM/RH/SESMT')
            );

            const actionsContainer = document.getElementById('pesquisas-actions-container');
            if (actionsContainer) {
                if (isHRTD) {
                    actionsContainer.style.display = 'flex';
                } else {
                    actionsContainer.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Erro ao verificar permissões:', error);
        }
    },

    // Função para alternar filtros (igual às outras abas)
    toggleFilters() {
        const filtersContainer = document.getElementById('survey-filters');
        const toggleBtn = document.querySelector('[data-action="toggleFilters"][data-param="survey-filters"]');
        const toggleText = toggleBtn.querySelector('span');

        if (filtersContainer.classList.contains('collapsed')) {
            filtersContainer.classList.remove('collapsed');
            toggleText.textContent = 'Ocultar Filtros';
        } else {
            filtersContainer.classList.add('collapsed');
            toggleText.textContent = 'Mostrar Filtros';
        }
    },

    // Função para limpar filtros
    clearFilters() {
        document.getElementById('survey-name-search').value = '';
        document.getElementById('survey-status-filter').value = '';
        this.loadList();
    },

    // Função para filtrar pesquisas
    filterSurveys() {
        const searchTerm = document.getElementById('survey-name-search').value.toLowerCase();
        const statusFilter = document.getElementById('survey-status-filter').value;
        const surveyItems = document.querySelectorAll('.pesquisa-item');

        surveyItems.forEach(item => {
            const title = item.querySelector('h4').textContent.toLowerCase();
            const status = item.querySelector('.badge').textContent.toLowerCase();

            let showItem = true;

            // Filtro por nome
            if (searchTerm && !title.includes(searchTerm)) {
                showItem = false;
            }

            // Filtro por status
            if (statusFilter) {
                const statusMap = {
                    'ativa': 'pendente',
                    'encerrada': 'encerrada',
                    'respondida': 'respondida',
                    'pendente': 'pendente'
                };

                if (statusFilter !== statusMap[statusFilter] && status !== statusFilter) {
                    showItem = false;
                }
            }

            item.style.display = showItem ? 'block' : 'none';
        });
    }
};

// Global functions for onclick
function loadPesquisas() { Pesquisas.loadList(); }
function abrirPesquisa(id) { Pesquisas.open(id); }
function submitRespostaPesquisa() { Pesquisas.submit(); }
function closeResponderPesquisaModal() { Pesquisas.closeModal(); }
function verRespostaPesquisa(id) { Pesquisas.viewResponse(id); }
function checkPesquisaPermissions() { Pesquisas.checkPermissions(); }
function toggleSurveyFilters() { Pesquisas.toggleFilters(); }
function clearSurveyFilters() { Pesquisas.clearFilters(); }
function filterSurveys() { Pesquisas.filterSurveys(); }