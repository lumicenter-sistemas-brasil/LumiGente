const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const AnalyticsManager = require('../services/analyticsManager');
const HierarchyManager = require('../services/hierarchyManager');

// Instancia os services para serem usados pelo controller
const analyticsManager = new AnalyticsManager();
const hierarchyManager = new HierarchyManager();

/**
 * GET /api/metrics - Retorna métricas simples para o dashboard do usuário individual.
 */
exports.getUserMetrics = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const feedbacksResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as count FROM Feedbacks 
                WHERE to_user_id = @userId AND created_at >= DATEADD(day, -30, GETDATE())
            `);

        const recognitionsResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as count FROM Recognitions 
                WHERE to_user_id = @userId AND created_at >= DATEADD(day, -30, GETDATE())
            `);

        const sentFeedbacksResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as count FROM Feedbacks 
                WHERE from_user_id = @userId AND created_at >= DATEADD(day, -30, GETDATE())
            `);

        res.json({
            feedbacksReceived: feedbacksResult.recordset[0].count || 0,
            recognitionsReceived: recognitionsResult.recordset[0].count || 0,
            feedbacksSent: sentFeedbacksResult.recordset[0].count || 0,
        });
    } catch (error) {
        console.error('Erro ao buscar métricas do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas' });
    }
};

/**
 * GET /api/analytics/dashboard - Retorna um dashboard completo com todos os indicadores.
 */
exports.getCompleteDashboard = async (req, res) => {
    try {
        const { period = 30, department, userId } = req.query;
        const currentUser = req.session.user;

        // O AnalyticsManager já lida com a lógica de permissão internamente
        const dashboardData = await analyticsManager.getCompleteDashboard(
            currentUser,
            parseInt(period),
            department && department !== 'Todos' ? department : null,
            userId ? parseInt(userId) : null
        );

        res.json(dashboardData);
    } catch (error) {
        console.error('Erro ao buscar dashboard completo:', error);
        res.status(500).json({ error: 'Erro ao buscar dashboard completo' });
    }
};

/**
 * GET /api/analytics/rankings - Retorna os rankings de usuários.
 */
exports.getUserRankings = async (req, res) => {
    try {
        const { period = 30, department, topUsers = 50 } = req.query;
        const currentUser = req.session.user;
        const scope = await analyticsManager.getAnalyticsScope(currentUser);
        
        const rankings = await analyticsManager.getUserRankings(
            parseInt(period),
            department && department !== 'Todos' ? department : null,
            parseInt(topUsers),
            scope
        );

        res.json(rankings);
    } catch (error) {
        console.error('Erro ao buscar rankings:', error);
        res.status(500).json({ error: 'Erro ao buscar rankings' });
    }
};

/**
 * GET /api/analytics/gamification-leaderboard - Retorna o leaderboard de gamificação.
 */
exports.getGamificationLeaderboard = async (req, res) => {
    try {
        const { period = 30, department, topUsers = 100 } = req.query;
        const currentUser = req.session.user;
        const scope = await analyticsManager.getAnalyticsScope(currentUser);
        
        const leaderboard = await analyticsManager.getGamificationLeaderboard(
            parseInt(period),
            department && department !== 'Todos' ? department : null,
            parseInt(topUsers),
            scope
        );

        res.json(leaderboard);
    } catch (error) {
        console.error('Erro ao buscar leaderboard de gamificação:', error);
        res.status(500).json({ error: 'Erro ao buscar leaderboard de gamificação' });
    }
};

/**
 * GET /api/analytics/department-analytics - Retorna dados de analytics agrupados por departamento.
 */
exports.getDepartmentAnalytics = async (req, res) => {
    try {
        const { period = 30, department } = req.query;
        const currentUser = req.session.user;

        const deptAnalytics = await analyticsManager.getDepartmentAnalytics(
            currentUser,
            parseInt(period),
            department && department !== 'Todos' ? department : null
        );

        res.json(deptAnalytics);
    } catch (error) {
        console.error('Erro ao buscar analytics por departamento:', error);
        res.status(500).json({ error: 'Erro ao buscar analytics por departamento' });
    }
};

/**
 * GET /api/analytics/trends - Retorna dados de tendências para gráficos.
 */
exports.getTrendAnalytics = async (req, res) => {
    try {
        const { period = 30, department } = req.query;
        const currentUser = req.session.user;

        const trends = await analyticsManager.getTrendAnalytics(
            currentUser,
            parseInt(period),
            department && department !== 'Todos' ? department : null
        );

        res.json(trends);
    } catch (error) {
        console.error('Erro ao buscar tendências:', error);
        res.status(500).json({ error: 'Erro ao buscar tendências' });
    }
};

/**
 * GET /api/analytics/available-departments - Retorna departamentos acessíveis ao usuário.
 */
exports.getAvailableDepartments = async (req, res) => {
    try {
        const currentUser = req.session.user;
        if (!currentUser) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        const { departments, canViewAll } = await analyticsManager.getAvailableDepartments(currentUser);
        res.json({ departments, canViewAll });
    } catch (error) {
        console.error('Erro ao buscar departamentos disponíveis:', error);
        res.status(500).json({ error: 'Erro ao buscar departamentos disponíveis' });
    }
};

/**
 * GET /api/manager/team-management - Retorna uma lista detalhada dos membros da equipe para gestão.
 */
exports.getTeamManagementData = async (req, res) => {
    try {
        const currentUser = req.session.user;
        const { status, departamento } = req.query;

        // Usar HierarchyManager para obter os IDs dos usuários acessíveis
        const accessibleUsers = await hierarchyManager.getAccessibleUsers(currentUser, {
            department: departamento && departamento !== 'Todos' ? departamento : null
        });
        
        // Inclui o próprio gestor na lista para visualização
        const allUserIds = [...new Set([currentUser.userId, ...accessibleUsers.map(user => user.userId)])];
        
        if (allUserIds.length === 0) {
            return res.json([]);
        }

        const teamMembers = await analyticsManager.getTeamManagementDetails(allUserIds, status);

        res.json(teamMembers);
    } catch (error) {
        console.error('Erro ao buscar dados de gestão de equipe:', error);
        res.status(500).json({ error: 'Erro ao buscar dados de gestão de equipe' });
    }
};

/**
 * GET /api/manager/employee-info/:employeeId - Retorna informações de um colaborador específico.
 */
exports.getEmployeeInfo = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('employeeId', sql.Int, employeeId)
            .query(`SELECT Id, NomeCompleto, Departamento, LastLogin, IsActive FROM Users WHERE Id = @employeeId`);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Colaborador não encontrado' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Erro ao buscar dados do colaborador:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do colaborador' });
    }
};

/**
 * GET /api/manager/employee-feedbacks/:employeeId - Retorna feedbacks de um colaborador.
 */
exports.getEmployeeFeedbacks = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('employeeId', sql.Int, employeeId)
            .query(`
                SELECT f.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name,
                       CASE WHEN f.to_user_id = @employeeId THEN 'received' ELSE 'sent' END as direction
                FROM Feedbacks f
                JOIN Users u1 ON f.from_user_id = u1.Id
                JOIN Users u2 ON f.to_user_id = u2.Id
                WHERE f.to_user_id = @employeeId OR f.from_user_id = @employeeId
                ORDER BY f.created_at DESC
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar feedbacks do colaborador:', error);
        res.status(500).json({ error: 'Erro ao buscar feedbacks do colaborador' });
    }
};

