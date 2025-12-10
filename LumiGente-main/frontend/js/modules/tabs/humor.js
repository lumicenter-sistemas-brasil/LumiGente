// Humor Tab Module
const Humor = {
    async load() {
        await Promise.all([
            this.loadMyToday(),
            this.loadCompany(),
            this.loadColleaguesToday(),
            this.loadHistory()
        ]);
    },

    select(score) {
        State.selectedHumorScore = score;
        document.querySelectorAll('.humor-option').forEach(option => option.classList.remove('selected'));
        document.querySelector(`[data-score="${score}"]`)?.classList.add('selected');
    },

    async submit() {
        if (!State.selectedHumorScore) {
            EmailPopup.showToast('Selecione um humor', 'error');
            return;
        }

        const description = document.getElementById('humor-description').value;

        try {
            const result = await API.post('/api/humor', {
                score: State.selectedHumorScore,
                description
            });

            if (result.pointsEarned > 0) {
                Notifications.points(result.pointsEarned, 'registrar humor');
                await Dashboard.loadGamification();
            }

            EmailPopup.showToast('Humor registrado com sucesso!', 'success');

            State.selectedHumorScore = null;
            document.getElementById('humor-description').value = '';
            document.querySelectorAll('.humor-option').forEach(option => option.classList.remove('selected'));
            await this.load();
        } catch (error) {
            console.error('Erro ao registrar humor:', error);
            EmailPopup.showToast('Erro ao registrar humor', 'error');
        }
    },

    async loadMyToday() {
        try {
            const humor = await API.get('/api/humor');
            this.updateMyToday(humor);
        } catch (error) {
            console.error('Erro ao carregar humor:', error);
        }
    },

    updateMyToday(humor) {
        const container = document.getElementById('my-humor-today');
        if (!container) return;

        if (!humor) {
            container.innerHTML = '<p>Você ainda não registrou seu humor hoje.</p>';
            return;
        }

        const humorLabels = ['', 'Muito Triste', 'Triste', 'Neutro', 'Feliz', 'Muito Feliz'];
        const humorIcons = [
            '',
            '<i data-lucide="frown" style="width: 48px; height: 48px; color: #f59e0b;"></i>',
            '<i data-lucide="meh" style="width: 48px; height: 48px; color: #f59e0b;"></i>',
            '<i data-lucide="smile" style="width: 48px; height: 48px; color: #f59e0b;"></i>',
            '<i data-lucide="laugh" style="width: 48px; height: 48px; color: #f59e0b;"></i>',
            '<i data-lucide="smile-plus" style="width: 48px; height: 48px; color: #f59e0b;"></i>'
        ];

        const descriptionHtml = humor.description ? this.formatDescription(humor.description, 'my-humor') : '';

        container.innerHTML = `
            <div style="text-align: center;">
                <div style="margin-bottom: 16px;">${humorIcons[humor.score]}</div>
                <h4>${humorLabels[humor.score]}</h4>
                ${descriptionHtml}
                <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">
                    Registrado em ${humor.updated_at ? new Date(humor.updated_at).toLocaleString('pt-BR') : 'Data não disponível'}
                </p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    async loadCompany() {
        try {
            const user = State.getUser();
            const isManager = user && user.hierarchyLevel >= 3;
            const companyHumorCard = document.getElementById('company-humor-card');
            const myHumorCard = document.getElementById('my-humor-card');

            if (!isManager) {
                if (companyHumorCard) companyHumorCard.style.display = 'none';
                if (myHumorCard) myHumorCard.classList.add('full-width');
                return;
            }

            if (companyHumorCard) companyHumorCard.style.display = 'block';
            if (myHumorCard) myHumorCard.classList.remove('full-width');

            const metrics = await API.get('/api/humor/team-metrics');
            this.updateCompany(metrics);
        } catch (error) {
            console.error('Erro ao carregar humor da equipe:', error);
        }
    },

    updateCompany(metrics) {
        const container = document.getElementById('company-humor');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center;">
                <h4 style="font-size: 32px; color: #10b981; margin-bottom: 8px;">${metrics.teamAverage.toFixed(1)}</h4>
                <p style="color: #6b7280;">Média da equipe (últimos 7 dias)</p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
                    ${metrics.teamMembers} membros da equipe
                </p>
            </div>
        `;
    },

    async loadColleaguesToday() {
        try {
            const user = State.getUser();
            const isManager = user && user.hierarchyLevel >= 3;
            const colleaguesCard = document.getElementById('colleagues-humor-card');

            if (isManager && colleaguesCard) {
                colleaguesCard.style.display = 'none';
                return;
            }

            if (colleaguesCard) colleaguesCard.style.display = 'block';

            const colleagues = await API.get('/api/humor/colleagues-today');
            this.updateColleaguesToday(colleagues);
        } catch (error) {
            console.error('Erro ao carregar humor dos colegas:', error);
        }
    },

    updateColleaguesToday(colleagues) {
        const container = document.getElementById('colleagues-humor-today');
        if (!container) return;

        if (colleagues.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9ca3af;">Nenhum colega registrou humor hoje.</p>';
            return;
        }

        container.innerHTML = colleagues.map((c, index) => {
            const descriptionHtml = c.description ? this.formatDescription(c.description, `colleague-${index}`) : '';
            const mood = this.getMoodMeta(c.score);
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <div style="flex: 1;">
                        <strong style="color: #374151;">${c.user_name}</strong>
                        ${descriptionHtml}
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; margin-left: 12px; min-width: 90px;">
                        ${mood.icon}
                        <span style="margin-top: 4px; font-weight: 600; color: ${mood.color}; font-size: 13px;">${mood.label}</span>
                    </div>
                </div>
            `;
        }).join('');
        // Ícones inline, não é necessário lucide aqui
    },

    async loadHistory() {
        try {
            const user = State.getUser();
            const isManager = user && user.hierarchyLevel >= 3;

            if (isManager) {
                const history = await API.get('/api/humor/team-history');
                this.updateHistory(history, true);
            } else {
                const history = await API.get('/api/humor/history');
                this.updateHistory(history, false);
            }
        } catch (error) {
            console.error('Erro ao carregar histórico de humor:', error);
        }
    },

    updateHistory(history, isManager = false) {
        const container = document.getElementById('humor-history');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<p>Nenhum registro de humor encontrado.</p>';
            return;
        }

        if (!isManager) {
            container.innerHTML = history.map((entry, index) => {
                const descriptionHtml = entry.description ? this.formatDescription(entry.description, `history-user-${index}`) : '<p style="color: #6b7280; font-size: 14px;">Sem descrição</p>';
                const mood = this.getMoodMeta(entry.score);
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
                        <div style="flex: 1;">
                            <strong>Seu humor</strong>
                            ${descriptionHtml}
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center; margin-left: 12px; min-width: 90px;">
                            ${mood.icon}
                            <span style="margin-top: 4px; font-weight: 600; color: ${mood.color}; font-size: 13px;">${mood.label}</span>
                            <p style="margin-top: 6px; font-size: 12px; color: #9ca3af;">${entry.updated_at ? new Date(entry.updated_at).toLocaleDateString('pt-BR') : entry.created_at ? new Date(entry.created_at).toLocaleDateString('pt-BR') : 'Data não disponível'}</p>
                        </div>
                    </div>
                `;
            }).join('');
            return;
        }

        container.innerHTML = history.map((entry, index) => {
            const descriptionHtml = entry.description ? this.formatDescription(entry.description, `history-team-${index}`) : '<p style="color: #6b7280; font-size: 14px;">Sem descrição</p>';
            const mood = this.getMoodMeta(entry.score);
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <div style="flex: 1;">
                        <strong>${entry.user_name || 'Usuário'}</strong>
                        ${descriptionHtml}
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; margin-left: 12px; min-width: 90px;">
                        ${mood.icon}
                        <span style="margin-top: 4px; font-weight: 600; color: ${mood.color}; font-size: 13px;">${mood.label}</span>
                        <p style="margin-top: 6px; font-size: 12px; color: #9ca3af;">${new Date(new Date(entry.created_at).getTime() + 180 * 60 * 1000).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    getMoodMeta(score) {
        const s = parseInt(score, 10) || 0;
        const meta = {
            1: { label: 'Muito triste', color: '#ef4444', path: '<path d="M8 15s1.5-2 4-2 4 2 4 2"/>' },
            2: { label: 'Triste', color: '#f97316', path: '<path d="M8 15s2-1 4-1 4 1 4 1"/>' },
            3: { label: 'Neutro', color: '#6b7280', path: '<line x1="8" y1="15" x2="16" y2="15"/>' },
            4: { label: 'Feliz', color: '#10b981', path: '<path d="M8 14s1.5 2 4 2 4-2 4-2"/>' },
            5: { label: 'Muito feliz', color: '#22c55e', path: '<path d="M8 13s2 3 4 3 4-3 4-3"/>' }
        }[s] || { label: 'Indefinido', color: '#9ca3af', path: '<line x1="8" y1="15" x2="16" y2="15"/>' };

        const svg = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
                ${meta.path}
            </svg>
        `;
        return { label: meta.label, color: meta.color, icon: svg };
    },

    formatDescription(description, id) {
        if (!description) return '';

        const formattedText = description.replace(/\n/g, '<br>');
        const maxLength = 150;

        if (description.length <= maxLength) {
            return `<p style="color: #6b7280; font-size: 14px; margin-top: 4px; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${formattedText}</p>`;
        }

        const shortText = description.substring(0, maxLength).replace(/\n/g, '<br>');

        return `
            <div>
                <p id="desc-short-${id}" style="color: #6b7280; font-size: 14px; margin-top: 4px; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${shortText}...</p>
                <p id="desc-full-${id}" style="color: #6b7280; font-size: 14px; margin-top: 4px; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; display: none;">${formattedText}</p>
                <button onclick="Humor.toggleDescription('${id}')" style="background: none; border: none; color: #0d556d; font-size: 12px; cursor: pointer; padding: 4px 0; margin-top: 4px;">
                    <span id="toggle-${id}">Ler mais</span>
                </button>
            </div>
        `;
    },

    toggleDescription(id) {
        const shortEl = document.getElementById(`desc-short-${id}`);
        const fullEl = document.getElementById(`desc-full-${id}`);
        const toggleEl = document.getElementById(`toggle-${id}`);

        if (shortEl && fullEl && toggleEl) {
            if (shortEl.style.display === 'none') {
                shortEl.style.display = 'block';
                fullEl.style.display = 'none';
                toggleEl.textContent = 'Ler mais';
            } else {
                shortEl.style.display = 'none';
                fullEl.style.display = 'block';
                toggleEl.textContent = 'Ler menos';
            }
        }
    }
};

// Global functions for onclick handlers
function submitHumor() {
    Humor.submit();
}
