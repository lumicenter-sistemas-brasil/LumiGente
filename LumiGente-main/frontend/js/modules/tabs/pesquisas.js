// Pesquisas Tab Module
const Pesquisas = {
    state: {
        currentPesquisa: null,
        selectedResposta: null,
        permissions: {
            can_create: false,
            is_hr_td: false
        }
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
        this.setupMessageListener();
        this.setupVerRespostasModalListeners();
    },

    setupVerRespostasModalListeners() {
        // Fechar modal ao clicar fora
        const modal = document.getElementById('ver-respostas-pesquisa-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeVerRespostasModal();
                }
            });
        }

        // Fechar modal ao pressionar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                this.closeVerRespostasModal();
            }
        });
    },

    setupMessageListener() {
        // Escutar mensagens de janelas filhas (ex: responder-pesquisa.html)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SURVEY_RESPONSE_SUBMITTED') {
                // Atualizar a lista de pesquisas quando uma resposta for enviada
                this.loadList();
            }
        });
    },

    async loadList() {
        try {
            const container = document.getElementById('user-surveys-list');
            if (!container) return;

            container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando pesquisas...</div>';

            const response = await API.get('/api/pesquisas');
            if (response && response.user_info) {
                this.state.permissions = {
                    can_create: Boolean(response.user_info.can_create),
                    is_hr_td: Boolean(response.user_info.is_hr_td)
                };
                this.updateActionsVisibility();
            }
            this.updateList(response);
        } catch (error) {
            console.error('Erro ao carregar pesquisas:', error);
        }
    },

    updateList(data) {
        const container = document.getElementById('user-surveys-list');
        if (!container) return;

        const pesquisas = data && Array.isArray(data.surveys) ? data.surveys : Array.isArray(data) ? data : [];
        if (!pesquisas || pesquisas.length === 0) {
            container.innerHTML = '<div class="loading">Nenhuma pesquisa disponível.</div>';
            return;
        }

        container.innerHTML = pesquisas.map(pesquisa => {
            const statusCalculado = (pesquisa.status_calculado || pesquisa.status || '').toLowerCase();
            let statusLabel = 'Indefinido';
            let statusColor = '#6b7280';
            let statusIcon = 'lock';

            switch (statusCalculado) {
                case 'ativa':
                    statusLabel = 'Ativa';
                    statusColor = '#10b981';
                    statusIcon = 'check-circle';
                    break;
                case 'agendada':
                    statusLabel = 'Agendada';
                    statusColor = '#3b82f6';
                    statusIcon = 'clock';
                    break;
                case 'encerrada':
                    statusLabel = 'Encerrada';
                    statusColor = '#6b7280';
                    statusIcon = 'lock';
                    break;
                default:
                    statusLabel = pesquisa.status_calculado || pesquisa.status || 'Indefinido';
                    statusColor = '#6b7280';
                    statusIcon = 'lock';
                    break;
            }

            const jaRespondeu = Boolean(pesquisa.ja_respondeu);
            const podeResponder = statusCalculado === 'ativa' && Boolean(pesquisa.pode_responder);

            let actionHtml = '';
            if (jaRespondeu) {
                actionHtml = `
                    <button class="btn btn-secondary btn-sm" onclick="Pesquisas.viewResponse(${pesquisa.Id})">
                        ${this.icon('eye', 16)} Ver Resposta
                    </button>
                `;
            } else if (podeResponder) {
                actionHtml = `
                    <button class="btn btn-amber btn-sm" onclick="Pesquisas.open(${pesquisa.Id})">
                        ${this.icon('edit', 16)} Responder Pesquisa
                    </button>
                `;
            } else if (statusCalculado === 'agendada') {
                actionHtml = `
                    <button class="btn btn-secondary btn-sm" disabled>
                        ${this.icon('clock', 16)} Aguardando início
                    </button>
                `;
            } else {
                actionHtml = `
                    <button class="btn btn-secondary btn-sm" disabled>
                        ${this.icon('lock', 16)} Pesquisa Encerrada
                    </button>
                `;
            }

            return `
                <div class="pesquisa-item" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <h4 style="margin: 0 0 4px 0;">${pesquisa.titulo}</h4>
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">${pesquisa.descricao || 'Sem descrição'}</p>
                        </div>
                        <span class="badge" style="background-color: ${statusColor}; color: white; display: inline-flex; align-items: center; gap: 6px;">
                            ${this.icon(statusIcon, 16, 'white')} ${statusLabel}
                        </span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px; font-size: 14px; color: #6b7280;">
                        <span style="display: inline-flex; align-items: center; gap: 6px;">${this.icon('calendar', 16)} ${this.formatDate(pesquisa.data_inicio)}</span>
                        <span>até</span>
                        <span style="display: inline-flex; align-items: center; gap: 6px;">${this.icon('calendar-check', 16)} ${this.formatDate(pesquisa.data_encerramento)}</span>
                    </div>
                    ${actionHtml}
                </div>
            `;
        }).join('');

        // Ícones são inline SVG agora; não é necessário recriar via lucide
    },

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                // Tentar parse manual se Date falhar
                const [dataPart, horaPart] = dateString.split('T');
                if (!dataPart) return 'Data inválida';
                
                const [ano, mes, dia] = dataPart.split('-');
                if (horaPart) {
                    const [hora, minuto] = horaPart.split(':');
                    return `${dia}/${mes}/${ano} ${hora}:${minuto || '00'}`;
                }
                return `${dia}/${mes}/${ano}`;
            }
            
            // Adicionar 3 horas para compensar timezone UTC-3
            date.setHours(date.getHours() + 3);
            
            // Formatar com data e hora
            const dia = String(date.getDate()).padStart(2, '0');
            const mes = String(date.getMonth() + 1).padStart(2, '0');
            const ano = date.getFullYear();
            const hora = String(date.getHours()).padStart(2, '0');
            const minuto = String(date.getMinutes()).padStart(2, '0');
            
            return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
        } catch {
            return 'Data inválida';
        }
    },

    async open(pesquisaId) {
        try {
            // Abrir a página responder-pesquisa.html em nova janela/aba
            window.open(`responder-pesquisa.html?id=${pesquisaId}`, '_blank', 'width=900,height=800');
        } catch (error) {
            console.error('Erro ao abrir pesquisa:', error);
            alert('Erro ao abrir pesquisa');
        }
    },


    async viewResponse(pesquisaId) {
        try {
            const modal = document.getElementById('ver-respostas-pesquisa-modal');
            const content = document.getElementById('ver-respostas-content');
            
            // Mostrar modal com loading
            Modal.open('ver-respostas-pesquisa-modal');
            content.innerHTML = `
                <div class="loading" style="text-align: center; padding: 40px;">
                    <div class="spinner"></div>
                    <p style="margin-top: 16px; color: #6b7280;">Carregando respostas...</p>
                </div>
            `;

            const data = await API.get(`/api/pesquisas/${pesquisaId}/my-response`);
            
            // Renderizar respostas no modal
            const responseDate = new Date(data.response_date).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let html = `
                <div style="background: #f8fafc; border-left: 4px solid #0d556d; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px;">${data.survey.titulo}</h4>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                        <i class="fas fa-clock" style="margin-right: 6px;"></i>
                        Respondido em: ${responseDate}
                    </p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 20px;">
            `;

            data.responses.forEach((response, index) => {
                let respostaHtml = '';
                
                // Verificar se há opções disponíveis para exibir
                const temOpcoes = response.opcoes && response.opcoes.length > 0;
                
                if (temOpcoes) {
                    // Renderizar todas as opções disponíveis, destacando a selecionada
                    if (response.pergunta_tipo === 'escala') {
                        // Escala numérica - mostrar todos os números
                        const respostaSelecionada = response.resposta_numerica;
                        respostaHtml = `
                            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                                ${response.opcoes.map(opcao => {
                                    const isSelected = respostaSelecionada === opcao.valor;
                                    return `
                                        <div style="
                                            background: ${isSelected ? 'linear-gradient(135deg, #0d556d 0%, #0a4555 100%)' : '#f3f4f6'};
                                            color: ${isSelected ? 'white' : '#6b7280'};
                                            border: 2px solid ${isSelected ? '#0d556d' : '#e5e7eb'};
                                            padding: 12px 20px;
                                            border-radius: 8px;
                                            font-size: ${isSelected ? '18px' : '16px'};
                                            font-weight: ${isSelected ? '700' : '500'};
                                            min-width: 48px;
                                            text-align: center;
                                            transition: all 0.2s;
                                        ">
                                            ${opcao.texto}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            ${respostaSelecionada !== null && respostaSelecionada !== undefined ? `
                                <div style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-left: 4px solid #0d556d; border-radius: 4px;">
                                    <p style="margin: 0; color: #0d556d; font-size: 14px; font-weight: 600;">
                                        <i class="fas fa-check-circle" style="margin-right: 6px;"></i>
                                        Sua resposta: ${respostaSelecionada}
                                    </p>
                                </div>
                            ` : ''}
                        `;
                    } else if (response.pergunta_tipo === 'multipla_escolha') {
                        // Múltipla escolha - mostrar todas as opções
                        const respostaSelecionadaId = response.option_id;
                        respostaHtml = `
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
                                ${response.opcoes.map(opcao => {
                                    const isSelected = respostaSelecionadaId === opcao.id;
                                    return `
                                        <div style="
                                            background: ${isSelected ? '#f0f9ff' : '#ffffff'};
                                            border: 2px solid ${isSelected ? '#0d556d' : '#e5e7eb'};
                                            padding: 12px 16px;
                                            border-radius: 8px;
                                            display: flex;
                                            align-items: center;
                                            gap: 12px;
                                            transition: all 0.2s;
                                        ">
                                            <div style="
                                                width: 20px;
                                                height: 20px;
                                                border-radius: 50%;
                                                border: 2px solid ${isSelected ? '#0d556d' : '#d1d5db'};
                                                background: ${isSelected ? '#0d556d' : 'transparent'};
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                flex-shrink: 0;
                                            ">
                                                ${isSelected ? '<i class="fas fa-check" style="color: white; font-size: 10px;"></i>' : ''}
                                            </div>
                                            <span style="
                                                color: ${isSelected ? '#0d556d' : '#374151'};
                                                font-weight: ${isSelected ? '600' : '400'};
                                                flex: 1;
                                            ">${opcao.texto}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    } else if (response.pergunta_tipo === 'sim_nao') {
                        // Sim/Não - mostrar ambas as opções
                        const respostaSelecionada = response.resposta_texto ? response.resposta_texto.toLowerCase() : null;
                        respostaHtml = `
                            <div style="display: flex; gap: 12px; margin-bottom: 8px;">
                                ${response.opcoes.map(opcao => {
                                    const isSelected = respostaSelecionada === opcao.valor;
                                    const isSim = opcao.valor === 'sim';
                                    return `
                                        <div style="
                                            flex: 1;
                                            background: ${isSelected ? (isSim ? '#f0fdf4' : '#fef2f2') : '#ffffff'};
                                            border: 2px solid ${isSelected ? (isSim ? '#10b981' : '#ef4444') : '#e5e7eb'};
                                            padding: 16px;
                                            border-radius: 8px;
                                            text-align: center;
                                            transition: all 0.2s;
                                        ">
                                            <span style="
                                                color: ${isSelected ? (isSim ? '#10b981' : '#ef4444') : '#6b7280'};
                                                font-weight: ${isSelected ? '700' : '500'};
                                                font-size: 16px;
                                            ">${opcao.texto}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }
                } else if (response.resposta_texto) {
                    // Resposta de texto livre (sem opções)
                    respostaHtml = `
                        <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #374151; white-space: pre-wrap; word-break: break-word;">${response.resposta_texto}</p>
                        </div>
                    `;
                } else {
                    // Sem resposta
                    respostaHtml = `
                        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; color: #6b7280;">
                            <p style="margin: 0;">Sem resposta</p>
                        </div>
                    `;
                }

                html += `
                    <div style="background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                            <div style="background: #0d556d; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0;">
                                ${index + 1}
                            </div>
                            <div style="flex: 1;">
                                <h5 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px; font-weight: 600; line-height: 1.4;">
                                    ${response.pergunta_texto}
                                </h5>
                                ${respostaHtml}
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            content.innerHTML = html;

        } catch (error) {
            console.error('Erro ao carregar resposta:', error);
            const content = document.getElementById('ver-respostas-content');
            content.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 20px; border-radius: 8px; text-align: center;">
                    <i class="fas fa-exclamation-circle" style="font-size: 24px; margin-bottom: 12px; display: block;"></i>
                    <p style="margin: 0;">Erro ao carregar suas respostas. Tente novamente.</p>
                </div>
            `;
        }
    },

    closeVerRespostasModal() {
        Modal.close('ver-respostas-pesquisa-modal');
    },

    updateActionsVisibility() {
        const actionsContainer = document.getElementById('pesquisas-actions-container');
        const createBtn = document.getElementById('create-survey-btn');
        const manageBtn = document.getElementById('manage-survey-btn');

        const canCreate = !!(this.state.permissions && this.state.permissions.can_create);

        if (actionsContainer) {
            actionsContainer.style.display = canCreate ? 'flex' : 'none';
        }

        [createBtn, manageBtn].forEach(btn => {
            if (!btn) return;
            if (canCreate) {
                btn.removeAttribute('aria-disabled');
                btn.disabled = false;
            } else {
                btn.setAttribute('aria-disabled', 'true');
                btn.disabled = true;
            }
        });
    },

    async checkPermissions() {
        try {
            if (!this.state.permissions || typeof this.state.permissions.can_create !== 'boolean') {
                const user = State.getUser();
                const departmentDesc = (user && (user.descricaoDepartamento || user.DescricaoDepartamento || user.departamento || '')) || '';
                const normalized = departmentDesc.toUpperCase().trim();
                const allowedDepartments = [
                    'DEPARTAMENTO RH',
                    'SUPERVISAO RH',
                    'DEPARTAMENTO TREINAM&DESENVOLV'
                ];
                const canCreate = allowedDepartments.includes(normalized);
                this.state.permissions = {
                    can_create: canCreate,
                    is_hr_td: this.state.permissions ? this.state.permissions.is_hr_td : false
                };
            }
            this.updateActionsVisibility();
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
function verRespostaPesquisa(id) { Pesquisas.viewResponse(id); }
function closeVerRespostasModal() { Pesquisas.closeVerRespostasModal(); }
function checkPesquisaPermissions() { Pesquisas.checkPermissions(); }
function toggleSurveyFilters() { Pesquisas.toggleFilters(); }
function clearSurveyFilters() { Pesquisas.clearFilters(); }
function filterSurveys() { Pesquisas.filterSurveys(); }