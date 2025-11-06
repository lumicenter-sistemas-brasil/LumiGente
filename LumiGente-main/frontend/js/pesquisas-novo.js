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
        const statusClass = `status-${survey.status_calculado.toLowerCase()}`;
        const canRespond = survey.pode_responder;
        const isHRTD = this.userInfo.is_hr_td;
        
        return `
            <div class="survey-card">
                <div class="survey-header">
                    <div>
                        <div class="survey-title">${survey.titulo}</div>
                        ${survey.descricao ? `<div class="survey-description">${survey.descricao}</div>` : ''}
                    </div>
                    <div class="survey-badges">
                        <span class="badge ${statusClass}">${survey.status_calculado}</span>
                        ${survey.anonima ? '<span class="badge anonima">Anônima</span>' : ''}
                        ${survey.ja_respondeu ? 
                            '<span class="badge ja-respondeu">Respondida</span>' : 
                            (survey.status_calculado === 'Encerrada' ? 
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
                        <span class="info-value">${survey.publico_alvo}</span>
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
                    ` : ''}
                    
                    ${isHRTD ? `
                        <button class="btn btn-success btn-sm" onclick="window.open('pesquisas-novo.html?id=${survey.Id}&view=true', '_blank', 'width=1400,height=900')">
                            <i class="fas fa-chart-bar"></i> Ver Resultados
                        </button>
                        ${survey.status_calculado === 'Encerrada' ? `
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
            const survey = await SurveyAPI.getSurvey(surveyId);
            
            if (!survey.pode_responder) {
                alert('Você não pode responder esta pesquisa');
                return;
            }

            this.renderResponseModal(survey);
            document.getElementById('response-modal').style.display = 'flex';
            
        } catch (error) {
            console.error('Erro ao abrir modal de resposta:', error);
            alert('Erro ao carregar pesquisa: ' + error.message);
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
        
        container.innerHTML = `
            <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="margin: 0 0 8px 0;">${data.titulo}</h2>
                ${data.descricao ? `<p style="margin: 0; color: #6b7280;">${data.descricao}</p>` : ''}
            </div>
        `;
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
