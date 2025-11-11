class PesquisasNovo {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.userInfo = {};
        this.surveys = [];
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        const viewMode = urlParams.get('view');
        const surveyId = urlParams.get('id');
        
        if (viewMode === 'true' && surveyId) {
            this.loadResultsView(parseInt(surveyId));
            return;
        }
        
        this.setupEventListeners();
        this.setupModalEncerrarListeners();
        this.loadSurveys();
        
        const shouldRespond = urlParams.get('respond');
        if (shouldRespond === 'true' && surveyId) {
            setTimeout(() => this.openResponseModal(parseInt(surveyId)), 500);
        }
        
        window.addEventListener('message', (event) => {
            if (event.data.type === 'SURVEY_CREATED') {
                this.showUpdateNotification('Nova pesquisa criada! Atualizando lista...');
                this.loadSurveys();
            }
        });
    }

    setupEventListeners() {
        const searchInput = document.getElementById('search');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadSurveys();
            }, 500);
        });

        document.getElementById('status-filter').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadSurveys();
        });

        document.getElementById('btn-refresh').addEventListener('click', () => this.loadSurveys());
        document.getElementById('btn-nova-pesquisa').addEventListener('click', () => {
            window.open('nova-pesquisa.html', '_blank', 'width=1200,height=800');
        });
    }

    async loadSurveys() {
        try {
            this.showLoading(true);

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 10
            });

            const search = document.getElementById('search').value;
            if (search) params.append('search', search);

            const status = document.getElementById('status-filter').value;
            if (status) params.append('status', status);

            const response = await fetch(`/api/surveys?${params}`);
            if (!response.ok) throw new Error('Erro ao carregar pesquisas');

            const data = await response.json();
            
            this.surveys = data.surveys;
            this.userInfo = data.user_info;
            this.totalPages = data.pagination.pages;

            this.renderSurveys();
            this.renderPagination(data.pagination);
            this.updateUI();

        } catch (error) {
            console.error('Erro ao carregar pesquisas:', error);
            this.showError('Erro ao carregar pesquisas: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    renderSurveys() {
        const container = document.getElementById('surveys-container');
        
        if (this.surveys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-poll" style="font-size: 4em; color: #cbd5e0; margin-bottom: 20px;"></i>
                    <h3 style="color: #718096; margin-bottom: 10px;">Nenhuma pesquisa encontrada</h3>
                    <p style="color: #a0aec0;">
                        ${this.userInfo.can_create ? 
                            'Crie sua primeira pesquisa clicando no botão "Nova Pesquisa"' : 
                            'Não há pesquisas disponíveis para você no momento'
                        }
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.surveys.map(survey => this.renderSurveyCard(survey)).join('');
    }

    renderSurveyCard(survey) {
        const statusCalculado = (survey.status_calculado || survey.status || '').toLowerCase();
        const statusClass = `status-${statusCalculado}`;
        const isHRTD = this.userInfo.is_hr_td;
        const statusLabel = survey.status_calculado || survey.status || 'Indefinido';
        
        // Verificar se o usuário está no público alvo
        const estaNoPublicoAlvo = survey.esta_no_publico_alvo === 1 || survey.esta_no_publico_alvo === true;
        
        // Para RH/T&D, verificar se está no público alvo antes de permitir responder
        // Para outros usuários, usar pode_responder que já verifica isso
        const canRespond = statusCalculado === 'ativa' && (
            isHRTD ? (survey.pode_responder && estaNoPublicoAlvo) : survey.pode_responder
        );
        
        // Mostrar badge "Não Respondida" apenas se o usuário estiver no público alvo
        const mostrarNaoRespondida = statusCalculado === 'encerrada' && !survey.ja_respondeu && estaNoPublicoAlvo;
        
        return `
            <div class="survey-card">
                <div class="survey-header">
                    <div>
                        <div class="survey-title">${survey.titulo}</div>
                        ${survey.descricao ? `<div class="survey-description">${survey.descricao}</div>` : ''}
                    </div>
                    <div class="survey-badges">
                        <span class="badge ${statusClass}">${statusLabel}</span>
                        ${survey.anonima ? '<span class="badge anonima">Anônima</span>' : ''}
                        ${survey.ja_respondeu ? 
                            '<span class="badge ja-respondeu">Respondida</span>' : 
                            (mostrarNaoRespondida ? 
                                '<span class="badge nao-respondeu">Não Respondida</span>' : 
                                ''
                            )
                        }
                    </div>
                </div>

                <div class="survey-info">
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <span class="info-label">Criado por:</span>
                        <span class="info-value">${survey.criador_nome}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <span class="info-label">Criado em:</span>
                        <span class="info-value">${SurveyUtils.formatDate(survey.data_criacao)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-play-circle"></i>
                        <span class="info-label">Início:</span>
                        <span class="info-value">${survey.data_inicio ? SurveyUtils.formatDate(survey.data_inicio) : 'Não definido'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-stop-circle"></i>
                        <span class="info-label">Fim:</span>
                        <span class="info-value">${survey.data_encerramento ? SurveyUtils.formatDate(survey.data_encerramento) : 'Não definido'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-users"></i>
                        <span class="info-label">Público:</span>
                        <span class="info-value" title="${this.getPublicoAlvoTooltip(survey)}">${survey.publico_alvo || 'Todos os colaboradores'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-question-circle"></i>
                        <span class="info-label">Perguntas:</span>
                        <span class="info-value">${survey.total_perguntas}</span>
                    </div>
                </div>

                ${isHRTD ? `
                    <div class="survey-progress">
                        <div class="progress-label">
                            <span>Taxa de Resposta</span>
                            <span>${survey.total_respostas}/${survey.total_usuarios_elegiveis} (${survey.taxa_resposta}%)</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${survey.taxa_resposta}%"></div>
                        </div>
                    </div>
                ` : ''}

                <div class="survey-actions">
                    ${canRespond ? `
                        <button class="btn btn-primary btn-sm" onclick="pesquisasNovo.openResponseModal(${survey.Id})">
                            <i class="fas fa-edit"></i> Responder
                        </button>
                    ` : statusCalculado === 'agendada' ? `
                        <button class="btn btn-secondary btn-sm" disabled>
                            <i class="fas fa-clock"></i> Aguardando início
                        </button>
                    ` : ''}
                    
                    ${isHRTD ? `
                        <button class="btn btn-success btn-sm" onclick="window.open('pesquisas-novo.html?id=${survey.Id}&view=true', '_blank', 'width=1400,height=900')">
                            <i class="fas fa-chart-bar"></i> Ver Resultados
                        </button>
                        ${statusCalculado === 'ativa' ? `
                            <button class="btn btn-danger btn-sm" onclick="pesquisasNovo.encerrarPesquisa(${survey.Id})" title="Encerrar pesquisa imediatamente">
                                <i class="fas fa-stop"></i> Encerrar
                            </button>
                        ` : statusCalculado === 'encerrada' ? `
                            <button class="btn btn-warning btn-sm" onclick="pesquisasNovo.abrirModalReabrirCard(${survey.Id})" title="Reabrir pesquisa para novas respostas">
                                <i class="fas fa-redo"></i> Abrir Novamente
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }

    async abrirModalReabrirCard(surveyId) {
        const modalHtml = `
            <div id="reabrir-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div style="background: white; padding: 24px; border-radius: 12px; max-width: 500px; width: 90%;">
                    <h3 style="margin: 0 0 16px 0; color: #1f2937;">
                        <i class="fas fa-redo" style="color: #10b981; margin-right: 8px;"></i>
                        Reabrir Pesquisa
                    </h3>
                    <p style="margin: 0 0 20px 0; color: #6b7280;">
                        Selecione a nova data e hora de encerramento para reabrir esta pesquisa:
                    </p>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">
                            Data e Hora de Encerramento
                        </label>
                        <input type="datetime-local" id="nova-data-encerramento-card" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button onclick="fecharModalReabrir()" class="btn btn-secondary">
                            Cancelar
                        </button>
                        <button onclick="pesquisasNovo.confirmarReaberturaCard(${surveyId})" class="btn btn-success">
                            <i class="fas fa-check"></i> Reabrir Pesquisa
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('nova-data-encerramento-card').min = now.toISOString().slice(0, 16);
    }

    async confirmarReaberturaCard(surveyId) {
        try {
            const novaData = document.getElementById('nova-data-encerramento-card').value;
            
            if (!novaData) {
                alert('Por favor, selecione uma data e hora');
                return;
            }
            
            await SurveyAPI.reopenSurvey(surveyId, novaData);
            
            alert('Pesquisa reaberta com sucesso!');
            fecharModalReabrir();
            this.loadSurveys();
            
        } catch (error) {
            console.error('Erro ao reabrir pesquisa:', error);
            alert('Erro ao reabrir pesquisa: ' + error.message);
        }
    }

    async encerrarPesquisa(surveyId) {
        this.pendingEncerrarSurveyId = surveyId;
        this.abrirModalEncerrar();
    }

    abrirModalEncerrar() {
        const modal = document.getElementById('encerrar-pesquisa-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    }

    setupModalEncerrarListeners() {
        const modal = document.getElementById('encerrar-pesquisa-modal');
        if (!modal) return;

        // Fechar ao clicar fora do modal (usar once para evitar múltiplos listeners)
        const clickOutsideHandler = (e) => {
            if (e.target === modal) {
                this.fecharModalEncerrar();
            }
        };
        
        // Fechar ao pressionar ESC
        const escHandler = (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.fecharModalEncerrar();
            }
        };

        // Remover listeners antigos se existirem
        modal.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);

        // Adicionar novos listeners
        modal.addEventListener('click', clickOutsideHandler);
        document.addEventListener('keydown', escHandler);
    }

    fecharModalEncerrar() {
        const modal = document.getElementById('encerrar-pesquisa-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        this.pendingEncerrarSurveyId = null;
    }

    async confirmarEncerrarPesquisa() {
        if (!this.pendingEncerrarSurveyId) {
            return;
        }

        const surveyId = this.pendingEncerrarSurveyId;
        this.fecharModalEncerrar();

        try {
            await SurveyAPI.closeSurvey(surveyId);
            
            // Mostrar notificação de sucesso
            this.mostrarNotificacao('Pesquisa encerrada com sucesso!', 'success');
            this.loadSurveys();
        } catch (error) {
            console.error('Erro ao encerrar pesquisa:', error);
            this.mostrarNotificacao('Erro ao encerrar pesquisa: ' + error.message, 'error');
        }
    }

    mostrarNotificacao(mensagem, tipo = 'success') {
        const notificacao = document.createElement('div');
        notificacao.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${tipo === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
        `;
        
        notificacao.innerHTML = `
            <i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="font-size: 20px;"></i>
            <span>${mensagem}</span>
        `;
        
        document.body.appendChild(notificacao);
        
        setTimeout(() => {
            notificacao.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notificacao.remove(), 300);
        }, 3000);
    }

    getPublicoAlvoTooltip(survey) {
        const partes = [];
        if (survey.filiais_filtro && survey.filiais_filtro.length > 0) {
            partes.push(`Filiais: ${survey.filiais_filtro.join(', ')}`);
        }
        if (survey.departamentos_filtro && survey.departamentos_filtro.length > 0) {
            partes.push(`Departamentos: ${survey.departamentos_filtro.join(', ')}`);
        }
        return partes.length > 0 ? partes.join('\n') : 'Todos os colaboradores';
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        
        if (pagination.pages <= 1) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        
        let html = `
            <button ${pagination.page <= 1 ? 'disabled' : ''} onclick="pesquisasNovo.goToPage(${pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="${i === pagination.page ? 'active' : ''}" onclick="pesquisasNovo.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        html += `
            <button ${pagination.page >= pagination.pages ? 'disabled' : ''} onclick="pesquisasNovo.goToPage(${pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = html;
    }

    updateUI() {
        document.getElementById('btn-nova-pesquisa').style.display = 
            this.userInfo.can_create ? 'flex' : 'none';
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadSurveys();
    }

    async openResponseModal(surveyId) {
        try {
            // Abrir a página responder-pesquisa.html em nova janela/aba
            window.open(`responder-pesquisa.html?id=${surveyId}`, '_blank', 'width=900,height=800');
        } catch (error) {
            console.error('Erro ao abrir pesquisa:', error);
            alert('Erro ao abrir pesquisa: ' + error.message);
        }
    }

    renderResponseModal(survey) {
        document.getElementById('modal-title').textContent = survey.titulo;
        
        const maxEscala = Math.max(...survey.perguntas
            .filter(p => p.tipo === 'escala')
            .map(p => (p.escala_max || 5) - (p.escala_min || 1) + 1)
        );
        
        const modalContent = document.querySelector('#response-modal .modal-content');
        if (modalContent) {
            modalContent.classList.remove('wide-scale', 'extra-wide-scale');
            if (maxEscala > 10) {
                modalContent.classList.add('extra-wide-scale');
            } else if (maxEscala > 7) {
                modalContent.classList.add('wide-scale');
            }
        }
        
        const formHtml = `
            <form id="response-form" class="response-form">
                ${survey.descricao ? `<p style="color: #718096; margin-bottom: 20px;">${survey.descricao}</p>` : ''}
                
                ${survey.perguntas.map((pergunta, index) => QuestionRenderer.renderForResponse(pergunta, index)).join('')}
                
                <div style="display: flex; gap: 15px; justify-content: flex-end; margin-top: 30px;">
                    <button type="button" class="btn btn-secondary" onclick="closeResponseModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-paper-plane"></i> Enviar Respostas
                    </button>
                </div>
            </form>
        `;
        
        document.getElementById('modal-body').innerHTML = formHtml;
        
        document.getElementById('response-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitResponse(survey.Id, survey.perguntas);
        });
    }

    async submitResponse(surveyId, perguntas) {
        try {
            const formData = new FormData(document.getElementById('response-form'));
            
            const validation = SurveyValidator.validateResponse(perguntas, formData);
            if (!validation.valid) {
                alert(validation.message);
                return;
            }
            
            const respostas = SurveyUtils.collectResponses(perguntas, formData);
            
            await SurveyAPI.submitResponse(surveyId, respostas);
            
            alert('Respostas enviadas com sucesso!');
            closeResponseModal();
            
            SurveyUtils.notifyParentWindow('SURVEY_RESPONSE_SUBMITTED', { surveyId });
            this.loadSurveys();
            
        } catch (error) {
            console.error('Erro ao enviar respostas:', error);
            alert('Erro ao enviar respostas: ' + error.message);
        }
    }

    async loadResultsView(surveyId) {
        try {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('surveys-container').style.display = 'none';
            document.getElementById('pagination').style.display = 'none';
            document.querySelector('.filters-section').style.display = 'none';
            
            const headerLeft = document.querySelector('.header-left');
            headerLeft.innerHTML = `
                <h1><i class="fas fa-chart-bar"></i> Resultados da Pesquisa</h1>
                <p>Visualização detalhada de respostas e estatísticas</p>
            `;
            
            const data = await SurveyAPI.getResults(surveyId);
            this.renderResultsView(data);
            
        } catch (error) {
            console.error('❌ Erro ao carregar visualização de resultados:', error);
            document.getElementById('loading').innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444;"></i>
                <p style="color: #ef4444; margin-top: 16px;">Erro ao carregar resultados: ${error.message}</p>
            `;
        }
    }

    renderResultsView(data) {
        document.getElementById('loading').style.display = 'none';
        const container = document.getElementById('surveys-container');
        container.style.display = 'block';
        
        // Armazenar dados para filtro (preservar filtro se já existir)
        this.resultsData = data;
        this.currentSurveyId = data.Id; // Armazenar ID da pesquisa para filtro
        if (this.filteredUserId === undefined) {
            this.filteredUserId = null;
        }
        
        // Preservar nome do usuário selecionado se existir
        const selectedUserName = this.selectedUserName || null;
        
        // Criar HTML com filtro de usuário e resultados
        let html = `
            <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="margin: 0 0 8px 0;">${data.titulo}</h2>
                ${data.descricao ? `<p style="margin: 0; color: #6b7280; margin-bottom: 20px;">${data.descricao}</p>` : ''}
                
                <!-- Filtro de Usuário -->
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Filtrar por Usuário:</label>
                    <div style="position: relative;">
                        <input type="text" id="user-search-input" placeholder="Digite o nome do usuário..." 
                               style="width: 100%; padding: 10px 40px 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;"
                               autocomplete="off">
                        <i class="fas fa-search" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af;"></i>
                        <div id="user-search-results" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-top: 4px; max-height: 300px; overflow-y: auto; z-index: 1000; display: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
                    </div>
                    <div id="selected-user-filter" style="margin-top: 12px; display: ${this.filteredUserId ? 'block' : 'none'};">
                        <span style="display: inline-flex; align-items: center; gap: 8px; background: #f0f9ff; border: 1px solid #0d556d; padding: 8px 12px; border-radius: 6px;">
                            <span id="selected-user-name" style="color: #0d556d; font-weight: 600;">${selectedUserName || ''}</span>
                            <button onclick="pesquisasNovo.clearUserFilter()" style="background: none; border: none; color: #0d556d; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-times"></i>
                            </button>
                        </span>
                    </div>
                </div>
                
                <!-- Estatísticas Gerais -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #0d556d;">
                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Total de Respostas</div>
                        <div style="font-size: 24px; font-weight: 700; color: #1f2937;">${data.total_respostas || 0}</div>
                    </div>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Taxa de Resposta</div>
                        <div style="font-size: 24px; font-weight: 700; color: #1f2937;">${data.taxa_resposta || 0}%</div>
                    </div>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Usuários Elegíveis</div>
                        <div style="font-size: 24px; font-weight: 700; color: #1f2937;">${data.total_usuarios_elegiveis || 0}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Renderizar cada pergunta com seus resultados
        data.perguntas.forEach((pergunta, index) => {
            html += this.renderQuestionResults(pergunta, index + 1);
        });
        
        container.innerHTML = html;
        
        // Configurar filtro de usuário
        this.setupUserFilter();
    }

    renderQuestionResults(pergunta, numero) {
        const respostasFiltradas = this.filteredUserId 
            ? pergunta.respostas.filter(r => r.usuario_id === this.filteredUserId)
            : pergunta.respostas;
        
        // Recalcular estatísticas apenas com respostas filtradas se houver filtro
        let estatisticas = pergunta.estatisticas || {};
        if (this.filteredUserId && respostasFiltradas.length > 0) {
            // Recalcular estatísticas básicas
            estatisticas = {
                ...estatisticas,
                total_respostas: respostasFiltradas.length
            };
            
            // Recalcular para múltipla escolha
            if (pergunta.tipo === 'multipla_escolha' && pergunta.opcoes) {
                const contagem_opcoes = {};
                pergunta.opcoes.forEach(opt => {
                    contagem_opcoes[opt.opcao] = { count: 0, porcentagem: 0 };
                });
                respostasFiltradas.forEach(r => {
                    if (r.opcao_selecionada && contagem_opcoes.hasOwnProperty(r.opcao_selecionada)) {
                        contagem_opcoes[r.opcao_selecionada].count++;
                    }
                });
                Object.keys(contagem_opcoes).forEach(opcao => {
                    if (respostasFiltradas.length > 0) {
                        contagem_opcoes[opcao].porcentagem = Math.round((contagem_opcoes[opcao].count / respostasFiltradas.length) * 100);
                    }
                });
                estatisticas.opcoes = contagem_opcoes;
            }
            
            // Recalcular para escala
            if (pergunta.tipo === 'escala') {
                const valores = respostasFiltradas.filter(r => r.resposta_numerica !== null).map(r => r.resposta_numerica);
                if (valores.length > 0) {
                    estatisticas.media = (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2);
                    estatisticas.distribuicao = {};
                    const min = pergunta.escala_min || 1;
                    const max = pergunta.escala_max || 5;
                    for (let i = min; i <= max; i++) {
                        const count = valores.filter(v => v === i).length;
                        estatisticas.distribuicao[i] = {
                            count: count,
                            porcentagem: Math.round((count / valores.length) * 100)
                        };
                    }
                }
            }
        }
        
        let statsHtml = '';
        
        if (pergunta.tipo === 'multipla_escolha' && estatisticas.opcoes) {
            // Estatísticas de múltipla escolha
            const opcoesArray = Object.entries(estatisticas.opcoes).map(([opcao, stats]) => ({
                opcao,
                ...stats
            }));
            
            statsHtml = `
                <div style="margin-top: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">Distribuição de Respostas:</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${opcoesArray.map(opcao => {
                            const porcentagem = opcao.porcentagem || 0;
                            return `
                                <div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                        <span style="color: #374151; font-size: 14px;">${opcao.opcao}</span>
                                        <span style="color: #6b7280; font-size: 14px; font-weight: 600;">${opcao.count} (${porcentagem}%)</span>
                                    </div>
                                    <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                                        <div style="background: linear-gradient(90deg, #0d556d 0%, #0a4555 100%); height: 100%; width: ${porcentagem}%; transition: width 0.3s;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (pergunta.tipo === 'escala' && estatisticas.media) {
            // Estatísticas de escala
            const distribuicao = estatisticas.distribuicao || {};
            const distribuicaoArray = Object.entries(distribuicao).map(([valor, stats]) => ({
                valor: parseInt(valor),
                ...stats
            })).sort((a, b) => a.valor - b.valor);
            
            statsHtml = `
                <div style="margin-top: 16px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px;">
                        <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Média</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0d556d;">${estatisticas.media}</div>
                        </div>
                        <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Total Respostas</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0d556d;">${estatisticas.total_respostas || 0}</div>
                        </div>
                    </div>
                    <h4 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">Distribuição por Valor:</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${distribuicaoArray.map(item => `
                            <div style="flex: 1; min-width: 80px; background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; border: 2px solid #e5e7eb;">
                                <div style="font-size: 18px; font-weight: 700; color: #0d556d; margin-bottom: 4px;">${item.valor}</div>
                                <div style="font-size: 12px; color: #6b7280;">${item.count} (${item.porcentagem}%)</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (pergunta.tipo === 'sim_nao') {
            // Estatísticas Sim/Não
            const simCount = respostasFiltradas.filter(r => r.resposta_texto && r.resposta_texto.toLowerCase() === 'sim').length;
            const naoCount = respostasFiltradas.filter(r => r.resposta_texto && r.resposta_texto.toLowerCase() === 'nao').length;
            const total = simCount + naoCount;
            const simPorcentagem = total > 0 ? Math.round((simCount / total) * 100) : 0;
            const naoPorcentagem = total > 0 ? Math.round((naoCount / total) * 100) : 0;
            
            statsHtml = `
                <div style="margin-top: 16px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="background: #f0fdf4; border: 2px solid #10b981; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: #10b981; margin-bottom: 4px;">Sim</div>
                            <div style="font-size: 14px; color: #6b7280;">${simCount} (${simPorcentagem}%)</div>
                        </div>
                        <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: #ef4444; margin-bottom: 4px;">Não</div>
                            <div style="font-size: 14px; color: #6b7280;">${naoCount} (${naoPorcentagem}%)</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Texto livre - mostrar apenas total
            statsHtml = `
                <div style="margin-top: 16px;">
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Total de Respostas</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0d556d;">${estatisticas.total_respostas || 0}</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                    <div style="background: #0d556d; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; flex-shrink: 0;">
                        ${numero}
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;">${pergunta.pergunta}</h3>
                        <span style="display: inline-block; background: #f3f4f6; color: #6b7280; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: capitalize;">
                            ${pergunta.tipo === 'texto_livre' ? 'Texto Livre' : pergunta.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : pergunta.tipo === 'escala' ? 'Escala Numérica' : 'Sim/Não'}
                        </span>
                    </div>
                </div>
                
                ${statsHtml}
                
                <!-- Lista de Respostas -->
                <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">
                        Respostas ${this.filteredUserId ? '(Filtradas)' : ''} (${respostasFiltradas.length})
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                        ${respostasFiltradas.length > 0 ? respostasFiltradas.map(resposta => {
                            let respostaHtml = '';
                            if (resposta.resposta_texto) {
                                respostaHtml = `<div style="color: #374151; white-space: pre-wrap; word-break: break-word;">${resposta.resposta_texto}</div>`;
                            } else if (resposta.resposta_numerica !== null && resposta.resposta_numerica !== undefined) {
                                respostaHtml = `<div style="font-size: 18px; font-weight: 700; color: #0d556d;">${resposta.resposta_numerica}</div>`;
                            } else if (resposta.opcao_selecionada) {
                                respostaHtml = `<div style="color: #0d556d; font-weight: 600;">${resposta.opcao_selecionada}</div>`;
                            }
                            
                            const dataResposta = resposta.data_resposta ? new Date(resposta.data_resposta).toLocaleString('pt-BR') : '';
                            
                            return `
                                <div style="background: #f9fafb; padding: 12px; border-radius: 8px; border-left: 3px solid #0d556d;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                        <span style="font-weight: 600; color: #1f2937;">${resposta.usuario_nome}</span>
                                        <span style="color: #6b7280; font-size: 12px;">${dataResposta}</span>
                                    </div>
                                    ${respostaHtml}
                                </div>
                            `;
                        }).join('') : `
                            <div style="text-align: center; padding: 24px; color: #9ca3af;">
                                <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>
                                <p style="margin: 0;">Nenhuma resposta encontrada</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    setupUserFilter() {
        const searchInput = document.getElementById('user-search-input');
        const resultsDiv = document.getElementById('user-search-results');
        let searchTimeout;
        let selectedUserId = null;
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            
            if (query.length < 2) {
                resultsDiv.style.display = 'none';
                return;
            }
            
            searchTimeout = setTimeout(async () => {
                try {
                    // Buscar apenas usuários elegíveis da pesquisa atual
                    const surveyId = pesquisasNovo.currentSurveyId;
                    if (!surveyId) {
                        resultsDiv.innerHTML = '<div style="padding: 12px; color: #ef4444; text-align: center;">ID da pesquisa não encontrado</div>';
                        resultsDiv.style.display = 'block';
                        return;
                    }
                    
                    const users = await SurveyAPI.searchUsers(query, surveyId);
                    if (users.length === 0) {
                        resultsDiv.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Nenhum usuário elegível encontrado</div>';
                        resultsDiv.style.display = 'block';
                        return;
                    }
                    
                    resultsDiv.innerHTML = users.slice(0, 10).map(user => `
                        <div onclick="pesquisasNovo.selectUserFilter(${user.userId}, '${user.nomeCompleto.replace(/'/g, "\\'")}')" 
                             style="padding: 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;"
                             onmouseover="this.style.background='#f9fafb'" 
                             onmouseout="this.style.background='white'">
                            <div style="font-weight: 600; color: #1f2937;">${user.nomeCompleto}</div>
                            ${user.descricaoDepartamento || user.departamento ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${user.descricaoDepartamento || user.departamento}</div>` : ''}
                        </div>
                    `).join('');
                    resultsDiv.style.display = 'block';
                } catch (error) {
                    console.error('Erro ao buscar usuários:', error);
                    resultsDiv.innerHTML = '<div style="padding: 12px; color: #ef4444; text-align: center;">Erro ao buscar usuários</div>';
                    resultsDiv.style.display = 'block';
                }
            }, 300);
        });
        
        // Fechar resultados ao clicar fora
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
            }
        });
    }

    selectUserFilter(userId, userName) {
        this.filteredUserId = userId;
        this.selectedUserName = userName;
        document.getElementById('user-search-input').value = '';
        document.getElementById('user-search-results').style.display = 'none';
        
        // Re-renderizar resultados com filtro
        this.renderResultsView(this.resultsData);
    }

    clearUserFilter() {
        this.filteredUserId = null;
        this.selectedUserName = null;
        
        // Re-renderizar resultados sem filtro
        this.renderResultsView(this.resultsData);
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('surveys-container').style.display = show ? 'none' : 'block';
    }

    showError(message) {
        console.error(message);
        document.getElementById('surveys-container').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e53e3e;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3em; margin-bottom: 20px;"></i>
                <h3>Erro ao carregar pesquisas</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="pesquisasNovo.loadSurveys()">
                    Tentar Novamente
                </button>
            </div>
        `;
    }

    showUpdateNotification(message) {
        let notification = document.getElementById('update-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'update-notification';
            notification.style.cssText = `
                position: fixed; top: 20px; right: 20px;
                background: linear-gradient(135deg, #0d556d 0%, #1a7a99 100%);
                color: white; padding: 16px 24px; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 10000;
                display: flex; align-items: center; gap: 12px; font-weight: 500;
                animation: slideInRight 0.3s ease-out;
            `;
            document.body.appendChild(notification);
        }
        
        notification.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i><span>${message}</span>`;
        notification.style.display = 'flex';
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.style.display = 'none', 300);
        }, 3000);
    }
}

let pesquisasNovo;
document.addEventListener('DOMContentLoaded', () => {
    pesquisasNovo = new PesquisasNovo();
});

function closeResponseModal() {
    document.getElementById('response-modal').style.display = 'none';
}

function fecharModalReabrir() {
    document.getElementById('reabrir-modal')?.remove();
}
