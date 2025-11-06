// Analytics Tab Module
const Analytics = {
    async load() {
        await this.loadData();
    },

    async loadData() {
        try {
            const periodSelect = document.getElementById('analytics-period');
            const departmentSelect = document.getElementById('analytics-department');
            
            const period = periodSelect?.value || '30';
            const department = departmentSelect?.value || 'all';
            
            const data = await API.get('/api/analytics', { period, department });
            this.updateCharts(data);
        } catch (error) {
            console.error('Erro ao carregar analytics:', error);
        }
    },

    updateCharts(data) {
        const container = document.getElementById('analytics-charts');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-summary">
                <div class="analytics-card">
                    <h4>Total de Feedbacks</h4>
                    <p class="analytics-value">${data.totalFeedbacks || 0}</p>
                </div>
                <div class="analytics-card">
                    <h4>Total de Reconhecimentos</h4>
                    <p class="analytics-value">${data.totalRecognitions || 0}</p>
                </div>
                <div class="analytics-card">
                    <h4>Média de Humor</h4>
                    <p class="analytics-value">${data.avgHumor ? data.avgHumor.toFixed(1) : 'N/A'}</p>
                </div>
                <div class="analytics-card">
                    <h4>Objetivos Concluídos</h4>
                    <p class="analytics-value">${data.completedGoals || 0}</p>
                </div>
            </div>
        `;
    }
};
