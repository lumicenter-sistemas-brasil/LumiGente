// Recognitions Tab Module
const Recognitions = {
    async load() {
        try {
            const [received, sent] = await Promise.all([
                API.get('/api/recognitions'),
                API.get('/api/recognitions/given')
            ]);

            const all = [...received, ...sent]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 3);

            this.updateList(all);
        } catch (error) {
            console.error('Erro ao carregar reconhecimentos:', error);
        }
    },

    async loadAll() {
        try {
            const dateStart = document.getElementById('recognition-date-start')?.value;
            const dateEnd = document.getElementById('recognition-date-end')?.value;
            const badge = document.getElementById('recognition-badge-filter')?.value;

            let url = '/api/recognitions/all';
            const params = new URLSearchParams();

            if (dateStart) params.append('dateStart', dateStart);
            if (dateEnd) params.append('dateEnd', dateEnd);
            if (badge) params.append('badge', badge);

            if (params.toString()) url += '?' + params.toString();

            const recognitions = await API.get(url);
            this.updateAllList(recognitions);
        } catch (error) {
            console.error('Erro ao carregar reconhecimentos:', error);
        }
    },

    updateList(recognitions) {
        const container = document.getElementById('recognitions-list');
        if (!container) return;

        if (recognitions.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum reconhecimento encontrado.</div>';
            return;
        }

        const currentUser = State.getUser();
        container.innerHTML = recognitions.map((recognition, index) => {
            const isReceived = recognition.to_user_id === currentUser.userId;
            const isSent = recognition.from_user_id === currentUser.userId;
            const badgeColor = this.getBadgeColor(recognition.badge);
            const iconSvg = isReceived ?
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>' :
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>';
            const messageId = `recognition-dash-msg-${index}`;
            const btnId = `recognition-dash-btn-${index}`;

            let displayText;
            if (isReceived) {
                displayText = `${recognition.from_name} reconheceu você`;
            } else if (isSent) {
                displayText = `Você reconheceu ${recognition.to_name}`;
            } else {
                displayText = `${recognition.from_name} reconheceu ${recognition.to_name}`;
            }

            const pointsDisplay = recognition.show_points ? (isReceived ? '+10 pontos' : '+5 pontos') : 'Sem pontos';

            return `
                <div class="recognition-item" style="border-color: ${badgeColor};">
                    <div class="recognition-icon" style="background: ${badgeColor};">${iconSvg}</div>
                    <div class="recognition-content">
                        <div class="recognition-header">
                            <strong>${displayText}</strong>
                            <span class="recognition-badge" style="background: ${badgeColor}33; color: ${badgeColor};">${recognition.badge}</span>
                        </div>
                        <p class="recognition-message" id="${messageId}" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-wrap: break-word; overflow-wrap: break-word;">${recognition.message}</p>
                        <button id="${btnId}" onclick="toggleRecognitionMessage('${messageId}', '${btnId}')" style="display: none; background: none; border: none; color: ${badgeColor}; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0; margin-top: 4px;">
                            Ler Mais
                        </button>
                        <p class="recognition-points">${pointsDisplay} • ${new Date(recognition.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            `;
        }).join('');

        setTimeout(() => {
            recognitions.forEach((_, index) => {
                const messageEl = document.getElementById(`recognition-dash-msg-${index}`);
                const btnEl = document.getElementById(`recognition-dash-btn-${index}`);
                if (messageEl && btnEl && messageEl.scrollHeight > messageEl.clientHeight) {
                    btnEl.style.display = 'block';
                }
            });
        }, 100);
    },

    getBadgeColor(badge) {
        const badgeColors = {
            'Inovador': '#9333ea',
            'Colaborativo': '#3b82f6',
            'Dedicado': '#10b981',
            'Criativo': '#ec4899'
        };
        return badgeColors[badge] || '#f59e0b';
    },

    updateAllList(recognitions) {
        const container = document.getElementById('my-recognitions-list');
        if (!container) return;

        if (recognitions.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum reconhecimento encontrado.</div>';
            return;
        }

        container.innerHTML = recognitions.map((recognition, index) => {
            const isReceived = recognition.direction === 'received';
            const displayText = isReceived ?
                `${recognition.from_name} reconheceu você` :
                `Você reconheceu ${recognition.to_name}`;
            const badgeColor = this.getBadgeColor(recognition.badge);
            const iconSvg = isReceived ?
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>' :
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>';
            const messageId = `recognition-msg-${index}`;
            const btnId = `recognition-btn-${index}`;

            const pointsDisplay = recognition.show_points ? (isReceived ? '+10 pontos' : '+5 pontos') : 'Sem pontos';

            return `
                <div class="recognition-item" data-recognition-id="${recognition.Id}" style="border-color: ${badgeColor};">
                    <div class="recognition-icon" style="background: ${badgeColor};">${iconSvg}</div>
                    <div class="recognition-content">
                        <div class="recognition-header">
                            <strong>${displayText}</strong>
                            <span class="recognition-badge" style="background: ${badgeColor}33; color: ${badgeColor};">${recognition.badge}</span>
                        </div>
                        <p class="recognition-message" id="${messageId}" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-wrap: break-word; overflow-wrap: break-word;">${recognition.message}</p>
                        <button id="${btnId}" onclick="toggleRecognitionMessage('${messageId}', '${btnId}')" style="display: none; background: none; border: none; color: ${badgeColor}; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0; margin-top: 4px;">
                            Ler Mais
                        </button>
                        <p class="recognition-points">${pointsDisplay} • ${new Date(recognition.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            `;
        }).join('');

        setTimeout(() => {
            recognitions.forEach((_, index) => {
                const messageEl = document.getElementById(`recognition-msg-${index}`);
                const btnEl = document.getElementById(`recognition-btn-${index}`);
                if (messageEl && btnEl && messageEl.scrollHeight > messageEl.clientHeight) {
                    btnEl.style.display = 'block';
                }
            });
        }, 100);
    },

    openModal() {
        Modal.open('recognition-modal');
    },

    closeModal() {
        Modal.close('recognition-modal');
        this.clearForm();
    },

    clearForm() {
        document.getElementById('recognition-to-user-search').value = '';
        document.getElementById('recognition-to-user').value = '';
        document.getElementById('recognition-message').value = '';
        document.getElementById('custom-badge-input').value = '';
        document.getElementById('custom-badge-container').style.display = 'none';

        document.querySelectorAll('.badge-option').forEach(badge => {
            badge.classList.remove('selected');
        });

        State.selectedBadge = null;
    },

    async submit() {
        const toUserId = document.getElementById('recognition-to-user').value;
        const message = document.getElementById('recognition-message').value.trim();
        let badge = State.selectedBadge;
        const submitBtn = document.querySelector('[data-action="submitRecognition"]');

        if (!toUserId) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Por favor, selecione um colaborador', 'error');
            } else {
                alert('Por favor, selecione um colaborador');
            }
            return;
        }

        if (!badge) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Por favor, selecione um badge de reconhecimento', 'error');
            } else {
                alert('Por favor, selecione um badge de reconhecimento');
            }
            return;
        }

        if (badge === 'outro') {
            const customBadge = document.getElementById('custom-badge-input').value.trim();
            if (!customBadge) {
                if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                    EmailPopup.showToast('Por favor, digite o badge personalizado', 'error');
                } else {
                    alert('Por favor, digite o badge personalizado');
                }
                return;
            }
            badge = customBadge;
        }

        if (!message) {
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Por favor, descreva o motivo do reconhecimento', 'error');
            } else {
                alert('Por favor, descreva o motivo do reconhecimento');
            }
            return;
        }

        // Save original state
        const originalContent = submitBtn ? submitBtn.innerHTML : 'Enviar Reconhecimento';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner"></div> Enviando...';
        }

        try {
            const result = await API.post('/api/recognitions', {
                to_user_id: parseInt(toUserId),
                badge: badge,
                message
            });

            this.closeModal();
            await this.load();
            await this.loadAll();
            await Dashboard.loadMetrics();
            await Dashboard.loadGamification();

            if (result.pointsEarned > 0) {
                if (window.Notifications && typeof Notifications.points === 'function') {
                    Notifications.points(result.pointsEarned, 'dar reconhecimento');
                }
            } else if (result.pointsMessage) {
                if (window.Notifications && typeof Notifications.info === 'function') {
                    Notifications.info(result.pointsMessage);
                }
            }

            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Reconhecimento enviado com sucesso!', 'success');
            }

        } catch (error) {
            console.error('Erro ao enviar reconhecimento:', error);
            if (window.EmailPopup && typeof EmailPopup.showToast === 'function') {
                EmailPopup.showToast('Erro ao enviar reconhecimento', 'error');
            } else {
                alert('Erro ao enviar reconhecimento');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        }
    }
};

