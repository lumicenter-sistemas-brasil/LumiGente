const HierarchyManager = require('../services/hierarchyManager');
const AnalyticsManager = require('../services/analyticsManager');

const hierarchyManager = new HierarchyManager();
const analyticsManager = new AnalyticsManager();

/**
 * GET /api/team/members
 * Retorna a lista de membros acessíveis ao gestor autenticado.
 */
exports.getTeamMembers = async (req, res) => {
    try {
        const currentUser = req.session.user;

        if (!currentUser) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        const { status, departamento } = req.query;

        // Busca usuários acessíveis a partir da hierarquia do gestor
        const accessibleUsers = await hierarchyManager.getAccessibleUsers(currentUser, {
            department: departamento && departamento !== 'Todos' ? departamento : null,
            directReportsOnly: true
        });

        const allUserIds = [
            currentUser.userId,
            ...accessibleUsers.map(user => user.userId)
        ];

        const uniqueUserIds = [...new Set(allUserIds.filter(Boolean))];

        if (uniqueUserIds.length === 0) {
            return res.json([]);
        }

        const teamMembers = await analyticsManager.getTeamManagementDetails(uniqueUserIds, status);

        const normalizedMembers = teamMembers.map(member => ({
            id: member.Id,
            nomeCompleto: member.NomeCompleto || member.nomeCompleto || member.nome,
            departamento: member.Departamento || member.departamento,
            descricaoDepartamento: member.DescricaoDepartamento || member.descricaoDepartamento,
            ultimoAcesso: member.LastLogin || member.lastLogin,
            ativo: member.IsActive === undefined ? undefined : Boolean(member.IsActive),
            humorMedio: member.lastMood ?? null,
            feedbacksRecentes: member.recentFeedbacks ?? 0,
            objetivosAtivos: member.activeObjectives ?? 0
        }));

        res.json(normalizedMembers);
    } catch (error) {
        console.error('Erro ao buscar membros da equipe:', error);
        res.status(500).json({ error: 'Erro ao buscar membros da equipe' });
    }
};

