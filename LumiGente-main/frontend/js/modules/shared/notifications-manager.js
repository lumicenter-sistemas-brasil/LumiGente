// Notifications Manager Module
const NotificationsManager = {
    unreadCount: 0,
    notifications: [],
    pollInterval: null,

    async init() {
        await this.loadCount();
        this.startPolling();
        this.setupEventListeners();
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notifications-dropdown');
            const btn = document.getElementById('notifications-btn');
            if (dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    },

    async loadCount() {
        try {
            const data = await API.get('/api/notifications/count');
            this.unreadCount = data.count;
            this.updateBadge();
        } catch (error) {
            console.error('Erro ao carregar contagem de notificações:', error);
        }
    },

    async loadNotifications() {
        try {
            const data = await API.get('/api/notifications');
            this.notifications = data;
            this.renderNotifications();
        } catch (error) {
            console.error('Erro ao carregar notificações:', error);
        }
    },

    updateBadge() {
        const badge = document.getElementById('notifications-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    async toggleDropdown() {
        const dropdown = document.getElementById('notifications-dropdown');
        if (dropdown.classList.contains('hidden')) {
            await this.loadNotifications();
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    },

    renderNotifications() {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = '<div class="notification-empty">Nenhuma notificação</div>';
            return;
        }

        container.innerHTML = this.notifications.map(notif => `
            <div class="notification-item" data-id="${notif.Id}" data-type="${notif.Type}" data-related-id="${notif.RelatedId || ''}" onclick="NotificationsManager.handleNotificationClick(${notif.Id}, '${notif.Type}', ${notif.RelatedId || 'null'})" style="cursor: pointer;">
                <div class="notification-icon ${this.getIconClass(notif.Type)}">
                    ${this.getIconSVG(notif.Type)}
                </div>
                <div class="notification-content">
                    <p class="notification-message">${notif.Message}</p>
                    <span class="notification-time">${this.formatTime(notif.CreatedAt)}</span>
                </div>
                <button class="notification-mark-read" onclick="event.stopPropagation(); NotificationsManager.markAsRead(${notif.Id})" title="Marcar como lida">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
            </div>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    getIconSVG(type) {
        const icons = {
            feedback_received: '<i data-lucide="message-square" style="width: 16px; height: 16px;"></i>',
            feedback_reply: '<i data-lucide="corner-up-left" style="width: 16px; height: 16px;"></i>',
            feedback_useful: '<i data-lucide="thumbs-up" style="width: 16px; height: 16px;"></i>',
            recognition_received: '<i data-lucide="award" style="width: 16px; height: 16px;"></i>',
            mood_update: '<i data-lucide="smile" style="width: 16px; height: 16px;"></i>'
        };
        return icons[type] || '<i data-lucide="bell" style="width: 16px; height: 16px;"></i>';
    },

    getIconClass(type) {
        const classes = {
            feedback_received: 'icon-blue',
            feedback_reply: 'icon-green',
            feedback_useful: 'icon-purple',
            recognition_received: 'icon-amber',
            mood_update: 'icon-pink'
        };
        return classes[type] || 'icon-gray';
    },

    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'Agora';
        if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`;
        return date.toLocaleDateString('pt-BR');
    },

    async markAsRead(id) {
        try {
            const item = document.querySelector(`.notification-item[data-id="${id}"]`);
            if (item) {
                item.classList.add('notification-fade-out');
                setTimeout(async () => {
                    await API.put(`/api/notifications/${id}/read`);
                    this.notifications = this.notifications.filter(n => n.Id !== id);
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateBadge();
                    this.renderNotifications();
                }, 300);
            }
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
        }
    },

    async markAllAsRead() {
        if (this.notifications.length === 0) return;
        
        try {
            const items = document.querySelectorAll('.notification-item');
            items.forEach(item => item.classList.add('notification-fade-out'));
            
            setTimeout(async () => {
                await API.put('/api/notifications/read-all');
                this.notifications = [];
                this.unreadCount = 0;
                this.updateBadge();
                this.renderNotifications();
            }, 300);
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
        }
    },

    startPolling() {
        this.pollInterval = setInterval(() => {
            this.loadCount();
        }, 30000); // Atualiza a cada 30 segundos
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    },

    async handleNotificationClick(id, type, relatedId) {
        await this.markAsRead(id);
        document.getElementById('notifications-dropdown')?.classList.add('hidden');
        
        const typeToTab = {
            'feedback_received': 'feedback',
            'feedback_reply': 'feedback',
            'feedback_useful': 'feedback',
            'recognition_received': 'recognition',
            'objetivo_assigned': 'objetivos',
            'objetivo_checkin': 'objetivos',
            'objetivo_completed': 'objetivos',
            'mood_update': 'humor'
        };
        
        const tab = typeToTab[type];
        if (tab) {
            this.navigateToTab(tab, relatedId, type);
        }
    },

    navigateToTab(tab, relatedId, type) {
        const tabTitles = {
            'dashboard': 'Dashboard',
            'feedback': 'Feedbacks',
            'recognition': 'Reconhecimentos',
            'team': 'Gestão de Equipe',
            'analytics': 'Relatórios e Análises',
            'humor': 'Humor do Dia',
            'objetivos': 'Objetivos',
            'pesquisas': 'Pesquisas',
            'avaliacoes': 'Avaliações',
            'historico': 'Histórico',
            'configuracoes': 'Configurações'
        };

        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(tab + '-content')?.classList.remove('hidden');

        document.getElementById('page-title').textContent = tabTitles[tab];

        this.loadTabWithContext(tab, relatedId, type);
    },

    async loadTabWithContext(tab, relatedId, type) {
        switch(tab) {
            case 'feedback':
                await Feedbacks.load();
                // Para respostas e marcações de útil, abrir aba "enviados"
                const shouldGoToSent = type === 'feedback_reply' || type === 'feedback_useful';
                if (shouldGoToSent && typeof Feedbacks.switchTab === 'function') {
                    Feedbacks.switchTab('sent');
                }
                if (relatedId) {
                    setTimeout(() => {
                        const feedbackCard = document.querySelector(`[data-feedback-id="${relatedId}"]`);
                        if (feedbackCard) {
                            feedbackCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            feedbackCard.style.animation = 'highlight 2s ease';
                        }
                    }, shouldGoToSent ? 600 : 300);
                }
                break;
            case 'recognition':
                await Recognitions.loadAll();
                if (relatedId) {
                    setTimeout(() => {
                        const recognitionCard = document.querySelector(`[data-recognition-id="${relatedId}"]`);
                        if (recognitionCard) {
                            recognitionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            recognitionCard.style.animation = 'highlight 2s ease';
                        }
                    }, 300);
                }
                break;
            case 'objetivos':
                await Objetivos.load();
                if (relatedId) {
                    setTimeout(() => {
                        const objetivoCard = document.querySelector(`[data-objetivo-id="${relatedId}"]`);
                        if (objetivoCard) {
                            objetivoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            objetivoCard.style.animation = 'highlight 2s ease';
                        }
                    }, 300);
                }
                break;
            case 'humor':
                Humor.load();
                break;
            default:
                if (typeof App !== 'undefined' && App.handleTabSwitch) {
                    App.handleTabSwitch(tab);
                }
        }
    }
};
