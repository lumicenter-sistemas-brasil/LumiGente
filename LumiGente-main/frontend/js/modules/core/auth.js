// Auth Module - Autenticação e autorização
const Auth = {
    async checkAuth() {
        try {
            const response = await fetch('/api/usuario', { credentials: 'include' });
            if (response.ok) {
                const user = await response.json();
                State.setUser(user);
                window.currentUser = user;
                const userName = user.nomeCompleto || user.userName;
                document.querySelector('.user-info span').textContent = userName;
                document.getElementById('user-info-name').textContent = userName;
                
                const isFromLogin = sessionStorage.getItem('justLoggedIn');
                if (isFromLogin && user.nome) {
                    this.showWelcomeMessage(user.nome);
                    sessionStorage.removeItem('justLoggedIn');
                }
                
                this.setupSidebarAccess();
                return true;
            }
            window.location.replace('/pages/login.html');
            return false;
        } catch (error) {
            console.error('Erro na autenticação:', error);
            window.location.replace('/pages/login.html');
            return false;
        }
    },

    setupSidebarAccess() {
        const user = State.getUser();
        if (!user) return;

        API.get('/api/usuario/permissions').then(data => {
            if (!data || !data.permissions) return;
            
            const permissions = data.permissions;
            window.cachedTabPermissions = permissions;
            const permissionMap = {
                'dashboard': 'dashboard',
                'feedback': 'feedbacks',
                'recognition': 'recognitions',
                'team': 'team',
                'analytics': 'analytics',
                'humor': 'humor',
                'objetivos': 'objetivos',
                'pesquisas': 'pesquisas',
                'avaliacoes': 'avaliacoes',
                'historico': 'historico',
                'external-users': 'externalUsers'
            };
            
            document.querySelectorAll('.nav-item').forEach(item => {
                const tab = item.dataset.tab;
                
                // Configurações é visível para todos
                if (tab === 'configuracoes') {
                    item.style.display = 'flex';
                    item.classList.remove('disabled');
                    return;
                }

                const permissionKey = permissionMap[tab];
                if (permissionKey && permissions[permissionKey]) {
                    item.style.display = 'flex';
                    item.classList.remove('disabled');
                } else {
                    item.style.display = 'none';
                    item.classList.add('disabled');
                }
            });
        }).catch(error => {
            console.error('Erro ao configurar permissões:', error);
        });
    },

    showWelcomeMessage(nome) {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        const welcomeAlert = document.createElement('div');
        welcomeAlert.className = 'welcome-alert show';
        welcomeAlert.innerHTML = `<i class="fas fa-hand-wave"></i>Bem-vindo de volta, ${nome}!`;
        headerRight.appendChild(welcomeAlert);

        setTimeout(() => {
            welcomeAlert.classList.add('hide');
            setTimeout(() => welcomeAlert.remove(), 300);
        }, 2500);
    },

    async logout() {
        // Marcar sessão como invalidada ANTES de fazer logout
        sessionStorage.setItem('sessionInvalidated', 'true');
        localStorage.clear();
        
        try {
            await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {}
        
        // Forçar limpeza de cache e redirecionar
        sessionStorage.clear();
        window.location.replace('/pages/login.html');
    }
};

// Global function for onclick handler
function logout() {
    Auth.logout();
}