// Team Tab Module
const Team = {
    async load() {
        try {
            const members = await API.get('/api/team/members');
            this.updateList(members);
        } catch (error) {
            console.error('Erro ao carregar equipe:', error);
        }
    },

    updateList(members) {
        const container = document.getElementById('team-list');
        if (!container) return;

        if (members.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum membro encontrado.</div>';
            return;
        }

        container.innerHTML = members.map(member => `
            <div class="team-member-item">
                <div class="team-member-avatar"><i class="fas fa-user"></i></div>
                <div class="team-member-info">
                    <strong>${member.nomeCompleto || member.nome}</strong>
                    <p>${member.departamento || 'Departamento não informado'}</p>
                </div>
            </div>
        `).join('');
    }
};
