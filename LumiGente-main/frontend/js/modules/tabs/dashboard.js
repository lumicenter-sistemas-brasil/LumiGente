// Dashboard Tab Module
const Dashboard = {
    async load() {
        await Promise.all([
            this.loadMetrics(),
            this.loadGamification(),
            this.loadColleaguesHumor()
        ]);
    },

    async loadMetrics() {
        try {
            const metrics = await API.get('/api/metrics');
            const feedbacksReceived = document.getElementById('feedbacks-received-count');
            const recognitionsReceived = document.getElementById('recognitions-received-count');
            const feedbacksSent = document.getElementById('feedbacks-sent-count');
            const avgScore = document.getElementById('avg-score');
            
            if (feedbacksReceived) feedbacksReceived.textContent = metrics.feedbacksReceived;
            if (recognitionsReceived) recognitionsReceived.textContent = metrics.recognitionsReceived;
            if (feedbacksSent) feedbacksSent.textContent = metrics.feedbacksSent;
            if (avgScore) avgScore.textContent = metrics.avgScore;
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
        }
    },

    async loadGamification() {
        try {
            const userData = await API.get('/api/gamification/points');
            this.updateUserPoints(userData);

            const data = await API.get('/api/gamification/leaderboard', { topUsers: 10 });
            this.updateLeaderboard(data.leaderboard);
            this.updateUserRanking(data.userRanking);
        } catch (error) {
            console.error('Erro ao carregar gamificação:', error);
        }
    },

    updateUserPoints(userData) {
        const pointsElement = document.getElementById('user-points');
        if (pointsElement) {
            pointsElement.textContent = userData.TotalPoints || 0;
        }
    },

    updateUserRanking(userRanking) {
        const userRankingInfo = document.getElementById('user-ranking-info');
        if (!userRanking || !userRankingInfo) return;

        userRankingInfo.style.display = 'block';
        
        if (userRanking.hasPoints === false || userRanking.totalPoints === 0) {
            userRankingInfo.innerHTML = `
                <div class="user-ranking-card no-points">
                    <div class="user-ranking-details">
                        <div class="user-ranking-message">
                            <p>Você ainda não possui pontos</p>
                            <p class="points-info">Para ganhar pontos, explore as funcionalidades do sistema:</p>
                            <ul class="points-actions">
                                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Envie e responda feedbacks</li>
                                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> Envie e receba reconhecimentos</li>
                                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Conclua objetivos</li>
                                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> Responda o humor do dia</li>
                                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Participe de pesquisas</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        } else {
            userRankingInfo.innerHTML = `
                <div class="user-ranking-card">
                    <div class="user-ranking-position">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                        <span id="user-position">${userRanking.position || '-'}</span>
                    </div>
                    <div class="user-ranking-details">
                        <div class="user-ranking-name">Você</div>
                        <div class="user-ranking-points" id="user-total-points">${userRanking.totalPoints || 0} pontos</div>
                    </div>
                </div>
            `;
        }
    },

    updateLeaderboard(leaderboard) {
        const container = document.getElementById('leaderboard-preview');
        if (!container) return;

        if (!leaderboard || leaderboard.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum dado disponível.</div>';
            return;
        }

        const getMedalSVG = (position) => {
            if (position === 1) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
            if (position === 2) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
            if (position === 3) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CD7F32" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';
            return position;
        };

        container.innerHTML = leaderboard.map((user, index) => {
            const position = index + 1;
            const positionClass = position === 1 ? 'top-1' : position === 2 ? 'top-2' : position === 3 ? 'top-3' : 'other';

            return `
                <div class="leaderboard-item">
                    <div class="leaderboard-position ${positionClass}">
                        ${getMedalSVG(position)}
                    </div>
                    <div class="leaderboard-user">
                        <div class="leaderboard-user-name">${user.NomeCompleto || user.UserName}</div>
                        <div class="leaderboard-user-department">${user.DescricaoDepartamento || 'Departamento não informado'}</div>
                    </div>
                    <div class="leaderboard-score">${user.TotalPoints || 0} pts</div>
                </div>
            `;
        }).join('');
    },

    async loadColleaguesHumor() {
        try {
            const user = State.getUser();
            const isManager = user && user.hierarchyLevel >= 3;
            const colleaguesCard = document.getElementById('dashboard-colleagues-humor-card');

            if (isManager && colleaguesCard) {
                colleaguesCard.style.display = 'none';
                return;
            }

            if (colleaguesCard) colleaguesCard.style.display = 'block';

            const colleagues = await API.get('/api/humor/colleagues-today');
            this.updateColleaguesHumor(colleagues);
        } catch (error) {
            console.error('Erro ao carregar humor dos colegas:', error);
        }
    },

    updateColleaguesHumor(colleagues) {
        const container = document.getElementById('dashboard-colleagues-humor-today');
        if (!container) return;

        if (colleagues.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9ca3af;">Nenhum colega registrou humor hoje.</p>';
            return;
        }

        container.innerHTML = colleagues.map((c, index) => {
            const descriptionHtml = c.description ? this.formatDescription(c.description, `dashboard-colleague-${index}`) : '';
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
                <button onclick="Dashboard.toggleDescription('${id}')" style="background: none; border: none; color: #0d556d; font-size: 12px; cursor: pointer; padding: 4px 0; margin-top: 4px;">
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