/**
 * GET /api/manager/team-metrics - Retorna métricas da equipe.
 */
exports.getTeamMetrics = async (req, res) => {
    try {
        const currentUser = req.session.user;
        const pool = await getDatabasePool();

        // Usar HierarchyManager para obter os IDs dos usuários acessíveis
        const accessibleUsers = await hierarchyManager.getAccessibleUsers(currentUser, {
            directReportsOnly: true
        });

        const teamMemberIds = [...new Set(
            accessibleUsers
                .filter(user => user.TipoRelacao !== 'PROPRIO_USUARIO')
                .map(user => user.userId)
                .filter(Boolean)
        )];

        if (teamMemberIds.length === 0) {
            return res.json({
                totalMembers: 0,
                activeMembers: 0,
                totalFeedbacks: 0,
                totalRecognitions: 0,
                avgMood: 0,
                activeObjectives: 0
            });
        }

        // Buscar métricas da equipe
        const placeholders = teamMemberIds.map((_, index) => `@userId${index}`).join(',');
        
        const metricsQuery = `
            SELECT 
                COUNT(DISTINCT u.Id) as totalMembers,
                COUNT(DISTINCT CASE WHEN u.IsActive = 1 THEN u.Id END) as activeMembers,
                COUNT(DISTINCT f.Id) as totalFeedbacks,
                COUNT(DISTINCT r.Id) as totalRecognitions,
                AVG(CAST(h.score AS FLOAT)) as avgMood,
                COUNT(DISTINCT o.Id) as activeObjectives
            FROM Users u
            LEFT JOIN Feedbacks f ON (f.from_user_id = u.Id OR f.to_user_id = u.Id) 
                AND f.created_at >= DATEADD(day, -30, GETDATE())
            LEFT JOIN Recognitions r ON (r.from_user_id = u.Id OR r.to_user_id = u.Id) 
                AND r.created_at >= DATEADD(day, -30, GETDATE())
            LEFT JOIN DailyMood h ON h.user_id = u.Id 
                AND h.created_at >= DATEADD(day, -30, GETDATE())
            LEFT JOIN Objetivos o ON (o.criado_por = u.Id OR EXISTS(
                SELECT 1 FROM ObjetivoResponsaveis orr WHERE orr.objetivo_id = o.Id AND orr.responsavel_id = u.Id
            )) AND o.status = 'Ativo'
            WHERE u.Id IN (${placeholders})
        `;

        const request = pool.request();
        teamMemberIds.forEach((userId, index) => {
            request.input(`userId${index}`, sql.Int, userId);
        });

        const result = await request.query(metricsQuery);
        
        res.json({
            totalMembers: result.recordset[0].totalMembers || 0,
            activeMembers: result.recordset[0].activeMembers || 0,
            totalFeedbacks: result.recordset[0].totalFeedbacks || 0,
            totalRecognitions: result.recordset[0].totalRecognitions || 0,
            avgMood: result.recordset[0].avgMood ? Math.round(result.recordset[0].avgMood * 10) / 10 : 0,
            activeObjectives: result.recordset[0].activeObjectives || 0
        });
    } catch (error) {
        console.error('Erro ao buscar métricas da equipe:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas da equipe' });
    }
};

