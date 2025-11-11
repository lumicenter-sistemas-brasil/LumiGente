// Team Tab Module - Gestão de Equipe
const Team = {
    state: {
        members: [],
        departments: [],
        departmentCounts: {},
        initialized: false
    },

    containerHeights: {
        'team-metrics': '150px',
        'team-status': '150px',
        'team-members-list': '400px'
    },

    async load() {
        if (!this.state.initialized) {
            this.initializeGlobals();
            this.state.initialized = true;
        }

        this.showLoading('team-metrics', 'Carregando métricas...');
        this.showLoading('team-status', 'Carregando status...');
        this.showLoading('team-members-list', 'Carregando membros da equipe...');

        try {
            const [metricsResult, statusResult, membersResult] = await Promise.allSettled([
                API.get('/api/manager/team-metrics'),
                API.get('/api/manager/team-status'),
                API.get('/api/team/members')
            ]);

            if (metricsResult.status === 'fulfilled') {
                this.updateMetrics(metricsResult.value);
            } else {
                this.handleSectionError('team-metrics', metricsResult.reason);
            }

            if (statusResult.status === 'fulfilled') {
                this.updateStatus(statusResult.value);
            } else {
                this.handleSectionError('team-status', statusResult.reason);
            }

            if (membersResult.status === 'fulfilled') {
                const members = Array.isArray(membersResult.value) ? membersResult.value : [];
                this.state.members = members.map(member => ({
                    ...member,
                    descricaoDepartamento: member.descricaoDepartamento || member.DescricaoDepartamento || null
                }));
                this.state.departments = this.extractDepartments(this.state.members);
                this.populateUserDropdown();
                this.applyFilters();
            } else {
                this.state.members = [];
                this.state.departments = [];
                this.handleSectionError('team-members-list', membersResult.reason);
            }
        } catch (error) {
            console.error('Erro inesperado ao carregar dados da equipe:', error);
            const message = error?.status === 403 ? 'Você não possui permissão para visualizar estes dados.' : 'Não foi possível carregar as informações da equipe.';
            this.showError('team-metrics', message);
            this.showError('team-status', message);
            this.showError('team-members-list', message);
        }
    },

    initializeGlobals() {
        window.filterDepartmentSearch = () => this.handleDepartmentSearch();
        window.filterTeamUsers = (inputId, listId) => this.handleUserSearch(inputId, listId);
        window.selectTeamUser = (_, param) => this.selectTeamUser(param);
        window.clearTeamFilters = () => this.clearFilters();

        this.handleOutsideClick = this.handleOutsideClick.bind(this);
        document.addEventListener('click', this.handleOutsideClick);
    },

    extractDepartments(members) {
        const counts = {};
        members.forEach(member => {
            const dept = (member.descricaoDepartamento || member.departamento || 'Não informado').trim();
            if (!dept) return;
            counts[dept] = (counts[dept] || 0) + 1;
        });
        this.state.departmentCounts = counts;
        return Object.keys(counts).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },

    handleOutsideClick(event) {
        const suggestions = document.getElementById('department-suggestions');
        const departmentInput = document.getElementById('team-department-search');
        if (!suggestions || !departmentInput) return;

        if (!suggestions.contains(event.target) && event.target !== departmentInput) {
            suggestions.classList.add('hidden');
        }
    },

    handleDepartmentSearch() {
        const departmentInput = document.getElementById('team-department-search');
        if (!departmentInput) return;

        const term = departmentInput.value.trim();
        this.updateDepartmentSuggestions(term);
        this.applyFilters();
    },

    handleUserSearch(inputId, listId) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(listId);
        if (!input || !dropdown) return;

        const search = input.value.trim().toLowerCase();
        const allOption = this.buildUserOptionMarkup({
            id: 'all',
            nomeCompleto: 'Todos os usuários'
        });

        const matches = this.state.members
            .filter(member => (member.nomeCompleto || member.nome)?.toLowerCase().includes(search))
            .slice(0, 12)
            .map(member => this.buildUserOptionMarkup(member))
            .join('');

        dropdown.innerHTML = allOption + matches;
        dropdown.classList.add('show');
        this.refreshIcons();
    },

    buildUserOptionMarkup(member) {
        const id = member.id !== undefined ? member.id : member.userId;
        const label = member.nomeCompleto || member.nome || 'Colaborador';
        const value = id === 'all' ? 'all' : String(id);
        return `
            <div class="select-option" data-action="selectTeamUser" data-param="${this.escapeHtml(value)}" data-value="${this.escapeHtml(value)}" data-label="${this.escapeHtml(label)}">
                ${this.escapeHtml(label)}
            </div>
        `;
    },

    selectTeamUser(param) {
        const dropdown = document.getElementById('team-user-list');
        const input = document.getElementById('team-user-search');
        const hidden = document.getElementById('team-selected-user');
        if (!dropdown || !input || !hidden) return;

        if (param === 'all' || !param) {
            hidden.value = '';
            input.value = '';
        } else {
            const member = this.state.members.find(item => String(item.id) === String(param));
            input.value = member ? member.nomeCompleto || member.nome || '' : '';
            hidden.value = String(param);
        }

        dropdown.classList.remove('show');
        this.applyFilters();
    },

    clearFilters() {
        const userInput = document.getElementById('team-user-search');
        const hidden = document.getElementById('team-selected-user');
        const departmentInput = document.getElementById('team-department-search');
        const suggestions = document.getElementById('department-suggestions');

        if (departmentInput) departmentInput.value = '';
        if (userInput) userInput.value = '';
        if (hidden) hidden.value = '';
        if (suggestions) suggestions.classList.add('hidden');

        this.applyFilters();
    },

    applyFilters() {
        const departmentInput = document.getElementById('team-department-search');
        const hidden = document.getElementById('team-selected-user');
        const departmentFilter = departmentInput ? departmentInput.value.trim().toLowerCase() : '';
        const selectedUserId = hidden ? hidden.value : '';

        let filtered = [...this.state.members];

        if (departmentFilter) {
            filtered = filtered.filter(member => (member.descricaoDepartamento || member.departamento || '').toLowerCase().includes(departmentFilter));
        }

        if (selectedUserId) {
            filtered = filtered.filter(member => String(member.id) === selectedUserId);
        }

        this.renderMemberList(filtered);
    },

    populateUserDropdown() {
        const dropdown = document.getElementById('team-user-list');
        if (!dropdown) return;

        const options = [
            this.buildUserOptionMarkup({ id: 'all', nomeCompleto: 'Todos os usuários' })
        ].concat(this.state.members.map(member => this.buildUserOptionMarkup(member)));

        dropdown.innerHTML = options.join('');
        this.refreshIcons();
    },

    updateDepartmentSuggestions(term) {
        const suggestions = document.getElementById('department-suggestions');
        if (!suggestions) return;

        const search = term.trim().toLowerCase();
        if (!search) {
            suggestions.innerHTML = '';
            suggestions.classList.add('hidden');
            return;
        }

        const matches = this.state.departments
            .filter(dept => dept.toLowerCase().includes(search))
            .slice(0, 10);

        if (matches.length === 0) {
            suggestions.innerHTML = '';
            suggestions.classList.add('hidden');
            return;
        }

        suggestions.innerHTML = matches.map(dept => `
            <div class="department-suggestion-item" data-department="${this.escapeHtml(dept)}">
                <span class="icon"><i data-lucide="building-2"></i></span>
                <span class="suggestion-text">${this.escapeHtml(dept)}</span>
                <span class="suggestion-count">${this.state.departmentCounts[dept] || 0}</span>
            </div>
        `).join('');

        suggestions.querySelectorAll('.department-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const departmentInput = document.getElementById('team-department-search');
                if (!departmentInput) return;
                departmentInput.value = item.dataset.department || '';
                suggestions.classList.add('hidden');
                this.applyFilters();
            });
        });

        suggestions.classList.remove('hidden');
        this.refreshIcons();
    },

    updateMetrics(metrics = {}) {
        const container = document.getElementById('team-metrics');
        if (!container) return;

        this.clearMinHeight('team-metrics');

        const data = {
            totalMembers: metrics.totalMembers || 0,
            activeMembers: metrics.activeMembers || 0,
            totalFeedbacks: metrics.totalFeedbacks || 0,
            totalRecognitions: metrics.totalRecognitions || 0,
            avgMood: metrics.avgMood || 0,
            activeObjectives: metrics.activeObjectives || 0
        };

        container.innerHTML = `
            <div class="team-metrics">
                <div class="metric-card">
                    <div class="metric-icon"><i data-lucide="users"></i></div>
                    <div class="metric-value">${data.totalMembers}</div>
                    <div class="metric-label">Total de membros</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i data-lucide="user-check"></i></div>
                    <div class="metric-value">${data.activeMembers}</div>
                    <div class="metric-label">Membros ativos</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i data-lucide="message-circle"></i></div>
                    <div class="metric-value">${data.totalFeedbacks}</div>
                    <div class="metric-label">Feedbacks (30 dias)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i data-lucide="heart"></i></div>
                    <div class="metric-value">${data.totalRecognitions}</div>
                    <div class="metric-label">Reconhecimentos (30 dias)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i data-lucide="target"></i></div>
                    <div class="metric-value">${data.activeObjectives}</div>
                    <div class="metric-label">Objetivos ativos</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i data-lucide="smile"></i></div>
                    <div class="metric-value">${data.avgMood || '-'}${data.avgMood ? '/5' : ''}</div>
                    <div class="metric-label">Humor médio (30 dias)</div>
                </div>
            </div>
        `;
        this.refreshIcons();
    },

    updateStatus(status = {}) {
        const container = document.getElementById('team-status');
        if (!container) return;

        this.clearMinHeight('team-status');

        const data = {
            online: status.online || 0,
            offline: status.offline || 0,
            active: status.active || 0,
            inactive: status.inactive || 0
        };

        container.innerHTML = `
            <div class="status-grid">
                <div class="status-card online">
                    <div class="status-icon"><i data-lucide="activity"></i></div>
                    <div class="status-value">${data.online}</div>
                    <div class="status-label">Online agora</div>
                    <div class="status-subtitle">Últimos 30 minutos</div>
                </div>
                <div class="status-card offline">
                    <div class="status-icon"><i data-lucide="moon"></i></div>
                    <div class="status-value">${data.offline}</div>
                    <div class="status-label">Offline</div>
                    <div class="status-subtitle">Fora nos últimos 30 minutos</div>
                </div>
                <div class="status-card active">
                    <div class="status-icon"><i data-lucide="badge-check"></i></div>
                    <div class="status-value">${data.active}</div>
                    <div class="status-label">Ativos</div>
                    <div class="status-subtitle">Usuários ativos no sistema</div>
                </div>
                <div class="status-card inactive">
                    <div class="status-icon"><i data-lucide="user-x"></i></div>
                    <div class="status-value">${data.inactive}</div>
                    <div class="status-label">Inativos</div>
                    <div class="status-subtitle">Usuários inativos</div>
                </div>
            </div>
        `;
        this.refreshIcons();
    },

    renderMemberList(members) {
        const container = document.getElementById('team-members-list');
        if (!container) return;

        this.clearMinHeight('team-members-list');

        if (!members.length) {
            container.innerHTML = `
                <div class="loading">
                    Nenhum membro encontrado com os filtros atuais.
                </div>
            `;
            return;
        }

        container.innerHTML = members.map(member => `
            <div class="team-member-item">
                <div class="member-info">
                    <h4>${this.escapeHtml(member.nomeCompleto || member.nome || 'Colaborador')}</h4>
                    <p class="info-line"><span class="icon"><i data-lucide="building-2"></i></span><span>${this.escapeHtml(member.descricaoDepartamento || member.departamento || 'Departamento não informado')}</span></p>
                    <p class="info-line"><span class="icon"><i data-lucide="clock-3"></i></span><span>Último acesso: ${this.formatDate(member.ultimoAcesso)}</span></p>
                    <p class="info-line"><span class="icon"><i data-lucide="shield-check"></i></span><span>${member.ativo === false ? 'Inativo' : 'Ativo'}</span></p>
                </div>
                <div class="member-metrics">
                    <div class="metric"><span class="icon"><i data-lucide="smile"></i></span><span>Humor médio: ${member.humorMedio != null ? this.escapeHtml(String(member.humorMedio)) : 'N/A'}</span></div>
                    <div class="metric"><span class="icon"><i data-lucide="message-circle"></i></span><span>Feedbacks (30 dias): ${member.feedbacksRecentes ?? 0}</span></div>
                    <div class="metric"><span class="icon"><i data-lucide="target"></i></span><span>Objetivos ativos: ${member.objetivosAtivos ?? 0}</span></div>
                </div>
            </div>
        `).join('');
        this.refreshIcons();
    },

    showLoading(containerId, message) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.applyMinHeight(containerId);
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                ${this.escapeHtml(message)}
            </div>
        `;
    },

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.clearMinHeight(containerId);
        container.innerHTML = `
            <div class="loading">
                ${this.escapeHtml(message)}
            </div>
        `;
    },

    handleSectionError(containerId, reason) {
        const status = reason?.status;
        const message = status === 403
            ? 'Você não possui permissão para visualizar estes dados.'
            : 'Não foi possível carregar estas informações.';
        this.showError(containerId, message);
    },

    refreshIcons() {
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            lucide.createIcons({
                attrs: {
                    'stroke-width': 2
                }
            });
        }
    },

    formatDate(value) {
        if (!value) return 'Sem registros';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Sem registros';
        const adjusted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(adjusted);
    },

    applyMinHeight(containerId) {
        const minHeight = this.containerHeights[containerId];
        if (!minHeight) return;
        const container = document.getElementById(containerId);
        if (container) {
            container.style.minHeight = minHeight;
        }
    },

    clearMinHeight(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.minHeight = '';
        }
    },

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
