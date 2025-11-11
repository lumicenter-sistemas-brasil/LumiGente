if (typeof window.HISTORICO_PLANILHAS === 'undefined') {
    window.HISTORICO_PLANILHAS = [
        {
            id: 'avaliacao',
            titulo: 'Avaliação de Desempenho',
            descricao: 'Relatório bruto das avaliações por colaborador exportadas do Feedz.',
            arquivo: 'relatorio_avaliacao_desempenho_por_colaborador - 2025-09-02.xlsx',
            icone: 'clipboard-check',
            atualizadoEm: '02/09/2025'
        },
        {
            id: 'feedbacks',
            titulo: 'Conteúdo de Feedbacks',
            descricao: 'Histórico completo dos feedbacks registrados (remetente, destinatário e conteúdo).',
            arquivo: 'relatorio_conteudo_feedbacks-20250209.xlsx',
            icone: 'message-square-text',
            atualizadoEm: '09/02/2025'
        },
        {
            id: 'medias',
            titulo: 'Médias de Feedbacks',
            descricao: 'Resumo estatístico de feedbacks positivos e de desenvolvimento por departamento.',
            arquivo: 'relatorio_medias_feedbacks-20250209.xlsx',
            icone: 'bar-chart-2',
            atualizadoEm: '09/02/2025'
        },
        {
            id: 'ranking',
            titulo: 'Ranking de Gamificação',
            descricao: 'Pontuação consolidada dos colaboradores no programa de gamificação.',
            arquivo: 'relatorio_ranking_gamificacao-20250209.xlsx',
            icone: 'trophy',
            atualizadoEm: '09/02/2025'
        },
        {
            id: 'resumo',
            titulo: 'Resumo de Atividades',
            descricao: 'Indicadores gerais de feedbacks, reconhecimentos e engajamento.',
            arquivo: 'relatorio_resumo_de_atividades_02_09_2025_16_17_45.xlsx',
            icone: 'line-chart',
            atualizadoEm: '02/09/2025'
        },
        {
            id: 'turnover',
            titulo: 'Turnovers',
            descricao: 'Registro de desligamentos com motivo e tempo de casa.',
            arquivo: 'relatorio_turnovers_20250209.xlsx',
            icone: 'user-minus',
            atualizadoEm: '09/02/2025'
        },
        {
            id: 'humor',
            titulo: 'Histórico de Humor',
            descricao: 'Resultados das pesquisas de humor consolidados por semana.',
            arquivo: 'relatorio_historico_humor_20250209.xlsx',
            icone: 'smile',
            atualizadoEm: '09/02/2025'
        },
        {
            id: 'colaboradores',
            titulo: 'Listagem de Colaboradores',
            descricao: 'Base completa de colaboradores com departamento, cargo e status.',
            arquivo: 'relatorio_listagem_colaboradores.xlsx',
            icone: 'users',
            atualizadoEm: '02/09/2025'
        },
        {
            id: 'pdi-ativos',
            titulo: 'PDI - Colaboradores Ativos',
            descricao: 'Planos de desenvolvimento em andamento para acompanhamento.',
            arquivo: 'relatorios_pdi/relatorio_plano-de-desenvolvimento-colaboradores-ativos-02_09_2025_15_08_18.xlsx',
            icone: 'target',
            atualizadoEm: '02/09/2025'
        },
        {
            id: 'pdi-inativos',
            titulo: 'PDI - Colaboradores Inativos',
            descricao: 'Planos de desenvolvimento concluídos ou interrompidos.',
            arquivo: 'relatorios_pdi/relatorio_plano-de-desenvolvimento-colaboradores-inativos-02_09_2025_15_08_33.xlsx',
            icone: 'clipboard-list',
            atualizadoEm: '02/09/2025'
        }
    ];
}

const HISTORICO_PLANILHAS = window.HISTORICO_PLANILHAS;

const OVERVIEW_DEBOUNCE_MS = 400;