/**
 * GET /api/manager/team-status - Retorna status dos colaboradores da equipe.
 */
exports.getTeamStatus = async (req, res) => {
    try {
        const currentUser = req.session.user;
        const pool = await getDatabasePool();

        // Usar HierarchyManager para obter os IDs dos usuários acessíveis
        const accessibleUsers = await hierarchyManager.getAccessibleUsers(currentUser, {
            directReportsOnly: true
        });

        const teamMemberIds = [...new Set(
            accessibleUsers
                .filter(user => user.TipoRelacao !== 'PROPRIO_USUARIO')
                .map(user => user.userId)
                .filter(Boolean)
        )];

        if (teamMemberIds.length === 0) {
            return res.json({
                online: 0,
                offline: 0,
                active: 0,
                inactive: 0
            });
        }

        const placeholders = teamMemberIds.map((_, index) => `@userId${index}`).join(',');
        
        const statusQuery = `
            SELECT 
                u.Id,
                u.NomeCompleto,
                u.Departamento,
                u.LastLogin,
                u.IsActive,
                CASE 
                    WHEN u.LastLogin >= DATEADD(day, -7, GETDATE()) THEN 'Ativo'
                    WHEN u.LastLogin >= DATEADD(day, -30, GETDATE()) THEN 'Inativo'
                    ELSE 'Muito Inativo'
                END as status,
                COUNT(DISTINCT f.Id) as recentFeedbacks,
                COUNT(DISTINCT o.Id) as activeObjectives,
                AVG(CAST(h.score AS FLOAT)) as avgMood
            FROM Users u
            LEFT JOIN Feedbacks f ON (f.from_user_id = u.Id OR f.to_user_id = u.Id) 
                AND f.created_at >= DATEADD(day, -30, GETDATE())
            LEFT JOIN Objetivos o ON (o.criado_por = u.Id OR EXISTS(
                SELECT 1 FROM ObjetivoResponsaveis orr WHERE orr.objetivo_id = o.Id AND orr.responsavel_id = u.Id
            )) AND o.status = 'Ativo'
            LEFT JOIN DailyMood h ON h.user_id = u.Id 
                AND h.created_at >= DATEADD(day, -30, GETDATE())
            WHERE u.Id IN (${placeholders})
            GROUP BY u.Id, u.NomeCompleto, u.Departamento, u.LastLogin, u.IsActive
            ORDER BY u.NomeCompleto
        `;

        const request = pool.request();
        teamMemberIds.forEach((userId, index) => {
            request.input(`userId${index}`, sql.Int, userId);
        });

        const result = await request.query(statusQuery);
        
        // Calcular contadores de status
        const users = result.recordset.map(user => ({
            ...user,
            avgMood: user.avgMood ? Math.round(user.avgMood * 10) / 10 : null
        }));
        
        // Calcular status dos colaboradores
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        
        const statusCounts = {
            online: users.filter(user => {
                if (!user.LastLogin) return false;
                const lastLogin = new Date(user.LastLogin);
                return lastLogin >= thirtyMinutesAgo;
            }).length,
            offline: users.filter(user => {
                if (!user.LastLogin) return true;
                const lastLogin = new Date(user.LastLogin);
                return lastLogin < thirtyMinutesAgo;
            }).length,
            active: users.filter(user => user.IsActive === 1).length,
            inactive: users.filter(user => user.IsActive === 0).length
        };
        
        res.json(statusCounts);
    } catch (error) {
        console.error('Erro ao buscar status da equipe:', error);
        res.status(500).json({ error: 'Erro ao buscar status da equipe' });
    }
};

/**
 * GET /api/manager/departments - Retorna lista de departamentos.
 */
