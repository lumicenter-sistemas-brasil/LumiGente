// Analytics Tab Module
const Analytics = {
    initialized: false,
    periodSelect: null,
    departmentInput: null,
    departmentHidden: null,
    departmentSuggestions: null,
    departments: [],
    canFilterAllDepartments: false,
    departmentsLoaded: false,
    boundDepartmentOutsideClick: null,
    trendChart: null,

    async load() {
        if (!this.initialized) {
            this.periodSelect = document.getElementById('analytics-period');
            this.departmentInput = document.getElementById('analytics-department-search');
            this.departmentHidden = document.getElementById('analytics-selected-department');
            this.departmentSuggestions = document.getElementById('analytics-department-suggestions');

            if (this.periodSelect) {
                this.periodSelect.addEventListener('change', () => this.loadData());
            }

            this.setupDepartmentSearch();

            const refreshButton = document.querySelector('[data-action="loadAnalytics"]');
            if (refreshButton) {
                refreshButton.addEventListener('click', () => this.loadData());
            }
            this.initialized = true;
        }

        this.showLoadingStates();
        this.departmentsLoaded = false;
        this.departments = [];
        this.canFilterAllDepartments = false;
        await this.populateDepartments();
        await this.loadData();
    },

    async populateDepartments() {
        if (this.departmentsLoaded) return;

        try {
            const response = await API.get('/api/analytics/available-departments');
            const departments = Array.isArray(response?.departments) ? response.departments : [];
            this.canFilterAllDepartments = Boolean(response?.canViewAll);
            this.departments = departments
                .map(dept => {
                    const value = (dept.value || dept.label || '').trim();
                    const label = (dept.label || dept.value || '').trim();
                    if (!value || !label) return null;
                    return {
                        value,
                        label,
                        count: dept.userCount || 0
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
            this.updateDepartmentFieldState();
            this.departmentsLoaded = true;
            this.renderDepartmentSuggestions('');
        } catch (error) {
            console.warn('Não foi possível carregar a lista de departamentos para analytics:', error);
            this.departments = [];
            this.canFilterAllDepartments = false;
            this.updateDepartmentFieldState();
        }
    },

    async loadData() {
        this.closeDepartmentSuggestions();
        this.showLoadingStates();

        const period = this.periodSelect?.value || '30';
        const departmentValue = this.getDepartmentFilter();

        try {
            const params = { period };
            if (departmentValue) params.department = departmentValue;

            const dashboard = await API.get('/api/analytics/dashboard', params);
            let trendData = null;
            try {
                const trendParams = { period: 90 };
                if (departmentValue) trendParams.department = departmentValue;
                trendData = await API.get('/api/analytics/trends', trendParams);
            } catch (trendError) {
                console.warn('Não foi possível carregar a série temporal completa:', trendError);
            }
            this.renderAnalytics(dashboard, {
                period: Number(period),
                department: departmentValue,
                trendData: trendData || dashboard.trends || {}
            });
        } catch (error) {
            console.error('Erro ao carregar analytics:', error);
            if (error.status === 403) {
                this.renderAccessDenied();
            } else {
                this.renderError('Não foi possível carregar os dados analíticos.');
            }
        }
    },

    showLoadingStates() {
        const placeholders = {
            'engagement-metrics': 'Carregando engajamento...',
            'mood-metrics': 'Carregando humor...',
            'objectives-metrics': 'Carregando objetivos...',
            'top-users-ranking': 'Carregando ranking...',
            'temporal-analysis': 'Carregando série histórica...'
        };

        Object.entries(placeholders).forEach(([id, message]) => {
            const container = document.getElementById(id);
            if (!container) return;
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    ${this.escapeHtml(message)}
                </div>
            `;
        });
        this.refreshIcons();
    },

    renderAnalytics(data = {}, metadata = {}) {
        this.updateEngagementMetrics(data.performance || {});
        this.updateMoodMetrics(data.satisfaction || {}, data.trends || {});
        this.updateObjectivesMetrics(data.performance || {});
        this.updateTopUsersRanking(data.rankings || {}, metadata);
        const trendSource = metadata.trendData || data.trends || {};
        this.updateTemporalAnalysis(trendSource, metadata);
        this.refreshIcons();
    },

    updateEngagementMetrics(performance) {
        const container = document.getElementById('engagement-metrics');
        if (!container) return;

        const totalUsers = performance.total_usuarios || 0;
        const activeFeedbackUsers = performance.usuarios_ativos_feedback || 0;
        const activeMoodUsers = performance.usuarios_ativos_humor || 0;
        const activeRecognitionUsers = performance.usuarios_ativos_reconhecimento || 0;
        const totalFeedbacks = performance.total_feedbacks || 0;
        const totalRecognitions = performance.total_reconhecimentos || 0;
        const totalMoodEntries = performance.total_registros_humor || 0;
        const participationRate = totalUsers > 0 ? Math.round((activeMoodUsers / totalUsers) * 100) : 0;

        container.innerHTML = `
            <div class="metrics-dashboard">
                ${this.renderMetricCard('users', '#2563eb', 'Usuários Ativos', this.formatNumber(totalUsers), `${this.formatNumber(activeFeedbackUsers + activeMoodUsers + activeRecognitionUsers)} colaboradores engajados`)}
                ${this.renderMetricCard('activity', '#10b981', 'Participação em Humor', `${participationRate}%`, `${this.formatNumber(activeMoodUsers)} usuários registraram humor no período`)}
                ${this.renderMetricCard('message-circle', '#3b82f6', 'Feedbacks (30 dias)', this.formatNumber(totalFeedbacks), `${this.formatNumber(activeFeedbackUsers)} usuários enviaram feedbacks`)}
                ${this.renderMetricCard('sparkles', '#8b5cf6', 'Reconhecimentos (30 dias)', this.formatNumber(totalRecognitions), `${this.formatNumber(activeRecognitionUsers)} usuários reconheceram colegas`)}
                ${this.renderMetricCard('clipboard-list', '#f59e0b', 'Registros de Humor', this.formatNumber(totalMoodEntries), 'Total de entradas no período')}
            </div>
        `;
    },

    updateMoodMetrics(satisfaction, trends) {
        const container = document.getElementById('mood-metrics');
        if (!container) return;

        const averageScore = satisfaction.media_humor ? Number(satisfaction.media_humor).toFixed(1) : 'N/A';
        const promoters = satisfaction.promotores_perc != null ? `${Math.round(satisfaction.promotores_perc)}%` : '0%';
        const detractors = satisfaction.detratores_perc != null ? `${Math.round(satisfaction.detratores_perc)}%` : '0%';
        const neutral = 100 - (parseFloat(promoters) || 0) - (parseFloat(detractors) || 0);
        const recent = (trends.weekly || []).slice(-4);

        container.innerHTML = `
            <div class="metrics-dashboard">
                ${this.renderMetricCard('smile', '#f59e0b', 'Humor Médio', averageScore, 'Média ponderada dos últimos 30 dias')}
                ${this.renderMetricCard('thumbs-up', '#10b981', 'Promotores', promoters, 'Colaboradores com humor positivo')}
                ${this.renderMetricCard('thumbs-down', '#ef4444', 'Detratores', detractors, 'Colaboradores com humor negativo')}
                ${this.renderMetricCard('minus-circle', '#6b7280', 'Neutros', `${Math.max(0, Math.round(neutral))}%`, 'Humor estável ou neutro')}
            </div>
        `;
    },

    renderMoodTrend(entries = []) {
        if (!entries.length) return '<span class="analytics-empty">Sem registros suficientes.</span>';
        const lastEntry = entries[entries.length - 1];
        const firstEntry = entries[0];
        if (!lastEntry || !firstEntry) return '<span class="analytics-empty">Sem registros suficientes.</span>';
        const getAverage = (entry) => Number(entry?.avg_mood ?? entry?.avgMood ?? entry?.avg ?? 0);
        const delta = (getAverage(lastEntry) - getAverage(firstEntry)).toFixed(1);
        const trendIcon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';
        const trendClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
        return `
            <span class="metric-change ${trendClass}">
                <i data-lucide="${trendIcon}"></i>
                ${delta > 0 ? '+' : ''}${delta}
            </span>
        `;
    },

    updateObjectivesMetrics(performance) {
        const container = document.getElementById('objectives-metrics');
        if (!container) return;

        const ativos = performance.objetivos_ativos || 0;
        const concluidos = performance.objetivos_concluidos || 0;
        const emAndamento = performance.objetivos_em_andamento || 0;

        container.innerHTML = `
            <div class="metrics-dashboard">
                ${this.renderMetricCard('target', '#10b981', 'Objetivos Ativos', this.formatNumber(ativos), 'Objetivos atualmente em andamento')}
                ${this.renderMetricCard('check-circle', '#2563eb', 'Objetivos Concluídos', this.formatNumber(concluidos), 'Concluídos nos últimos 30 dias')}
                ${this.renderMetricCard('pause-circle', '#f59e0b', 'Aguardando/Pausados', this.formatNumber(emAndamento), 'Objetivos aguardando ação')}
            </div>
        `;
    },

    updateTopUsersRanking(rankings, metadata = {}) {
        const container = document.getElementById('top-users-ranking');
        if (!container) return;

        const normalize = (value) => (value || '').toString().trim().toLowerCase();
        const departmentFilter = normalize(metadata.department);
        const source = Array.isArray(rankings?.gamification) ? rankings.gamification : [];
        const currentUser = (window.State?.getUser?.() || window.currentUser || {});
        const currentUserId = Number(currentUser.userId || currentUser.Id);

        let leaderboard = source
            .map(entry => ({
                id: Number(entry.userId ?? entry.UserId ?? entry.id ?? 0),
                name: entry.NomeCompleto || entry.nome || entry.UserName || 'Colaborador',
                department: entry.DescricaoDepartamento || entry.descricaoDepartamento || entry.Departamento || entry.departamento || '',
                points: Number(entry.total_pontos ?? entry.totalPoints ?? entry.TotalPoints ?? entry.score ?? 0)
            }));

        if (Number.isInteger(currentUserId) && currentUserId > 0) {
            leaderboard = leaderboard.filter(item => item.id !== currentUserId);
        }

        if (!leaderboard.length) {
            container.innerHTML = '<div class="loading">Nenhum colaborador da sua equipe está ranqueado no período selecionado.</div>';
            return;
        }

        const getMedalSVG = (position) => {
            if (position === 1) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
            if (position === 2) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
            if (position === 3) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CD7F32" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
            return position;
        };

        container.innerHTML = leaderboard.slice(0, 10).map((item, index) => {
            const position = index + 1;
            const positionClass = position === 1 ? 'top-1' : position === 2 ? 'top-2' : position === 3 ? 'top-3' : 'other';

            return `
                <div class="leaderboard-item">
                    <div class="leaderboard-position ${positionClass}">
                        ${getMedalSVG(position)}
                    </div>
                    <div class="leaderboard-user">
                        <div class="leaderboard-user-name">${this.escapeHtml(item.name)}</div>
                    </div>
                    <div class="leaderboard-score">${this.escapeHtml(String(Number.isFinite(item.points) ? item.points : 0))} pts</div>
                </div>
            `;
        }).join('');
    },

    updateTemporalAnalysis(trends, metadata = {}) {
        const container = document.getElementById('temporal-analysis');
        if (!container) return;

        const dataset = this.prepareWeeklyDataset(trends.weekly || [], metadata.period);

        if (this.trendChart) {
            this.trendChart.destroy();
            this.trendChart = null;
        }

        if (!window.Chart) {
            container.innerHTML = '<p class="analytics-empty">Biblioteca de gráficos não carregada.</p>';
            return;
        }

        if (!dataset.labels.length) {
            container.innerHTML = '<p class="analytics-empty">Sem registros suficientes para gerar o gráfico.</p>';
            return;
        }

        container.innerHTML = '<canvas id="analytics-trend-canvas" height="260"></canvas>';
        const canvas = document.getElementById('analytics-trend-canvas');
        if (!canvas) return;

        const context = canvas.getContext('2d');

        this.prepareMoodImages();

        const moodIconsPlugin = {
            id: 'moodIcons',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const yAxis = chart.scales.y;

                yAxis.ticks.forEach((tick, index) => {
                    const value = tick.value;
                    if (Number.isInteger(value) && value >= 1 && value <= 5) {
                        const img = this.moodImages[value];
                        if (img && img.complete && img.naturalWidth > 0) {
                            const y = yAxis.getPixelForTick(index);
                            // Draw icon to the left of the axis labels
                            // Assuming label is "      (N)"
                            const xPos = yAxis.right - 50;
                            const size = 20;
                            ctx.drawImage(img, xPos, y - (size / 2), size, size);
                        }
                    }
                });
            }
        };

        this.trendChart = new Chart(context, {
            type: 'line',
            data: {
                labels: dataset.labels,
                datasets: [{
                    label: 'Humor médio',
                    data: dataset.values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                }]
            },
            plugins: [moodIconsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Humor médio: ${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 1,
                        suggestedMax: 5,
                        ticks: {
                            stepSize: 1,
                            padding: 5,
                            callback: (value) => {
                                const val = Number(value);
                                return `      (${val})`;
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12
                        }
                    }
                }
            }
        });
    },

    prepareWeeklyDataset(entries = [], period) {
        const sanitized = entries
            .map(entry => ({
                year: Number(entry.year ?? entry.Year ?? entry.Ano ?? 0),
                week: Number(entry.week ?? entry.Week ?? entry.Semana ?? 0),
                avg: Number(entry.avg_mood ?? entry.avgMood ?? entry.media ?? 0),
                count: Number(entry.entries ?? entry.total ?? entry.quantidade ?? 0)
            }))
            .filter(item => item.year > 0 && item.week > 0 && item.count > 0);

        if (!sanitized.length) {
            return { labels: [], values: [] };
        }

        sanitized.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.week - b.week;
        });

        const sliceCount = period >= 180 ? 24 : 12;
        const latest = sanitized.slice(-sliceCount);

        const labels = latest.map(item => `Sem ${String(item.week).padStart(2, '0')}/${item.year}`);
        const values = latest.map(item => Number.isFinite(item.avg) ? Number(item.avg.toFixed(2)) : 0);

        return { labels, values };
    },

    renderMetricCard(icon, color, title, value, subtitle) {
        return `
            <div class="metric-card">
                <div class="metric-icon" style="color: ${color}; background: ${this.withAlpha(color, 0.1)};">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="metric-content">
                    <h3>${this.escapeHtml(title)}</h3>
                    <p class="metric-value">${this.escapeHtml(String(value))}</p>
                    ${subtitle ? `<p class="metric-change neutral">${this.escapeHtml(subtitle)}</p>` : ''}
                </div>
            </div>
        `;
    },

    renderRankingItem(user, index) {
        return `
            <div class="ranking-item ${index < 3 ? `top-${index + 1}` : ''}">
                <div class="ranking-position ${index < 3 ? `top-${index + 1}` : 'other'}">${index + 1}</div>
                <div class="ranking-user-info">
                    <div class="ranking-user-name">${this.escapeHtml(user.NomeCompleto || user.nome || 'Colaborador')}</div>
                    <div class="ranking-user-department">${this.escapeHtml(user.DescricaoDepartamento || user.Departamento || 'Sem departamento')}</div>
                </div>
                <div class="ranking-stats">
                    <span class="ranking-points">${this.formatNumber(user.score || user.total_pontos || 0)} pts</span>
                    <span class="ranking-activities">Feedbacks: ${this.formatNumber(user.feedbacks_enviados || 0)} • Reconhecimentos: ${this.formatNumber(user.reconhecimentos_enviados || 0)}</span>
                </div>
            </div>
        `;
    },

    renderAccessDenied() {
        const message = `
            <div class="analytics-empty" style="display:flex; flex-direction: column; align-items: center; gap: 8px;">
                <i data-lucide="shield-off"></i>
                <h4>Acesso restrito</h4>
                <p>Solicite acesso à equipe de RH ou T&D para visualizar relatórios analíticos.</p>
            </div>
        `;
        if (this.trendChart) {
            this.trendChart.destroy();
            this.trendChart = null;
        }
        ['engagement-metrics', 'mood-metrics', 'objectives-metrics', 'top-users-ranking', 'temporal-analysis']
            .forEach(id => {
                const container = document.getElementById(id);
                if (container) container.innerHTML = message;
            });
        this.refreshIcons();
    },

    renderError(message) {
        const html = `
            <div class="analytics-empty" style="display:flex; flex-direction: column; align-items: center; gap: 8px;">
                <i data-lucide="alert-circle"></i>
                <h4>Erro ao carregar</h4>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        if (this.trendChart) {
            this.trendChart.destroy();
            this.trendChart = null;
        }
        ['engagement-metrics', 'mood-metrics', 'objectives-metrics', 'top-users-ranking', 'temporal-analysis']
            .forEach(id => {
                const container = document.getElementById(id);
                if (container) container.innerHTML = html;
            });
        this.refreshIcons();
    },

    setupDepartmentSearch() {
        if (!this.departmentInput || !this.departmentSuggestions) return;

        if (!this.boundDepartmentOutsideClick) {
            this.boundDepartmentOutsideClick = (event) => {
                if (!this.departmentSuggestions || !this.departmentInput) return;
                if (!this.departmentSuggestions.contains(event.target) && event.target !== this.departmentInput) {
                    this.closeDepartmentSuggestions();
                }
            };
        }

        this.departmentInput.addEventListener('input', () => {
            if (this.departmentHidden) this.departmentHidden.value = '';
            const term = this.departmentInput.value || '';
            this.renderDepartmentSuggestions(term);
            this.openDepartmentSuggestions();
        });

        this.departmentInput.addEventListener('focus', () => {
            this.renderDepartmentSuggestions(this.departmentInput.value || '');
            this.openDepartmentSuggestions();
        });

        this.departmentInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.departmentInput.value = '';
                if (this.departmentHidden) this.departmentHidden.value = '';
                this.closeDepartmentSuggestions();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const term = this.departmentInput.value?.trim();
                if (!term) {
                    if (this.departmentHidden) this.departmentHidden.value = '';
                    this.closeDepartmentSuggestions();
                    return;
                }

                const match = this.findDepartmentMatch(term);
                if (match) {
                    this.selectDepartment(match.value, match.label);
                } else if (this.canFilterAllDepartments) {
                    this.selectDepartment(term, term);
                }
                this.closeDepartmentSuggestions();
            }
        });
    },

    renderDepartmentSuggestions(term = '') {
        if (!this.departmentSuggestions) return;

        const normalized = term.trim().toLowerCase();
        let matches = this.departments;
        if (normalized) {
            matches = matches.filter(dept =>
                dept.label.toLowerCase().includes(normalized) ||
                dept.value.toLowerCase().includes(normalized)
            );
        }
        matches = matches.slice(0, 12);

        const items = matches.map(dept => `
            <div class="analytics-department-item" data-value="${this.escapeHtml(dept.value)}" data-label="${this.escapeHtml(dept.label)}">
                <span class="label">${this.escapeHtml(dept.label)}</span>
                <span class="count">${dept.count ?? 0}</span>
            </div>
        `);

        if (this.canFilterAllDepartments && normalized && !matches.some(dept => dept.label.toLowerCase() === normalized)) {
            const cleaned = this.escapeHtml(term.trim());
            items.push(`
                <div class="analytics-department-item" data-value="${cleaned}" data-label="${cleaned}">
                    <span class="label">Filtrar por "${cleaned}"</span>
                </div>
            `);
        }

        if (!items.length) {
            this.departmentSuggestions.innerHTML = `
                <div class="analytics-department-item analytics-department-empty" data-empty="true">
                    Nenhum departamento disponível.
                </div>
            `;
        } else {
            this.departmentSuggestions.innerHTML = items.join('');
            this.departmentSuggestions.querySelectorAll('.analytics-department-item').forEach(item => {
                if (item.dataset.empty === 'true') return;
                item.addEventListener('click', () => {
                    const value = item.dataset.value || '';
                    const label = item.dataset.label || value;
                    this.selectDepartment(value, label);
                    this.closeDepartmentSuggestions();
                });
            });
        }
    },

    openDepartmentSuggestions() {
        if (!this.departmentSuggestions) return;
        this.departmentSuggestions.classList.remove('hidden');
        document.addEventListener('click', this.boundDepartmentOutsideClick);
    },

    closeDepartmentSuggestions() {
        if (!this.departmentSuggestions) return;
        this.departmentSuggestions.classList.add('hidden');
        document.removeEventListener('click', this.boundDepartmentOutsideClick);
    },

    selectDepartment(value, label) {
        if (this.departmentInput) {
            this.departmentInput.value = label || value || '';
        }
        if (this.departmentHidden) {
            this.departmentHidden.value = value || '';
        }
    },

    findDepartmentMatch(term) {
        const normalized = term.trim().toLowerCase();
        return this.departments.find(dept =>
            dept.label.toLowerCase() === normalized ||
            dept.value.toLowerCase() === normalized
        );
    },

    getDepartmentFilter() {
        const selected = (this.departmentHidden?.value || '').trim();
        if (selected) return selected;

        const typed = (this.departmentInput?.value || '').trim();
        if (!typed) return '';

        const match = this.findDepartmentMatch(typed);
        if (match) return match.value;

        return this.canFilterAllDepartments ? typed : '';
    },

    updateDepartmentFieldState() {
        const field = document.querySelector('.analytics-department-field');
        if (this.canFilterAllDepartments) {
            if (field) field.classList.remove('analytics-department-field--restricted');
            if (this.departmentInput) {
                this.departmentInput.disabled = false;
                this.departmentInput.placeholder = 'Digite para filtrar departamento...';
            }
        } else {
            if (field) field.classList.add('analytics-department-field--restricted');
            if (this.departmentInput) {
                this.departmentInput.value = '';
                this.departmentInput.disabled = true;
                this.departmentInput.placeholder = 'Filtro restrito à sua equipe';
            }
            if (this.departmentHidden) {
                this.departmentHidden.value = '';
            }
        }
    },

    formatNumber(value) {
        const number = Number(value || 0);
        return new Intl.NumberFormat('pt-BR').format(number);
    },

    formatDate(value) {
        if (!value) return '—';
        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '—';
            return new Intl.DateTimeFormat('pt-BR').format(date);
        } catch (_) {
            return '—';
        }
    },

    withAlpha(hexColor, alpha = 0.1) {
        if (!hexColor) return `rgba(13, 85, 109, ${alpha})`;
        const hex = hexColor.replace('#', '');
        if (hex.length !== 6) return `rgba(13, 85, 109, ${alpha})`;
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
        }
    },

    moodImages: {},

    prepareMoodImages() {
        if (Object.keys(this.moodImages).length > 0) return;

        [1, 2, 3, 4, 5].forEach(score => {
            const svg = this.getMoodIconSVG(score);
            if (svg) {
                const img = new Image();
                img.src = 'data:image/svg+xml;base64,' + btoa(svg);
                this.moodImages[score] = img;
            }
        });
    },

    getMoodIconSVG(score) {
        const s = parseInt(score, 10) || 0;
        const colors = {
            1: '#ef4444', // Muito Triste
            2: '#f97316', // Triste
            3: '#6b7280', // Neutro
            4: '#10b981', // Feliz
            5: '#22c55e'  // Muito Feliz
        };

        const color = colors[s] || '#9ca3af';

        // Paths extracted from Lucide Icons
        const paths = {
            1: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', // frown
            2: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', // meh
            3: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', // smile
            4: '<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', // laugh
            5: '<path d="M22 11v1a10 10 0 1 1-9-10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M16 5h6"/><path d="M19 2v6"/>' // smile-plus
        };

        const path = paths[s];
        if (!path) return null;

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${path}
            </svg>
        `.trim();
    }
};

function loadAnalytics() {
    Analytics.loadData();
}