// Função para mostrar/ocultar campo de badge personalizado
function showCustomBadgeInput() {
    const container = document.getElementById('custom-badge-container');
    const input = document.getElementById('custom-badge-input');
    container.style.display = 'block';
    input.focus();
}

function hideCustomBadgeInput() {
    const container = document.getElementById('custom-badge-container');
    const input = document.getElementById('custom-badge-input');
    container.style.display = 'none';
    input.value = '';
}

// Função para toggle de mensagem de reconhecimento
function toggleRecognitionMessage(messageId, btnId) {
    const messageEl = document.getElementById(messageId);
    const btnEl = document.getElementById(btnId);

    if (messageEl && btnEl) {
        const isExpanded = messageEl.style.webkitLineClamp === 'unset';

        if (isExpanded) {
            messageEl.style.webkitLineClamp = '3';
            messageEl.style.display = '-webkit-box';
            btnEl.textContent = 'Ler Mais';
        } else {
            messageEl.style.webkitLineClamp = 'unset';
            messageEl.style.display = 'block';
            btnEl.textContent = 'Ler Menos';
        }
    }
}

// Função para limpar filtros de reconhecimentos
function clearRecognitionFilters() {
    document.getElementById('recognition-date-start').value = '';
    document.getElementById('recognition-date-end').value = '';
    document.getElementById('recognition-badge-filter').value = '';
    Recognitions.loadAll();
}

// Função para toggle de filtros de reconhecimentos
function toggleRecognitionFilters() {
    const container = document.getElementById('recognition-filters-container');
    const btn = event.currentTarget;
    const icon = btn.querySelector('svg:last-child');
    const card = btn.closest('.card');

    container.classList.toggle('collapsed');
    btn.classList.toggle('active');

    const isCollapsed = container.classList.contains('collapsed');
    if (card) {
        card.classList.toggle('filters-collapsed', isCollapsed);
    }

    if (isCollapsed) {
        icon.style.transform = 'rotate(0deg)';
    } else {
        icon.style.transform = 'rotate(180deg)';
    }
}

// Global functions for onclick handlers
window.openRecognitionModal = function () {
    Recognitions.openModal();
};

window.closeRecognitionModal = function () {
    Recognitions.closeModal();
};

window.submitRecognition = function () {
    Recognitions.submit();
};