function escapeHtml(value = '') {
    return value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function truncate(value = '', length = 120) {
    const str = value.toString();
    return str.length > length ? `${str.slice(0, length).trim()}…` : str;
}

class HistoricoManager {
    constructor() {
        this.dadosHistorico = {};
        this.filtrosAtivos = { periodo: 'todos', tipo: 'todos', departamento: 'todos' };
        this.paginacao = { paginaAtual: 1, itensPorPagina: 50, totalItens: 0 };
        this.cacheManager = window.CacheManager ? new window.CacheManager() : null;
        this.currentTab = 'overview';
        this.debounceTimers = {};

        this.overview = {
            objetivos: {
                loaded: false,
                data: [],
                filters: { search: '', status: 'todos', responsavelId: '', dateStart: '', dateEnd: '' },
                elements: {}
            },
            feedbacks: {
                loaded: false,
                data: [],
                filters: { search: '', type: 'todos', category: 'todos', dateStart: '', dateEnd: '' },
                elements: {}
            },
            recognitions: {
                loaded: false,
                data: [],
                filters: { search: '', badge: 'todos', dateStart: '', dateEnd: '' },
                elements: {}
            },
            humor: {
                loaded: false,
                data: [],
                filters: { search: '', department: 'todos', minScore: '', maxScore: '', dateStart: '', dateEnd: '' },
                elements: {}
            }
        };

        this.cachedUser = null;
        this.userHasHistoricoAccess = false;
        this.initialized = false;
        this.initRetryTimeout = null;

        this.init();
    }

    init() {
        if (this.initialized) return;

        const usuarioAtual = this.obterUsuarioAtual();

        if (!usuarioAtual || usuarioAtual._placeholder) {
            if (!this.initRetryTimeout) {
                this.initRetryTimeout = setTimeout(() => {
                    this.initRetryTimeout = null;
                    this.init();
                }, 150);
            }
            return;
        }

        this.userHasHistoricoAccess = HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual);
        this.initialized = true;

        if (!this.userHasHistoricoAccess) {
            this.renderRestrictedView();
            this.refreshIcons();
            return;
        }

        this.setupTabs();
        this.initOverview();
        this.renderizarDownloads();
        this.setupEventListeners();
        this.verificarPermissoes();
        this.inicializarSecoesFechadas();
        this.ensureOverviewLoaded();
    }

    setupTabs() {
        this.tabButtons = Array.from(document.querySelectorAll('.historico-tab'));
        this.tabPanels = {
            overview: document.getElementById('historico-overview'),
            downloads: document.getElementById('historico-downloads'),
            relatorios: document.getElementById('historico-relatorios')
        };

        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const tab = btn.dataset.historicoTab;
                this.switchHistoricoTab(tab);
            });
        });

        this.switchHistoricoTab('overview');
    }

    switchHistoricoTab(tabId) {
        if (!tabId || !this.tabPanels[tabId]) return;

        this.currentTab = tabId;

        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.historicoTab === tabId);
        });

        Object.entries(this.tabPanels).forEach(([id, panel]) => {
            if (panel) panel.classList.toggle('hidden', id !== tabId);
        });

        if (tabId === 'overview') {
            this.ensureOverviewLoaded();
        } else if (tabId === 'downloads') {
            this.renderizarDownloads();
        } else if (tabId === 'relatorios') {
            this.carregarDadosHistorico();
        }

        this.refreshIcons();
    }

    renderizarDownloads() {
        const container = document.getElementById('historico-downloads');
        if (!container) return;

        const basePath = (window.HistoricoConfig && window.HistoricoConfig.URLS && window.HistoricoConfig.URLS.EXCEL_FILES_PATH) || '/historico_feedz/';

        const cards = HISTORICO_PLANILHAS.map(planilha => `
            <article class="historico-download-card">
                <div class="download-card-icon"><i data-lucide="${planilha.icone}"></i></div>
                <div class="download-card-body">
                    <h4>${escapeHtml(planilha.titulo)}</h4>
                    <p>${escapeHtml(planilha.descricao)}</p>
                    <span class="download-meta">Atualizado em ${escapeHtml(planilha.atualizadoEm)} • XLSX</span>
                </div>
                <a class="historico-download-btn" href="${basePath}${planilha.arquivo}" download>
                    <i data-lucide="download"></i>
                    Baixar planilha
                </a>
            </article>
        `).join('');

        container.innerHTML = `
            <div class="historico-downloads-header">
                <h3>Planilhas oficiais exportadas do Feedz</h3>
                <p>Utilize estas planilhas para acompanhar indicadores históricos enquanto a visão interativa é expandida.</p>
            </div>
            <div class="historico-downloads-grid">
                ${cards}
            </div>
        `;

        this.refreshIcons();
    }

    initOverview() {
        const objetivoElements = {
            loading: document.getElementById('overview-objetivos-loading'),
            table: document.getElementById('overview-objetivos-table'),
            tbody: document.querySelector('#overview-objetivos-table tbody'),
            empty: document.getElementById('overview-objetivos-empty'),
            search: document.getElementById('overview-objetivos-search'),
            status: document.getElementById('overview-objetivos-status'),
            responsavel: document.getElementById('overview-objetivos-responsavel'),
            dateStart: document.getElementById('overview-objetivos-date-start'),
            dateEnd: document.getElementById('overview-objetivos-date-end'),
            refresh: document.getElementById('overview-objetivos-refresh'),
            clear: document.getElementById('overview-objetivos-clear')
        };
        this.overview.objetivos.elements = objetivoElements;

        const feedbackElements = {
            loading: document.getElementById('overview-feedbacks-loading'),
            table: document.getElementById('overview-feedbacks-table'),
            tbody: document.querySelector('#overview-feedbacks-table tbody'),
            empty: document.getElementById('overview-feedbacks-empty'),
            search: document.getElementById('overview-feedbacks-search'),
            type: document.getElementById('overview-feedbacks-type'),
            category: document.getElementById('overview-feedbacks-category'),
            dateStart: document.getElementById('overview-feedbacks-date-start'),
            dateEnd: document.getElementById('overview-feedbacks-date-end'),
            refresh: document.getElementById('overview-feedbacks-refresh'),
            clear: document.getElementById('overview-feedbacks-clear')
        };
        this.overview.feedbacks.elements = feedbackElements;

        const recognitionElements = {
            loading: document.getElementById('overview-recognitions-loading'),
            table: document.getElementById('overview-recognitions-table'),
            tbody: document.querySelector('#overview-recognitions-table tbody'),
            empty: document.getElementById('overview-recognitions-empty'),
            search: document.getElementById('overview-recognitions-search'),
            badge: document.getElementById('overview-recognitions-badge'),
            dateStart: document.getElementById('overview-recognitions-date-start'),
            dateEnd: document.getElementById('overview-recognitions-date-end'),
            refresh: document.getElementById('overview-recognitions-refresh'),
            clear: document.getElementById('overview-recognitions-clear')
        };
        this.overview.recognitions.elements = recognitionElements;

        const humorElements = {
            loading: document.getElementById('overview-humor-loading'),
            table: document.getElementById('overview-humor-table'),
            tbody: document.querySelector('#overview-humor-table tbody'),
            empty: document.getElementById('overview-humor-empty'),
            search: document.getElementById('overview-humor-search'),
            department: document.getElementById('overview-humor-department'),
            minScore: document.getElementById('overview-humor-min-score'),
            maxScore: document.getElementById('overview-humor-max-score'),
            dateStart: document.getElementById('overview-humor-date-start'),
            dateEnd: document.getElementById('overview-humor-date-end'),
            refresh: document.getElementById('overview-humor-refresh'),
            clear: document.getElementById('overview-humor-clear')
        };
        this.overview.humor.elements = humorElements;

        // Objetivos filters
        objetivoElements.search?.addEventListener('input', () => this.debounce('overview-objetivos', () => this.loadOverviewObjetivos()));
        objetivoElements.status?.addEventListener('change', () => this.loadOverviewObjetivos());
        objetivoElements.responsavel?.addEventListener('change', () => this.loadOverviewObjetivos());
        objetivoElements.dateStart?.addEventListener('change', () => this.loadOverviewObjetivos());
        objetivoElements.dateEnd?.addEventListener('change', () => this.loadOverviewObjetivos());
        objetivoElements.refresh?.addEventListener('click', () => this.loadOverviewObjetivos(true));
        objetivoElements.clear?.addEventListener('click', () => this.resetOverviewFilters('objetivos'));

        // Feedback filters
        feedbackElements.search?.addEventListener('input', () => this.debounce('overview-feedbacks', () => this.loadOverviewFeedbacks()));
        feedbackElements.type?.addEventListener('change', () => this.loadOverviewFeedbacks());
        feedbackElements.category?.addEventListener('change', () => this.loadOverviewFeedbacks());
        feedbackElements.dateStart?.addEventListener('change', () => this.loadOverviewFeedbacks());
        feedbackElements.dateEnd?.addEventListener('change', () => this.loadOverviewFeedbacks());
        feedbackElements.refresh?.addEventListener('click', () => this.loadOverviewFeedbacks(true));
        feedbackElements.clear?.addEventListener('click', () => this.resetOverviewFilters('feedbacks'));

        // Recognitions filters
        recognitionElements.search?.addEventListener('input', () => this.debounce('overview-recognitions', () => this.loadOverviewRecognitions()));
        recognitionElements.badge?.addEventListener('change', () => this.loadOverviewRecognitions());
        recognitionElements.dateStart?.addEventListener('change', () => this.loadOverviewRecognitions());
        recognitionElements.dateEnd?.addEventListener('change', () => this.loadOverviewRecognitions());
        recognitionElements.refresh?.addEventListener('click', () => this.loadOverviewRecognitions(true));
        recognitionElements.clear?.addEventListener('click', () => this.resetOverviewFilters('recognitions'));

        // Humor filters
        humorElements.search?.addEventListener('input', () => this.debounce('overview-humor', () => this.loadOverviewHumor()));
        humorElements.department?.addEventListener('change', () => this.loadOverviewHumor());
        humorElements.minScore?.addEventListener('change', () => this.loadOverviewHumor());
        humorElements.maxScore?.addEventListener('change', () => this.loadOverviewHumor());
        humorElements.dateStart?.addEventListener('change', () => this.loadOverviewHumor());
        humorElements.dateEnd?.addEventListener('change', () => this.loadOverviewHumor());
        humorElements.refresh?.addEventListener('click', () => this.loadOverviewHumor(true));
        humorElements.clear?.addEventListener('click', () => this.resetOverviewFilters('humor'));

        // Feedback conversation modal trigger via delegation
        feedbackElements.tbody?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-feedback-id]');
            if (button) {
                const feedbackId = Number(button.dataset.feedbackId);
                this.openFeedbackModal(feedbackId);
            }
        });

        const modalCloseBtn = document.getElementById('historico-feedback-modal-close');
        modalCloseBtn?.addEventListener('click', () => this.closeFeedbackModal());
        const modalOverlay = document.getElementById('historico-feedback-modal');
        modalOverlay?.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.closeFeedbackModal();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.closeFeedbackModal();
        });

        // populate selects
        this.loadOverviewResponsaveis();
        this.loadOverviewDepartments();
    }

    async loadOverviewResponsaveis() {
        const select = this.overview.objetivos.elements.responsavel;
        if (!select) return;

        try {
            const users = await API.get('/api/users/feedback');
            const sorted = (users || []).sort((a, b) => (a.nomeCompleto || '').localeCompare(b.nomeCompleto || '', 'pt-BR'));
            const options = ['<option value="">Todos</option>'];
            sorted.forEach(user => {
                options.push(`<option value="${user.userId}">${escapeHtml(user.nomeCompleto || user.nome || '-')}</option>`);
            });
            select.innerHTML = options.join('');
        } catch (error) {
            if (error?.status === 403) {
                this.handleForbiddenAccess(error);
                return;
            }
            console.error('Erro ao carregar responsáveis para visão RH:', error);
        }
    }

    async loadOverviewDepartments() {
        const select = this.overview.humor.elements.department;
        if (!select) return;

        try {
            const departments = await API.get('/api/analytics/departments-list');
            const options = ['<option value="todos">Todos</option>'];
            (departments || []).forEach(dept => {
                const name = dept.name || dept.Departamento || dept.value;
                if (name) {
                    options.push(`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`);
                }
            });
            select.innerHTML = options.join('');
        } catch (error) {
            if (error?.status === 403) {
                this.handleForbiddenAccess(error);
                return;
            }
            console.error('Erro ao carregar departamentos para visão RH:', error);
        }
    }

    ensureOverviewLoaded(force = false) {
        if (!this.userHasHistoricoAccess) {
            this.displayOverviewForbidden();
            return;
        }
        if (force || !this.overview.objetivos.loaded) this.loadOverviewObjetivos(force);
        if (force || !this.overview.feedbacks.loaded) this.loadOverviewFeedbacks(force);
        if (force || !this.overview.recognitions.loaded) this.loadOverviewRecognitions(force);
        if (force || !this.overview.humor.loaded) this.loadOverviewHumor(force);
    }

    async loadOverviewObjetivos(force = false) {
        if (!this.userHasHistoricoAccess) {
            this.displayOverviewForbidden();
            return;
        }
        const section = this.overview.objetivos;
        if (!force && section.loading) return;

        const { search, status, responsavelId, dateStart, dateEnd } = {
            search: section.elements.search?.value.trim() || '',
            status: section.elements.status?.value || 'todos',
            responsavelId: section.elements.responsavel?.value || '',
            dateStart: section.elements.dateStart?.value || '',
            dateEnd: section.elements.dateEnd?.value || ''
        };

        section.filters = { search, status, responsavelId, dateStart, dateEnd };
        this.setSectionLoading('objetivos', true);

        try {
            const params = { status };
            if (search) params.search = search;
            if (responsavelId) params.responsavelId = responsavelId;
            if (dateStart) params.dateStart = dateStart;
            if (dateEnd) params.dateEnd = dateEnd;
            const data = await API.get('/api/analytics/rh/objetivos', params);
            section.loaded = true;
            section.data = data || [];
            this.updateObjetivosTable(section.data);
        } catch (error) {
            if (error?.status === 403) {
                this.handleForbiddenAccess(error);
            } else {
                console.error('Erro ao carregar objetivos (visão RH):', error);
                this.showOverviewError('objetivos', error);
            }
        } finally {
            this.setSectionLoading('objetivos', false);
        }
    }

    updateObjetivosTable(data) {
        const { table, tbody, empty } = this.overview.objetivos.elements;
        if (!tbody || !table || !empty) return;

        if (!data || data.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'flex';
            this.refreshIcons();
            return;
        }

        const rows = data.map(obj => {
            const responsaveis = (obj.responsaveis || '').split(';').map(str => str.trim()).filter(Boolean);
            const responsaveisHtml = responsaveis.length
                ? responsaveis.map(name => `<span class="table-muted">${escapeHtml(name)}</span>`).join('')
                : '<span class="table-muted">—</span>';

            const status = escapeHtml(obj.status || '—');
            const statusClass = status.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const progresso = obj.progresso != null ? `${Math.round(Number(obj.progresso))}%` : '—';
            const periodo = `${formatDate(obj.data_inicio)} - ${formatDate(obj.data_fim)}`;

            return `
                <tr>
                    <td>
                        ${escapeHtml(obj.titulo || 'Sem título')}
                        <span class="table-muted">Criado em ${formatDate(obj.created_at)}</span>
                    </td>
                    <td>${responsaveisHtml}</td>
                    <td>
                        ${escapeHtml(obj.criador_nome || '—')}
                        <span class="table-muted">Atualizado ${formatDate(obj.updated_at)}</span>
                    </td>
                    <td>${escapeHtml(periodo)}</td>
                    <td><span class="status status-${statusClass}">${status}</span></td>
                    <td>${escapeHtml(progresso)}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
        table.style.display = 'table';
        empty.style.display = 'none';
        this.refreshIcons();
    }

    async loadOverviewFeedbacks(force = false) {
        if (!this.userHasHistoricoAccess) {
            this.displayOverviewForbidden();
            return;
        }
        const section = this.overview.feedbacks;
        if (!force && section.loading) return;

        const { search, type, category, dateStart, dateEnd } = {
            search: section.elements.search?.value.trim() || '',
            type: section.elements.type?.value || 'todos',
            category: section.elements.category?.value || 'todos',
            dateStart: section.elements.dateStart?.value || '',
            dateEnd: section.elements.dateEnd?.value || ''
        };

        section.filters = { search, type, category, dateStart, dateEnd };
        this.setSectionLoading('feedbacks', true);

        try {
            const params = { type, category };
            if (search) params.search = search;
            if (dateStart) params.dateStart = dateStart;
            if (dateEnd) params.dateEnd = dateEnd;
            const data = await API.get('/api/analytics/rh/feedbacks', params);
            section.loaded = true;
            section.data = data || [];
            this.updateFeedbacksTable(section.data);
        } catch (error) {
            if (error?.status === 403) {
                this.handleForbiddenAccess(error);
            } else {
                console.error('Erro ao carregar feedbacks (visão RH):', error);
                this.showOverviewError('feedbacks', error);
            }
        } finally {
            this.setSectionLoading('feedbacks', false);
        }
    }

    updateFeedbacksTable(data) {
        const { table, tbody, empty } = this.overview.feedbacks.elements;
        if (!tbody || !table || !empty) return;

        if (!data || data.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'flex';
            this.refreshIcons();
            return;
        }

        const rows = data.map(feedback => `
            <tr>
                <td>
                    ${formatDateTime(feedback.created_at)}
                    <span class="table-muted">${escapeHtml(feedback.from_department || '-')}</span>
                </td>
                <td>
                    ${escapeHtml(feedback.from_name || '—')}
                    <span class="table-muted">${escapeHtml(feedback.from_department || '-')}</span>
                </td>
                <td>
                    ${escapeHtml(feedback.to_name || '—')}
                    <span class="table-muted">${escapeHtml(feedback.to_department || '-')}</span>
                </td>
                <td>${escapeHtml(feedback.type || '—')}</td>
                <td>${escapeHtml(feedback.category || '—')}</td>
                <td>${escapeHtml(truncate(feedback.message || '', 120))}</td>
                <td>
                    <button type="button" class="link-button" data-feedback-id="${feedback.Id}">
                        <i data-lucide="messages-square"></i>
                        Ver conversa
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
        table.style.display = 'table';
        empty.style.display = 'none';
        this.refreshIcons();
    }

    async loadOverviewRecognitions(force = false) {
        if (!this.userHasHistoricoAccess) {
            this.displayOverviewForbidden();
            return;
        }
        const section = this.overview.recognitions;
        if (!force && section.loading) return;

        const { search, badge, dateStart, dateEnd } = {
            search: section.elements.search?.value.trim() || '',
            badge: section.elements.badge?.value || 'todos',
            dateStart: section.elements.dateStart?.value || '',
            dateEnd: section.elements.dateEnd?.value || ''
        };

        section.filters = { search, badge, dateStart, dateEnd };
        this.setSectionLoading('recognitions', true);

        try {
            const params = { badge };
            if (search) params.search = search;
            if (dateStart) params.dateStart = dateStart;
            if (dateEnd) params.dateEnd = dateEnd;
            const data = await API.get('/api/analytics/rh/reconhecimentos', params);
            section.loaded = true;
            section.data = data || [];
            this.updateRecognitionsTable(section.data);
        } catch (error) {
            if (error?.status === 403) {
                this.handleForbiddenAccess(error);
            } else {
                console.error('Erro ao carregar reconhecimentos (visão RH):', error);
                this.showOverviewError('recognitions', error);
            }
        } finally {
            this.setSectionLoading('recognitions', false);
        }
    }

    updateRecognitionsTable(data) {
        const { table, tbody, empty } = this.overview.recognitions.elements;
        if (!tbody || !table || !empty) return;

        if (!data || data.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'flex';
            this.refreshIcons();
            return;
        }

        const rows = data.map(rec => `
            <tr>
                <td>${formatDateTime(rec.created_at)}</td>
                <td>
                    ${escapeHtml(rec.from_name || '—')}
                    <span class="table-muted">${escapeHtml(rec.from_department || '-')}</span>
                </td>
                <td>
                    ${escapeHtml(rec.to_name || '—')}
                    <span class="table-muted">${escapeHtml(rec.to_department || '-')}</span>
                </td>
                <td>${escapeHtml(rec.badge || '—')}</td>
                <td>${escapeHtml(truncate(rec.message || '', 120))}</td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
        table.style.display = 'table';
        empty.style.display = 'none';
        this.refreshIcons();
    }

    async loadOverviewHumor(force = false) {
        if (!this.userHasHistoricoAccess) {
            this.displayOverviewForbidden();
            return;
        }
        const section = this.overview.humor;
        if (!force && section.loading) return;

        const { search, department, minScore, maxScore, dateStart, dateEnd } = {
            search: section.elements.search?.value.trim() || '',
            department: section.elements.department?.value || 'todos',
            minScore: section.elements.minScore?.value || '',
            maxScore: section.elements.maxScore?.value || '',
            dateStart: section.elements.dateStart?.value || '',
            dateEnd: section.elements.dateEnd?.value || ''
        };

        section.filters = { search, department, minScore, maxScore, dateStart, dateEnd };
        this.setSectionLoading('humor', true);

        try {
            const params = { department };
            if (search) params.search = search;
            if (minScore !== '') params.minScore = minScore;
            if (maxScore !== '') params.maxScore = maxScore;
            if (dateStart) params.dateStart = dateStart;
            if (dateEnd) params.dateEnd = dateEnd;
            const data = await API.get('/api/analytics/rh/humor', params);
            section.loaded = true;
            section.data = data || [];
            this.updateHumorTable(section.data);
        } catch (error) {
            if (error?.status === 403) {
                this.handleForbiddenAccess(error);
            } else {
                console.error('Erro ao carregar dados de humor (visão RH):', error);
                this.showOverviewError('humor', error);
            }
        } finally {
            this.setSectionLoading('humor', false);
        }
    }

    updateHumorTable(data) {
        const { table, tbody, empty } = this.overview.humor.elements;
        if (!tbody || !table || !empty) return;

        if (!data || data.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'flex';
            this.refreshIcons();
            return;
        }

        const rows = data.map(item => `
            <tr>
                <td>${formatDateTime(item.created_at)}</td>
                <td>${escapeHtml(item.user_name || '—')}</td>
                <td>${escapeHtml(item.department || '—')}</td>
                <td>${escapeHtml(item.score != null ? item.score : '—')}</td>
                <td>${escapeHtml(truncate(item.description || '', 120))}</td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
        table.style.display = 'table';
        empty.style.display = 'none';
        this.refreshIcons();
    }

    setSectionLoading(sectionKey, isLoading) {
        const elements = this.overview[sectionKey]?.elements;
        if (!elements) return;

        const { loading, table, empty } = elements;
        if (loading) loading.style.display = isLoading ? 'flex' : 'none';
        if (isLoading && table) table.style.display = 'none';
        if (isLoading && empty) empty.style.display = 'none';
        this.overview[sectionKey].loading = isLoading;
    }

    showOverviewError(sectionKey, error) {
        const elements = this.overview[sectionKey]?.elements;
        if (!elements) return;
        const { empty } = elements;
        if (!empty) return;

        const message = error?.data?.error || error?.message || 'Não foi possível carregar os dados.';
        empty.innerHTML = `
            <div class="historico-empty" style="display:flex;">
                <i data-lucide="alert-triangle"></i>
                <h4>Erro ao carregar</h4>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
        empty.style.display = 'flex';
        this.refreshIcons();
    }

    resetOverviewFilters(sectionKey) {
        const section = this.overview[sectionKey];
        if (!section || !section.elements) return;

        const elements = section.elements;
        if (elements.search) elements.search.value = '';
        if (elements.status) elements.status.value = 'todos';
        if (elements.responsavel) elements.responsavel.value = '';
        if (elements.type) elements.type.value = 'todos';
        if (elements.category) elements.category.value = 'todos';
        if (elements.badge) elements.badge.value = 'todos';
        if (elements.department) elements.department.value = 'todos';
        if (elements.minScore) elements.minScore.value = '';
        if (elements.maxScore) elements.maxScore.value = '';
        if (elements.dateStart) elements.dateStart.value = '';
        if (elements.dateEnd) elements.dateEnd.value = '';

        section.loaded = false;
        this.ensureOverviewLoaded(true);
    }

    openFeedbackModal(feedbackId) {
        if (!feedbackId) return;
        const feedback = this.overview.feedbacks.data.find(item => item.Id === feedbackId);
        if (!feedback) return;

        const overlay = document.getElementById('historico-feedback-modal');
        const info = document.getElementById('historico-feedback-modal-info');
        const body = document.getElementById('historico-feedback-modal-body');
        const loading = document.getElementById('historico-feedback-modal-loading');

        if (!overlay || !info || !body || !loading) return;

        overlay.classList.remove('hidden');
        body.innerHTML = '';
        loading.style.display = 'flex';

        info.innerHTML = `
            <div><strong>Data:</strong> ${formatDateTime(feedback.created_at)}</div>
            <div><strong>De:</strong> ${escapeHtml(feedback.from_name || '—')} (${escapeHtml(feedback.from_department || '-')})</div>
            <div><strong>Para:</strong> ${escapeHtml(feedback.to_name || '—')} (${escapeHtml(feedback.to_department || '-')})</div>
            <div><strong>Tipo/Categoria:</strong> ${escapeHtml(feedback.type || '—')} / ${escapeHtml(feedback.category || '—')}</div>
            <div><strong>Mensagem original:</strong><br>${escapeHtml(feedback.message || '—')}</div>
        `;

        API.get(`/api/analytics/rh/feedbacks/${feedbackId}/mensagens`).then(messages => {
            loading.style.display = 'none';
            this.renderFeedbackMessages(messages || []);
        }).catch(error => {
            loading.style.display = 'none';
            console.error('Erro ao carregar mensagens do feedback (visão RH):', error);
            body.innerHTML = `<div class="historico-empty" style="display:flex; padding: 24px;">
                <i data-lucide="alert-triangle"></i>
                <h4>Não foi possível carregar a conversa</h4>
            </div>`;
            this.refreshIcons();
        });
    }

    renderFeedbackMessages(messages) {
        const body = document.getElementById('historico-feedback-modal-body');
        if (!body) return;

        if (!messages || messages.length === 0) {
            body.innerHTML = `<div class="historico-empty" style="display:flex; padding: 24px;">
                <i data-lucide="inbox"></i>
                <h4>Nenhuma mensagem encontrada</h4>
                <p>Este feedback não possui respostas adicionais.</p>
            </div>`;
            this.refreshIcons();
            return;
        }

        const rows = messages.map(msg => `
            <div class="historico-feedback-message">
                <div class="message-header">
                    <span><strong>${escapeHtml(msg.user_name || 'Colaborador')}</strong></span>
                    <span>${formatDateTime(msg.created_at)}</span>
                </div>
                <div class="message-body">${escapeHtml(msg.message || '')}</div>
            </div>
        `).join('');

        body.innerHTML = rows;
    }

    closeFeedbackModal() {
        const overlay = document.getElementById('historico-feedback-modal');
        if (overlay) overlay.classList.add('hidden');
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-tab="historico"]')) {
                if (this.currentTab === 'overview') this.ensureOverviewLoaded();
                if (this.currentTab === 'relatorios') this.carregarDadosHistorico();
            }
            if (e.target.closest('.historico-section .card-header')) this.toggleSecao(e.target.closest('.historico-section'));
        });

        ['historico-periodo', 'historico-tipo', 'historico-departamento'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.addEventListener('change', () => this.aplicarFiltros());
        });

        this.iniciarMonitoramentoSeguranca();
    }

    verificarPermissoes() {
        const usuarioAtual = this.obterUsuarioAtual();
        if (!usuarioAtual || usuarioAtual._placeholder) {
            return;
        }
        this.userHasHistoricoAccess = HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual);
        if (!this.userHasHistoricoAccess) {
            this.renderRestrictedView();
        }
    }

    obterUsuarioAtual() {
        const stateUser = (window.State && typeof window.State.getUser === 'function') ? window.State.getUser() : null;
        if (stateUser) {
            this.cachedUser = stateUser;
            return this.cachedUser;
        }

        const currentUser = window.currentUser || window.cachedUser;
        if (currentUser) {
            this.cachedUser = currentUser;
            return this.cachedUser;
        }

        if (!this.cachedUser || !this.cachedUser._placeholder) {
            this.cachedUser = {
                _placeholder: true,
                permissoes: [],
                permissions: {},
                departamento: '',
                role: '',
                hierarchyLevel: 0
            };
        }

        return this.cachedUser;
    }

    iniciarMonitoramentoSeguranca() {
        HistoricoPermissions.iniciarMonitoramento(() => {
            const usuarioAtual = this.obterUsuarioAtual();
            return HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual);
        });
    }

    async carregarDadosHistorico() {
        if (this.currentTab !== 'relatorios') return;

        try {
            const usuarioAtual = this.obterUsuarioAtual();
            if (!HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual)) {
                return;
            }

            if (this.cacheManager) {
                const dadosCache = this.cacheManager.obterDadosHistorico('todos', this.filtrosAtivos);
                if (dadosCache) {
                    this.dadosHistorico = dadosCache;
                    HistoricoFilters.carregarDepartamentos(this.dadosHistorico);
                    HistoricoFilters.carregarPeriodos(this.dadosHistorico);
                    this.aplicarFiltros();
                    return;
                }
            }
            
            await this.simularCarregamentoDados();
            
            if (this.cacheManager) {
                this.cacheManager.armazenarDadosHistorico('todos', this.dadosHistorico, this.filtrosAtivos);
            }

            if (Object.keys(this.dadosHistorico).length === 0) {
                this.toggleVisaoInterativa(false);
                return;
            }
            
            HistoricoFilters.carregarDepartamentos(this.dadosHistorico);
            HistoricoFilters.carregarPeriodos(this.dadosHistorico);
            this.aplicarFiltros();
        } catch (error) {
            console.error('Erro ao carregar dados históricos:', error);
            this.toggleVisaoInterativa(false);
        }
    }

    async simularCarregamentoDados() {
        try {
            const response = await fetch('/api/historico/dados', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('Acesso aos dados interativos do histórico negado');
                    return;
                }
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const resultado = await response.json();
            
            if (resultado.success && resultado.dados) {
                this.dadosHistorico = resultado.dados;
                if (Object.keys(this.dadosHistorico).length === 0) {
                    this.toggleVisaoInterativa(false);
                } else {
                console.log('✅ Dados históricos carregados do backend');
                }
            } else {
                console.warn('⚠️ Backend não retornou dados históricos');
                this.dadosHistorico = {};
                this.toggleVisaoInterativa(false);
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados do backend:', error);
            HistoricoExport.mostrarNotificacao('Erro ao carregar dados históricos do servidor', 'error');
            this.dadosHistorico = {};
            this.toggleVisaoInterativa(false);
        }
    }

    aplicarFiltros() {
        this.filtrosAtivos.periodo = document.getElementById('historico-periodo')?.value || 'todos';
        this.filtrosAtivos.tipo = document.getElementById('historico-tipo')?.value || 'todos';
        this.filtrosAtivos.departamento = document.getElementById('historico-departamento')?.value || 'todos';
        this.atualizarExibicao();
    }

    atualizarExibicao() {
        const secoes = document.querySelectorAll('.historico-section');
        secoes.forEach(secao => {
            const tipoSecao = secao.getAttribute('data-tipo');
            const deveExibir = this.filtrosAtivos.tipo === 'todos' || this.filtrosAtivos.tipo === tipoSecao;
            
            if (deveExibir) {
                secao.classList.remove('hidden');
                this.carregarDadosSecao(tipoSecao);
            } else {
                secao.classList.add('hidden');
            }
        });
    }

    carregarDadosSecao(tipoSecao) {
        const dados = this.dadosHistorico[tipoSecao];
        if (!dados) return;

        const loadingElement = document.getElementById(`${tipoSecao}-loading`);
        const tableElement = document.getElementById(`${tipoSecao}-table`);

        if (loadingElement) loadingElement.style.display = 'none';
        if (tableElement) {
            tableElement.style.display = 'block';
            HistoricoRenderer.renderizarTabela(tipoSecao, dados, tableElement, this.paginacao, this.filtrosAtivos);
        }
    }

    irParaPagina(tipoSecao, pagina) {
        this.paginacao.paginaAtual = pagina;
        const dados = this.dadosHistorico[tipoSecao];
        if (dados) {
            const container = document.getElementById(`${tipoSecao}-table`);
            if (container) {
                HistoricoRenderer.renderizarTabela(tipoSecao, dados, container, this.paginacao, this.filtrosAtivos);
            }
        }
    }

    inicializarSecoesFechadas() {
        document.querySelectorAll('.historico-section').forEach(secao => secao.classList.add('collapsed'));
    }

    toggleSecao(secao) {
        secao.classList.toggle('collapsed');
    }

    exportHistoricoData(tipoSecao) {
        HistoricoExport.exportarDados(tipoSecao, this.dadosHistorico, this.filtrosAtivos);
    }

    toggleVisaoInterativa(hasData) {
        const corpo = document.getElementById('historico-relatorios-body');
        const placeholder = document.getElementById('historico-relatorios-placeholder');

        if (corpo) corpo.style.display = hasData ? '' : 'none';
        if (placeholder) placeholder.style.display = hasData ? 'none' : 'flex';
        this.refreshIcons();
    }

    refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    debounce(key, callback) {
        clearTimeout(this.debounceTimers[key]);
        this.debounceTimers[key] = setTimeout(callback, OVERVIEW_DEBOUNCE_MS);
    }

    handleForbiddenAccess(error) {
        this.userHasHistoricoAccess = false;
        if (window.cachedTabPermissions && typeof window.cachedTabPermissions === 'object') {
            window.cachedTabPermissions.historico = false;
        }
        if (error) {
            console.warn('[Historico] Acesso negado pelo backend para visão histórica.', error);
        }
        this.displayOverviewForbidden();
        this.renderRestrictedView();
        HistoricoPermissions.mostrarErroPermissao();
    }

    displayOverviewForbidden() {
        Object.entries(this.overview).forEach(([key, section]) => {
            section.loaded = true;
            section.data = [];
            const elements = section.elements || {};
            if (elements.loading) elements.loading.style.display = 'none';
            if (elements.table) elements.table.style.display = 'none';
            if (elements.empty) {
                elements.empty.innerHTML = `
                    <div class="historico-empty" style="display:flex;">
                        <i data-lucide="shield-off"></i>
                        <h4>Acesso restrito</h4>
                        <p>Esta visão está disponível apenas para equipes de RH ou T&D autorizadas.</p>
                    </div>
                `;
                elements.empty.style.display = 'flex';
            }
        });
        this.refreshIcons();
    }

    renderRestrictedView() {
        const container = document.getElementById('historico-content');
        if (!container) return;
        container.innerHTML = `
            <div class="card" style="padding: 48px; text-align: center;">
                <div class="historico-empty" style="display:flex;">
                    <i data-lucide="shield-off"></i>
                    <h4>Acesso restrito</h4>
                    <p>Esta aba está disponível apenas para equipes de RH ou T&D autorizadas.</p>
                </div>
            </div>
        `;
    }
}

window.loadHistoricoData = function() {
    if (window.historicoManager) window.historicoManager.aplicarFiltros();
};

window.exportHistoricoData = function(tipoSecao) {
    if (window.historicoManager) window.historicoManager.exportHistoricoData(tipoSecao);
};

window.irParaPagina = function(tipoSecao, pagina) {
    if (window.historicoManager) window.historicoManager.irParaPagina(tipoSecao, pagina);
};

document.addEventListener('DOMContentLoaded', function() {
    window.historicoManager = new HistoricoManager();
});