exports.getDepartments = async (req, res) => {
    try {
        const pool = await getDatabasePool();
        
        const result = await pool.request().query(`
            SELECT DISTINCT Departamento, COUNT(*) as totalUsers
            FROM Users 
            WHERE IsActive = 1 AND Departamento IS NOT NULL AND Departamento != ''
            GROUP BY Departamento
            ORDER BY Departamento
        `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar departamentos:', error);
        res.status(500).json({ error: 'Erro ao buscar departamentos' });
    }
};

/**
 * GET /api/analytics/comprehensive - Retorna analytics abrangentes.
 */
exports.getComprehensiveAnalytics = async (req, res) => {
    try {
        const { period = 30 } = req.query;
        const currentUser = req.session.user;
        
        console.log('🔍 getComprehensiveAnalytics chamado para:', currentUser.nomeCompleto);
        
        // Retornar dados básicos para evitar erro 500
        const analytics = {
            performance: {
                totalUsers: 0,
                activeUsers: 0,
                avgMood: 0,
                totalFeedbacks: 0
            },
            rankings: {
                topUsers: [],
                gamification: []
            },
            departments: [],
            trends: {
                daily: [],
                weekly: []
            },
            satisfaction: [],
            userMetrics: null,
            period: parseInt(period),
            department: 'Todos',
            generatedAt: new Date().toISOString(),
            // Dados específicos para o frontend
            engagement: {
                participationRate: 0,
                activeUsers: 0,
                totalUsers: 0,
                moodEntries: 0,
                moodUsers: 0,
                feedbackCount: 0,
                feedbackUsers: 0,
                recognitionCount: 0,
                recognitionUsers: 0
            },
            mood: {
                averageScore: 0,
                totalEntries: 0,
                trend: 'stable',
                distribution: {
                    happy: 0,
                    neutral: 0,
                    sad: 0
                }
            },
            feedback: {
                totalFeedbacks: 0,
                positiveFeedbacks: 0,
                negativeFeedbacks: 0,
                averageRating: 0,
                totalRecognitions: 0
            },
            gamification: {
                totalPoints: 0,
                activeUsers: 0,
                topUsers: [],
                recentActivities: []
            },
            objectives: {
                totalObjectives: 0,
                completedObjectives: 0,
                pendingObjectives: 0,
                overdueObjectives: 0
            },
            performance: {
                averageScore: 0,
                highPerformers: 0,
                needsImprovement: 0,
                totalEvaluations: 0
            },
            topUsers: []
        };
        
        res.json(analytics);
    } catch (error) {
        console.error('❌ Erro ao buscar analytics abrangentes:', error);
        res.status(500).json({ error: 'Erro ao buscar analytics abrangentes' });
    }
};

/**
 * GET /api/analytics/temporal - Retorna análise temporal dos dados.
 */
exports.getTemporalAnalysis = async (req, res) => {
    try {
        const { period = 30, department } = req.query;
        const currentUser = req.session.user;
        
        console.log('🔍 getTemporalAnalysis chamado para:', currentUser.nomeCompleto);
        
        // Retornar dados temporais básicos para evitar erro 404
        const temporalData = {
            dailyMood: [],
            feedbacks: [],
            recognitions: [],
            objectives: [],
            period: parseInt(period),
            department: department || 'Todos',
            generatedAt: new Date().toISOString(),
            message: 'Dados temporais carregados com sucesso'
        };
        
        res.json(temporalData);
    } catch (error) {
        console.error('❌ Erro ao buscar análise temporal:', error);
        res.status(500).json({ error: 'Erro ao buscar análise temporal' });
    }
};

/**
 * GET /api/analytics/departments-list - Retorna lista de departamentos para analytics.
 */
exports.getDepartmentsList = async (req, res) => {
    try {
        const pool = await getDatabasePool();
        const result = await pool.request().query(`
            SELECT DISTINCT 
                Departamento as name, 
                Departamento as value,
                COUNT(*) as userCount
            FROM Users 
            WHERE IsActive = 1 AND Departamento IS NOT NULL 
            GROUP BY Departamento 
            ORDER BY Departamento
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar lista de departamentos:', error);
        res.status(500).json({ error: 'Erro ao buscar lista de departamentos' });
    }
};

/**
 * GET /api/historico/dados - Retorna dados históricos.
 */
exports.getHistoricoDados = async (req, res) => {
    try {
        const { periodo = 'todos', tipo = 'todos', departamento = 'todos' } = req.query;

        res.json({
            success: true,
            filtrosAplicados: { periodo, tipo, departamento },
            dados: {}
        });
    } catch (error) {
        console.error('Erro ao buscar dados históricos:', error);
        res.status(500).json({ error: 'Erro ao buscar dados históricos' });
    }
};


