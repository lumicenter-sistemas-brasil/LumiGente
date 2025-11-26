// App Core - Inicialização e gerenciamento da aplicação
const App = {
    async init() {
        // Verificar se sessão foi invalidada
        if (sessionStorage.getItem('sessionInvalidated') === 'true') {
            sessionStorage.clear();
            localStorage.clear();
            window.location.replace('/pages/login.html');
            return;
        }

        // Verificar autenticação antes de carregar qualquer coisa
        try {
            const authCheck = await fetch('/api/usuario', { credentials: 'include' });
            if (!authCheck.ok) {
                sessionStorage.setItem('sessionInvalidated', 'true');
                localStorage.clear();
                window.location.replace('/pages/login.html');
                return;
            }
        } catch (error) {
            sessionStorage.setItem('sessionInvalidated', 'true');
            localStorage.clear();
            window.location.replace('/pages/login.html');
            return;
        }

        this.setupNavigationProtection();
        const authenticated = await Auth.checkAuth();
        if (authenticated) {
            await this.loadInitialData();
            this.setupEventListeners();
            this.setupNavigation();
        }
    },

    setupNavigationProtection() {
        // Prevenir navegação de volta após logout
        window.addEventListener('pageshow', (event) => {
            if (event.persisted || sessionStorage.getItem('sessionInvalidated') === 'true') {
                sessionStorage.clear();
                localStorage.clear();
                window.location.replace('/pages/login.html');
            }
        });

        // Bloquear cache da página
        window.addEventListener('beforeunload', () => {
            if (sessionStorage.getItem('sessionInvalidated') === 'true') {
                return;
            }
        });
    },

    async loadInitialData() {
        await Dashboard.loadMetrics();

        requestIdleCallback(() => {
            Users.load();
            Feedbacks.loadList();
            Recognitions.load();
            Dashboard.loadGamification();
            Dashboard.loadColleaguesHumor();
        }, { timeout: 2000 });

        NotificationsManager.init();
        EmailPopup.init();
    },

    setupEventListeners() {
        // Sidebar toggle - aplicar preferência salva apenas em desktop
        if (window.innerWidth > 768) {
            const sidebarHidden = localStorage.getItem('sidebarHidden') === 'true';
            if (sidebarHidden) {
                document.getElementById('sidebar')?.classList.add('hidden');
                document.querySelector('.main-content')?.classList.add('expanded');
            }
        }

        // User info click handler for mobile
        const userInfoBtn = document.getElementById('user-info-btn');
        if (userInfoBtn) {
            userInfoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleUserInfoDropdown();
            });
        }

        // Badge selection
        document.querySelectorAll('.badge-option').forEach(badge => {
            badge.addEventListener('click', () => {
                document.querySelectorAll('.badge-option').forEach(b => b.classList.remove('selected'));
                badge.classList.add('selected');
                State.selectedBadge = badge.dataset.badge;

                if (badge.dataset.badge === 'outro') {
                    showCustomBadgeInput();
                } else {
                    hideCustomBadgeInput();
                }
            });
        });

        // Humor selection
        document.querySelectorAll('.humor-option').forEach(option => {
            option.addEventListener('click', () => {
                const score = parseInt(option.dataset.score);
                Humor.select(score);
            });
        });

        // ESC to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') Modal.closeAll();
        });

        setupQuickActions();
    },

    setupNavigation() {
        const tabTitles = {
            'dashboard': 'Dashboard',
            'feedback': 'Feedbacks',
            'recognition': 'Reconhecimentos',
            'team': 'Gestão de Equipe',
            'analytics': 'Relatórios',
            'humor': 'Humor do Dia',
            'objetivos': 'Objetivos',
            'pesquisas': 'Pesquisas',
            'avaliacoes': 'Avaliações',
            'historico': 'Histórico',
            'external-users': 'Usuários Externos',
            'configuracoes': 'Configurações'
        };

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;
                this.switchTab(tab, tabTitles);
            });
        });

        // Verificar hash na URL ao carregar
        const hash = window.location.hash.substring(1);
        if (hash && tabTitles[hash]) {
            this.switchTab(hash, tabTitles);
        }
    },

    switchTab(tab, tabTitles) {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(tab + '-content')?.classList.remove('hidden');

        document.getElementById('page-title').textContent = tabTitles[tab];

        this.handleTabSwitch(tab);
    },

    handleTabSwitch(tab) {
        switch (tab) {
            case 'dashboard':
                Dashboard.load();
                break;
            case 'feedback':
                Feedbacks.load();
                break;
            case 'recognition':
                Recognitions.loadAll();
                break;
            case 'team':
                Team.load();
                break;
            case 'analytics':
                Analytics.load();
                break;
            case 'humor':
                Humor.load();
                break;
            case 'objetivos':
                Objetivos.load();
                break;
            case 'pesquisas':
                Pesquisas.load();
                break;
            case 'avaliacoes':
                Avaliacoes.load();
                break;
            case 'historico':
                Historico.load();
                break;
            case 'configuracoes':
                Configuracoes.load();
                break;
            case 'external-users':
                ExternalUsers.load();
                break;
        }
    }
};

