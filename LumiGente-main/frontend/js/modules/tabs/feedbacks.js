// Feedbacks Tab Module
const Feedbacks = {
    async load() {
        State.currentFeedbackTab = 'received';
        document.querySelectorAll('.feedback-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector('[data-feedback-tab="received"]')?.classList.add('active');
        await this.loadList();
        await this.loadFilters();
    },

    async loadList() {
        try {
            const dateStart = document.getElementById('feedback-date-start')?.value || '';
            const dateEnd = document.getElementById('feedback-date-end')?.value || '';
            const type = document.getElementById('feedback-type-filter')?.value || '';
            const category = document.getElementById('feedback-category-filter')?.value || '';

            const params = {
                ...(dateStart && { dateStart }),
                ...(dateEnd && { dateEnd }),
                ...(type && { type }),
                ...(category && { category })
            };

            const endpoint = State.currentFeedbackTab === 'sent' ? '/api/feedbacks/sent' : '/api/feedbacks/received';
            const feedbacks = await API.get(endpoint, params);
            this.updateList(feedbacks);
        } catch (error) {
            console.error('Erro ao carregar feedbacks:', error);
        }
    },

    updateList(feedbacks) {
        const container = document.getElementById('feedback-list');
        if (!container) return;

        if (feedbacks.length === 0) {
            const message = State.currentFeedbackTab === 'sent' ?
                'Você ainda não enviou nenhum feedback.' :
                'Você ainda não recebeu nenhum feedback.';
            container.innerHTML = `<div class="loading">${message}</div>`;
            return;
        }

        container.innerHTML = feedbacks.map(feedback => {
            const displayName = State.currentFeedbackTab === 'sent' ?
                `Você → ${feedback.to_name}` :
                `${feedback.from_name} → Você`;

            const usefulButton = feedback.viewed ?
                `<button class="action-btn status-uteis ${feedback.user_reacted ? 'active' : ''}" onclick="Feedbacks.toggleReaction(${feedback.Id}, 'useful')" data-feedback-id="${feedback.Id}" data-reaction="useful" title="Marcar como útil">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> Útil <span class="counter">${feedback.useful_count || 0}</span>
                </button>` :
                `<button class="action-btn status-uteis disabled" data-feedback-id="${feedback.Id}" data-reaction="useful" title="Visualize o feedback primeiro para marcar como útil" style="cursor: not-allowed; opacity: 0.5;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> Útil <span class="counter">${feedback.useful_count || 0}</span>
                </button>`;

            const actionButtons = State.currentFeedbackTab === 'sent' ?
                `<button class="action-btn ${feedback.has_reactions ? 'status-visualizado' : 'status-nao-visualizado'}" title="Status de visualização">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${feedback.has_reactions ? 'Visualizado' : 'Não visualizado'}
                </button>
                <button class="action-btn status-uteis" title="Reações úteis">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> <span class="counter">${feedback.useful_count || 0}</span> úteis
                </button>
                <button class="action-btn status-respostas ${feedback.replies_count > 0 ? 'has-activity' : ''}" onclick="Feedbacks.toggleReplies(${feedback.Id})" title="Respostas">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> <span class="counter">${feedback.replies_count || 0}</span> respostas
                </button>` :
                `${usefulButton}
                <button class="action-btn status-respostas ${feedback.replies_count > 0 ? 'has-activity' : ''}" onclick="Feedbacks.toggleReplies(${feedback.Id})" title="Visualizar feedback">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Visualizar <span class="counter">${feedback.replies_count || 0}</span>
                </button>`;

            return `
                <div class="feedback-item" data-feedback-id="${feedback.Id}">
                    <div class="feedback-header-info">
                        <div class="feedback-user">
                            <div class="user-avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                            <div>
                                <strong>${displayName}</strong>
                                <p style="color: #6b7280; font-size: 14px;">${new Date(feedback.created_at).toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>
                        <div class="feedback-badges">
                            <span class="badge ${feedback.type === 'Positivo' ? 'badge-positive' : 'badge-development'}">${feedback.type}</span>
                            <span class="badge badge-category">${feedback.category}</span>
                            ${State.currentFeedbackTab === 'sent' && feedback.has_reactions ? '<span class="badge badge-positive">Interagido</span>' : ''}
                        </div>
                    </div>
                    ${State.currentFeedbackTab === 'sent' && feedback.earned_points ? `
                    <div class="feedback-points">
                        <span class="points-info earned">+10 pontos</span>
                    </div>
                    ` : ''}
                    <div class="feedback-actions">${actionButtons}</div>
                </div>
            `;
        }).join('');
    },

    switchTab(tab) {
        State.currentFeedbackTab = tab;
        document.querySelectorAll('.feedback-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-feedback-tab="${tab}"]`).classList.add('active');
        this.loadList();
    },

    async loadFilters() {
        try {
            const filters = await API.get('/api/filters');

            const typeContainer = document.getElementById('type-filters');
            if (typeContainer && filters.types) {
                typeContainer.innerHTML = filters.types.map(type => `
                    <div class="filter-option" onclick="Feedbacks.toggleFilter('type', '${type}')" data-filter="type" data-value="${type}">
                        ${type}
                    </div>
                `).join('');
            }

            const categoryContainer = document.getElementById('category-filters');
            if (categoryContainer && filters.categories) {
                categoryContainer.innerHTML = filters.categories.map(category => `
                    <div class="filter-option" onclick="Feedbacks.toggleFilter('category', '${category}')" data-filter="category" data-value="${category}">
                        ${category}
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar filtros:', error);
        }
    },

    toggleFilter(type, value) {
        if (State.activeFilters[type] === value) {
            State.activeFilters[type] = null;
        } else {
            State.activeFilters[type] = value;
        }

        document.querySelectorAll(`[data-filter="${type}"]`).forEach(el => {
            el.classList.toggle('active', el.dataset.value === State.activeFilters[type]);
        });

        this.loadList();
    },

    openModal() {
        Modal.open('feedback-modal');
    },

    closeModal() {
        Modal.close('feedback-modal');
    },

    async submit() {
        const toUserId = document.getElementById('feedback-to-user').value;
        const type = document.getElementById('feedback-type').value;
        const category = document.getElementById('feedback-category').value;
        const message = document.getElementById('feedback-message').value;
        const submitBtn = document.querySelector('[data-action="submitFeedback"]');

        if (!toUserId || !type || !category || !message) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Todos os campos são obrigatórios', 'error');
            } else {
                alert('Todos os campos são obrigatórios');
            }
            return;
        }

        // Save original state
        const originalContent = submitBtn ? submitBtn.innerHTML : 'Enviar';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner"></div> Enviando...';
        }

        try {
            const result = await API.post('/api/feedbacks', {
                to_user_id: parseInt(toUserId),
                type,
                category,
                message
            });

            this.closeModal();
            await this.loadList();
            await Dashboard.loadMetrics();
            await Dashboard.loadGamification();

            if (result.pointsEarned > 0) {
                if (window.Notifications && typeof Notifications.points === 'function') {
                    Notifications.points(result.pointsEarned, 'enviar feedback');
                }
            } else if (result.pointsMessage) {
                if (window.Notifications && typeof Notifications.info === 'function') {
                    Notifications.info(result.pointsMessage);
                }
            }

            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Feedback enviado com sucesso!', 'success');
            }

        } catch (error) {
            console.error('Erro ao enviar feedback:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Erro ao enviar feedback', 'error');
            } else {
                alert('Erro ao enviar feedback');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        }
    },

    async toggleReaction(feedbackId, reactionType) {
        try {
            const result = await API.post(`/api/feedbacks/${feedbackId}/react`, { reaction: reactionType });
            const button = document.querySelector(`[data-feedback-id="${feedbackId}"][data-reaction="${reactionType}"]`);
            if (result.action === 'added') {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
            await this.loadList();
        } catch (error) {
            console.error('Erro ao reagir:', error);
        }
    },

    toggleReplies(feedbackId) {
        if (window.feedbackChat) {
            window.feedbackChat.openChat(feedbackId);
        }
    }
};

// Funções globais para compatibilidade com HTML
window.switchFeedbackTab = (tab) => Feedbacks.switchTab(tab);
window.openFeedbackModal = () => Feedbacks.openModal();
window.closeFeedbackModal = () => Feedbacks.closeModal();
window.submitFeedback = () => Feedbacks.submit();
window.toggleReplies = (feedbackId) => Feedbacks.toggleReplies(feedbackId);
window.clearFeedbackFilters = () => {
    document.getElementById('feedback-date-start').value = '';
    document.getElementById('feedback-date-end').value = '';
    document.getElementById('feedback-type-filter').value = '';
    document.getElementById('feedback-category-filter').value = '';
    Feedbacks.loadList();
};