// Sidebar toggle function
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.toggle('hidden');
    mainContent.classList.toggle('expanded');

    // Gerenciar overlay em mobile
    if (window.innerWidth <= 768) {
        overlay.classList.toggle('show');
        // Prevenir scroll do body quando sidebar está aberta
        if (!sidebar.classList.contains('hidden')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    // Salvar preferência apenas em desktop
    if (window.innerWidth > 768) {
        localStorage.setItem('sidebarHidden', sidebar.classList.contains('hidden'));
    }
}

// Fechar sidebar ao pressionar ESC em mobile
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('hidden')) {
            toggleSidebar();
        }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.quick-actions-menu .quick-actions-item')) {
        e.preventDefault();
        e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (e.key === 'Escape') {
        closeQuickActionsDropdown();
    }
});

// Fechar sidebar ao redimensionar para desktop
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const userInfoDropdown = document.getElementById('user-info-dropdown');

    if (window.innerWidth > 768) {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
        userInfoDropdown?.classList.remove('show');
    }
});

// Quick Actions Dropdown
let quickActionsCache = null;

function getQuickActionsElements() {
    if (!quickActionsCache) {
        quickActionsCache = {
            toggle: document.getElementById('quick-actions-toggle'),
            menu: document.getElementById('quick-actions-menu'),
            label: document.querySelector('.quick-actions-label'),
            card: document.querySelector('.quick-actions-card')
        };
    }
    return quickActionsCache;
}

function setupQuickActions() {
    const { toggle, menu } = getQuickActionsElements();
    if (!toggle || !menu) return;

    if (!toggle.dataset.listenerAttached) {
        toggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleQuickActionsDropdown();
        });
        toggle.dataset.listenerAttached = 'true';
    }

    if (!menu.dataset.listenerAttached) {
        // Removed stopPropagation to allow delegation
        menu.dataset.listenerAttached = 'true';
    }
}

function toggleQuickActionsDropdown() {
    const { toggle, menu, card } = getQuickActionsElements();
    if (!toggle || !menu || !card) return;

    const isOpen = card.classList.contains('quick-actions-open');
    closeQuickActionsDropdown();

    if (!isOpen) {
        card.classList.add('quick-actions-open');
        toggle.setAttribute('aria-expanded', 'true');
    }
}
window.toggleQuickActionsDropdown = toggleQuickActionsDropdown;

function closeQuickActionsDropdown() {
    const { toggle, menu, card } = getQuickActionsElements();
    if (!toggle || !menu || !card) return;

    card.classList.remove('quick-actions-open');
    menu.classList.remove('show');
    toggle.setAttribute('aria-expanded', 'false');
}
window.closeQuickActionsDropdown = closeQuickActionsDropdown;

function setQuickActionValue(label) {
    const { label: labelElement } = getQuickActionsElements();
    if (labelElement) {
        labelElement.textContent = label || 'Selecione uma ação';
    }
}
window.setQuickActionValue = setQuickActionValue;

function toggleUserInfoDropdown() {
    if (window.innerWidth <= 768) {
        const dropdown = document.getElementById('user-info-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }
}

// Close dropdown and sidebar when clicking outside
document.addEventListener('click', (e) => {
    const { toggle, menu, card } = getQuickActionsElements();
    if (card && card.classList.contains('quick-actions-open')) {
        if (!card.contains(e.target)) {
            closeQuickActionsDropdown();
        }
    }

    // Close user-info dropdown when clicking outside
    const userInfoBtn = document.getElementById('user-info-btn');
    const userInfoDropdown = document.getElementById('user-info-dropdown');
    if (userInfoBtn && userInfoDropdown && !userInfoBtn.contains(e.target) && !userInfoDropdown.contains(e.target)) {
        userInfoDropdown.classList.remove('show');
    }

    // Close select-dropdown when clicking outside
    document.querySelectorAll('.select-dropdown.show').forEach(selectDropdown => {
        const searchableSelect = selectDropdown.closest('.searchable-select');
        if (searchableSelect && !searchableSelect.contains(e.target)) {
            selectDropdown.classList.remove('show');
        }
    });
});

// Close select-dropdown when input loses focus
document.addEventListener('focusout', (e) => {
    if (e.target.matches('.searchable-select input')) {
        setTimeout(() => {
            const searchableSelect = e.target.closest('.searchable-select');
            if (searchableSelect) {
                const dropdown = searchableSelect.querySelector('.select-dropdown');
                if (dropdown && !searchableSelect.contains(document.activeElement)) {
                    dropdown.classList.remove('show');
                }
            }
        }, 200);
    }
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

function toggleFilters(id) {
    const container = document.getElementById(id);
    if (!container) return;

    const btn = event.target.closest('.filters-toggle-btn');
    if (!btn) return;

    const icon = btn.querySelector('svg:last-child');
    const text = btn.querySelector('span');
    const card = btn.closest('.card');

    container.classList.toggle('collapsed');
    btn.classList.toggle('active');

    const isCollapsed = container.classList.contains('collapsed');

    if (card) {
        card.classList.toggle('filters-collapsed', isCollapsed);
    }

    if (isCollapsed) {
        if (text) text.textContent = 'Mostrar Filtros';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        if (text) text.textContent = 'Ocultar Filtros';
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
}