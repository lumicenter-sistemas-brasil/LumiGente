const sql = require('mssql');
const { getDatabasePool } = require('../config/db'); // Importa a conexão centralizada
const NodeCache = require('node-cache');
const HierarchyManager = require('./hierarchyManager');

class AnalyticsManager {
    constructor() {
        // O construtor agora é mais simples e não depende de injeção de dependência
        this.cache = new NodeCache({ stdTTL: 300 }); // Cache de 5 minutos
        this.hierarchyManager = new HierarchyManager();
    }

    /**
     * Obtém o pool de conexão do banco de dados de forma centralizada.
     * @returns {Promise<sql.ConnectionPool>}
     */
    async getPool() {
        return await getDatabasePool();
    }

    /**
     * Retorna um dashboard completo com os principais indicadores de performance.
     */
    async getCompleteDashboard(currentUser, period = 30, department = null, userId = null) {
        const scope = await this.resolveAnalyticsScope(currentUser);
        const scopeKey = scope.isPrivileged ? 'global' : `team_${scope.allowedUserIds.join('-') || 'empty'}`;
        const cacheKey = `dashboard_${currentUser?.userId || 'anon'}_${scopeKey}_${period}_${department || 'all'}_${userId || 'all'}`;
        const cachedData = this.cache.get(cacheKey);
        if (cachedData) {
            console.log('CACHE HIT:', cacheKey);
            return cachedData;
        }
        console.log('CACHE MISS:', cacheKey);

        const performance = await this.executeWithFallback(
            () => this.getPerformanceIndicators(currentUser, period, department, scope),
            {
                usuarios_ativos_humor: 0,
                usuarios_ativos_feedback: 0,
                usuarios_ativos_reconhecimento: 0,
                total_usuarios: 0,
                total_feedbacks: 0,
                total_reconhecimentos: 0,
                total_registros_humor: 0,
                objetivos_ativos: 0,
                objetivos_concluidos: 0,
                objetivos_em_andamento: 0
            },
            'getPerformanceIndicators'
        );

        const rankings = await this.executeWithFallback(
            async () => ({
                topUsers: await this.getUserRankings(period, department, 5, scope),
                gamification: await this.getGamificationLeaderboard(period, department, 5, scope)
            }),
            { topUsers: [], gamification: [] },
            'getRankings'
        );

        const departments = await this.executeWithFallback(
            () => this.getDepartmentAnalytics(currentUser, period, department, scope),
            [],
            'getDepartmentAnalytics'
        );

        const trends = await this.executeWithFallback(
            () => this.getTrendAnalytics(currentUser, period, department, scope),
            { daily: [], weekly: [] },
            'getTrendAnalytics'
        );

        const satisfaction = await this.executeWithFallback(
            () => this.getSatisfactionMetrics(period, department, scope),
            [],
            'getSatisfactionMetrics'
        );

        const userMetrics = userId
            ? await this.executeWithFallback(
                () => this.getUserEngagementMetrics(userId, period, scope),
                {
                    feedbacks_enviados: 0,
                    feedbacks_recebidos: 0,
                    reconhecimentos_enviados: 0,
                    reconhecimentos_recebidos: 0,
                    humor_registros: 0
                },
                'getUserEngagementMetrics'
            )
            : null;

        const dashboardData = {
            performance,
            rankings,
            departments,
            trends,
            satisfaction,
            userMetrics,
            period,
            department: department || 'Todos',
            generatedAt: new Date().toISOString()
        };

        this.cache.set(cacheKey, dashboardData);
        return dashboardData;
    }

    async executeWithFallback(action, fallback, contextLabel = 'analyticsManager') {
        try {
            return await action();
        } catch (error) {
            console.error(`⚠️  Falha ao executar ${contextLabel}:`, error);
            return fallback;
        }
    }

    normalizeValue(value) {
        return value ? String(value).trim() : '';
    }

    hasGlobalAnalyticsAccess(user) {
        if (!user) return false;
        if (user.role === 'Administrador') return true;

        const privilegedDepartments = [
            'DEPARTAMENTO TREINAM&DESENVOLV',
            'SUPERVISAO RH'
        ];

        const departmentValues = [
            this.normalizeValue(user.departamento).toUpperCase(),
            this.normalizeValue(user.Departamento).toUpperCase(),
            this.normalizeValue(user.descricaoDepartamento).toUpperCase(),
            this.normalizeValue(user.DescricaoDepartamento).toUpperCase()
        ].filter(Boolean);

        return departmentValues.some(dep =>
            privilegedDepartments.some(priv => dep === priv || dep.includes(priv))
        );
    }

    async resolveAnalyticsScope(currentUser) {
        if (!currentUser) {
            return { isPrivileged: false, allowedUserIds: [] };
        }

        if (this.hasGlobalAnalyticsAccess(currentUser)) {
            return { isPrivileged: true, allowedUserIds: [] };
        }

        const accessibleUsers = await this.hierarchyManager.getAccessibleUsers(currentUser, {
            directReportsOnly: true
        }) || [];
        const allowedUserIds = Array.from(new Set(
            accessibleUsers
                .map(user => Number(user.userId))
                .filter(id => Number.isInteger(id) && id > 0)
        ));

        if (currentUser.userId && !allowedUserIds.includes(currentUser.userId)) {
            allowedUserIds.push(currentUser.userId);
        }

        return { isPrivileged: false, allowedUserIds };
    }

    async getAnalyticsScope(currentUser) {
        return this.resolveAnalyticsScope(currentUser);
    }

    buildScopeCondition(field, scope) {
        if (!scope || scope.isPrivileged) return '';
        if (!scope.allowedUserIds || scope.allowedUserIds.length === 0) return ' AND 1 = 0';
        return ` AND ${field} IN (${scope.allowedUserIds.join(',')})`;
    }

    async getAvailableDepartments(currentUser) {
        const scope = await this.resolveAnalyticsScope(currentUser);
        const pool = await this.getPool();

        if (scope.isPrivileged) {
            const result = await pool.request().query(`
                SELECT 
                    ISNULL(NULLIF(LTRIM(RTRIM(DescricaoDepartamento)), ''), Departamento) AS DepartamentoDescricao,
                    COUNT(*) AS userCount
                FROM Users
                WHERE IsActive = 1
                GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(DescricaoDepartamento)), ''), Departamento)
                ORDER BY DepartamentoDescricao
            `);

            const departments = result.recordset
                .map(row => {
                    const value = this.normalizeValue(row.DepartamentoDescricao);
                    if (!value) return null;
                    return {
                        value,
                        label: row.DepartamentoDescricao.trim(),
                        userCount: row.userCount || 0
                    };
                })
                .filter(Boolean);

            return { departments, canViewAll: true };
        }

        const accessibleUsers = await this.hierarchyManager.getAccessibleUsers(currentUser, {
            directReportsOnly: true
        }) || [];

        const departmentMap = new Map();

        accessibleUsers.forEach(user => {
            const description = this.normalizeValue(user.descricaoDepartamento || user.DescricaoDepartamento);
            const fallback = this.normalizeValue(user.departamento || user.Departamento);
            const label = description || fallback;
            if (!label) return;

            const trimmedLabel = label.trim();
            if (!trimmedLabel) return;

            const key = trimmedLabel.toUpperCase();
            if (!departmentMap.has(key)) {
                departmentMap.set(key, {
                    value: trimmedLabel,
                    label: trimmedLabel,
                    userCount: 0
                });
            }
            const entry = departmentMap.get(key);
            entry.userCount += 1;
        });

        if (departmentMap.size === 0) {
            const fallback = this.normalizeValue(currentUser.descricaoDepartamento || currentUser.Departamento || currentUser.departamento);
            if (fallback) {
                const trimmedFallback = fallback.trim();
                if (trimmedFallback) {
                    departmentMap.set(trimmedFallback.toUpperCase(), {
                        value: trimmedFallback,
                        label: trimmedFallback,
                        userCount: 0
                    });
                }
            }
        }

        const departments = Array.from(departmentMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        return { departments, canViewAll: false };
    }

    /**
     * Retorna o ranking de usuários com base no engajamento.
     */
    async getUserRankings(period = 30, department = null, topUsers = 50, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        let query = `
            SELECT TOP ${topUsers}
                u.Id as userId,
                u.NomeCompleto,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(u.DescricaoDepartamento)), ''),
                    dept.DescricaoDepartamento,
                    u.Departamento
                ) AS DescricaoDepartamento,
                COUNT(DISTINCT f_sent.Id) as feedbacks_enviados,
                COUNT(DISTINCT r_sent.Id) as reconhecimentos_enviados,
                COUNT(DISTINCT dm.Id) as humor_registrado,
                (COUNT(DISTINCT f_sent.Id) * 10) + (COUNT(DISTINCT r_sent.Id) * 5) + (COUNT(DISTINCT dm.Id) * 2) as score
            FROM Users u
            LEFT JOIN (
                SELECT 
                    LTRIM(RTRIM(Departamento)) AS DepartamentoCodigo,
                    MAX(NULLIF(LTRIM(RTRIM(DescricaoDepartamento)), '')) AS DescricaoDepartamento
                FROM Users
                WHERE IsActive = 1
                GROUP BY LTRIM(RTRIM(Departamento))
            ) dept ON LTRIM(RTRIM(u.Departamento)) = dept.DepartamentoCodigo
            LEFT JOIN Feedbacks f_sent ON u.Id = f_sent.from_user_id AND f_sent.created_at >= DATEADD(day, -@period, GETDATE())
            LEFT JOIN Recognitions r_sent ON u.Id = r_sent.from_user_id AND r_sent.created_at >= DATEADD(day, -@period, GETDATE())
            LEFT JOIN DailyMood dm ON u.Id = dm.user_id AND dm.created_at >= DATEADD(day, -@period, GETDATE())
            WHERE u.IsActive = 1
        `;

        const request = pool.request().input('period', sql.Int, period);
        if (department) {
            const normalizedDepartment = this.normalizeValue(department);
            query += ` AND (TRIM(u.Departamento) = @department OR TRIM(ISNULL(u.DescricaoDepartamento,'')) = @department)`;
            request.input('department', sql.NVarChar, normalizedDepartment);
        }
        query += this.buildScopeCondition('u.Id', scope);
        query += ` GROUP BY 
            u.Id, 
            u.NomeCompleto, 
            u.DescricaoDepartamento, 
            dept.DescricaoDepartamento, 
            u.Departamento
            ORDER BY score DESC`;
        
        const result = await request.query(query);
        return result.recordset;
    }

    /**
     * Retorna o leaderboard de gamificação com base nos pontos.
     */
    async getGamificationLeaderboard(period = 30, department = null, topUsers = 100, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        let query = `
            SELECT TOP ${topUsers}
                u.Id as userId, u.NomeCompleto, u.Departamento, up.TotalPoints as total_pontos
            FROM UserPoints up
            JOIN Users u ON up.UserId = u.Id
            WHERE u.IsActive = 1
        `;

        const request = pool.request();
        if (department) {
            const normalizedDepartment = this.normalizeValue(department);
            query += ` AND (TRIM(u.Departamento) = @department OR TRIM(ISNULL(u.DescricaoDepartamento,'')) = @department)`;
            request.input('department', sql.NVarChar, normalizedDepartment);
        }
        query += this.buildScopeCondition('u.Id', scope);
        query += ` ORDER BY up.TotalPoints DESC`;
        
        const result = await request.query(query);
        return result.recordset;
    }

    /**
     * Retorna métricas de analytics agrupadas por departamento.
     */
    async getDepartmentAnalytics(currentUser, period = 30, department = null, scope = null) {
        scope = scope || await this.resolveAnalyticsScope(currentUser);
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        const request = pool.request().input('period', sql.Int, period);
        let filterClause = '';
        if (department) {
            const normalizedDepartment = this.normalizeValue(department);
            if (normalizedDepartment) {
                request.input('department', sql.NVarChar, normalizedDepartment);
                filterClause = ` AND (TRIM(u.Departamento) = @department OR TRIM(ISNULL(u.DescricaoDepartamento,'')) = @department)`;
            }
        }

        // A lógica de permissão (ver todos vs. apenas o seu) deve ser aplicada aqui.
        // Este exemplo assume que o currentUser já foi verificado e tem acesso.
        const query = `
            SELECT 
                u.Departamento,
                ISNULL(NULLIF(LTRIM(RTRIM(u.DescricaoDepartamento)), ''), u.Departamento) AS DescricaoDepartamento,
                COUNT(DISTINCT u.Id) as total_usuarios,
                AVG(CAST(dm.score AS FLOAT)) as media_humor,
                COUNT(DISTINCT f.Id) as total_feedbacks,
                COUNT(DISTINCT r.Id) as total_reconhecimentos
            FROM Users u
            LEFT JOIN DailyMood dm ON u.Id = dm.user_id AND dm.created_at >= DATEADD(day, -@period, GETDATE())
            LEFT JOIN Feedbacks f ON u.Id = f.from_user_id AND f.created_at >= DATEADD(day, -@period, GETDATE())
            LEFT JOIN Recognitions r ON u.Id = r.from_user_id AND r.created_at >= DATEADD(day, -@period, GETDATE())
            WHERE u.IsActive = 1${filterClause}
            ${this.buildScopeCondition('u.Id', scope)}
            GROUP BY u.Departamento, ISNULL(NULLIF(LTRIM(RTRIM(u.DescricaoDepartamento)), ''), u.Departamento)
            ORDER BY total_usuarios DESC
        `;

        const result = await request.query(query);
        return result.recordset;
    }

    /**
     * Retorna dados de tendências para gráficos (diário e semanal).
     */
    async getTrendAnalytics(currentUser, period = 30, department = null, scope = null) {
        scope = scope || await this.resolveAnalyticsScope(currentUser);
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return { daily: [], weekly: [] };
        }

        const pool = await this.getPool();
        let queryFilter = '';
        const request = pool.request().input('period', sql.Int, period);

        if (department) {
            const normalizedDepartment = this.normalizeValue(department);
            queryFilter += ` AND (TRIM(u.Departamento) = @department OR TRIM(ISNULL(u.DescricaoDepartamento,'')) = @department)`;
            request.input('department', sql.NVarChar, normalizedDepartment);
        }

        const dailyQuery = `
            SELECT 
                CAST(dm.created_at AS DATE) as date,
                AVG(CAST(dm.score AS FLOAT)) as avg_mood,
                COUNT(*) as entries
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE dm.created_at >= DATEADD(day, -@period, GETDATE()) ${queryFilter}
            ${this.buildScopeCondition('dm.user_id', scope)}
            GROUP BY CAST(dm.created_at AS DATE)
            ORDER BY date ASC
        `;
        const dailyResult = await request.query(dailyQuery);

        const weeklyQuery = `
            SELECT 
                DATEPART(year, dm.created_at) as year,
                DATEPART(week, dm.created_at) as week,
                AVG(CAST(dm.score AS FLOAT)) as avg_mood,
                COUNT(*) as entries
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE dm.created_at >= DATEADD(day, -@period, GETDATE()) ${queryFilter}
            ${this.buildScopeCondition('dm.user_id', scope)}
            GROUP BY DATEPART(year, dm.created_at), DATEPART(week, dm.created_at)
            ORDER BY year, week ASC
        `;
        const weeklyResult = await request.query(weeklyQuery);
        
        return { daily: dailyResult.recordset, weekly: weeklyResult.recordset };
    }

    /**
     * Retorna métricas de satisfação, como eNPS.
     */
    async getSatisfactionMetrics(period = 30, department = null, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        let query = `
            SELECT
                (SUM(CASE WHEN score >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as promotores_perc,
                (SUM(CASE WHEN score <= 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as detratores_perc,
                AVG(CAST(score as FLOAT)) as media_humor
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE dm.created_at >= DATEADD(day, -@period, GETDATE())
        `;
        const request = pool.request().input('period', sql.Int, period);
        if (department) {
            const normalizedDepartment = this.normalizeValue(department);
            query += " AND (TRIM(u.Departamento) = @department OR TRIM(ISNULL(u.DescricaoDepartamento,'')) = @department)";
            request.input('department', sql.NVarChar, normalizedDepartment);
        }
        if (!scope.isPrivileged) {
            query += this.buildScopeCondition('dm.user_id', scope);
        }
        const result = await request.query(query);
        return result.recordset;
    }

    /**
     * Retorna métricas de engajamento para um usuário específico.
     */
    async getUserEngagementMetrics(userId, period = 30, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged) {
            if (!scope.allowedUserIds || scope.allowedUserIds.length === 0 || !scope.allowedUserIds.includes(userId)) {
                return {
                    feedbacks_enviados: 0,
                    feedbacks_recebidos: 0,
                    reconhecimentos_enviados: 0,
                    reconhecimentos_recebidos: 0,
                    humor_registros: 0
                };
            }
        }

        const pool = await this.getPool();
        const request = pool.request().input('period', sql.Int, period).input('userId', sql.Int, userId);
        const query = `
            SELECT
                (SELECT COUNT(*) FROM Feedbacks WHERE from_user_id = @userId AND created_at >= DATEADD(day, -@period, GETDATE())) as feedbacks_enviados,
                (SELECT COUNT(*) FROM Feedbacks WHERE to_user_id = @userId AND created_at >= DATEADD(day, -@period, GETDATE())) as feedbacks_recebidos,
                (SELECT COUNT(*) FROM Recognitions WHERE from_user_id = @userId AND created_at >= DATEADD(day, -@period, GETDATE())) as reconhecimentos_enviados,
                (SELECT COUNT(*) FROM Recognitions WHERE to_user_id = @userId AND created_at >= DATEADD(day, -@period, GETDATE())) as reconhecimentos_recebidos,
                (SELECT COUNT(*) FROM DailyMood WHERE user_id = @userId AND created_at >= DATEADD(day, -@period, GETDATE())) as humor_registros
        `;
        const result = await request.query(query);
        return result.recordset[0];
    }

    /**
     * Retorna indicadores gerais de performance da plataforma.
     */
    async getPerformanceIndicators(currentUser, period = 30, department = null, scope = null) {
        scope = scope || await this.resolveAnalyticsScope(currentUser);
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return {
                usuarios_ativos_humor: 0,
                usuarios_ativos_feedback: 0,
                usuarios_ativos_reconhecimento: 0,
                total_usuarios: 0,
                total_feedbacks: 0,
                total_reconhecimentos: 0,
                total_registros_humor: 0,
                objetivos_ativos: 0,
                objetivos_concluidos: 0,
                objetivos_em_andamento: 0
            };
        }

        const pool = await this.getPool();
        const request = pool.request().input('period', sql.Int, period);
        let normalizedDepartment = null;
        if (department) {
            normalizedDepartment = this.normalizeValue(department);
            request.input('department', sql.NVarChar, normalizedDepartment);
        }

        const departmentFilter = (alias) => normalizedDepartment
            ? ` AND (TRIM(${alias}.Departamento) = @department OR TRIM(ISNULL(${alias}.DescricaoDepartamento,'')) = @department)`
            : '';

        const query = `
            SELECT
                (SELECT COUNT(DISTINCT dm.user_id)
                 FROM DailyMood dm
                 JOIN Users uh ON dm.user_id = uh.Id
                 WHERE dm.created_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('uh')}${this.buildScopeCondition('dm.user_id', scope)}) AS usuarios_ativos_humor,

                (SELECT COUNT(DISTINCT f.from_user_id)
                 FROM Feedbacks f
                 JOIN Users uf ON f.from_user_id = uf.Id
                 WHERE f.created_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('uf')}${this.buildScopeCondition('f.from_user_id', scope)}) AS usuarios_ativos_feedback,

                (SELECT COUNT(DISTINCT r.from_user_id)
                 FROM Recognitions r
                 JOIN Users ur ON r.from_user_id = ur.Id
                 WHERE r.created_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('ur')}${this.buildScopeCondition('r.from_user_id', scope)}) AS usuarios_ativos_reconhecimento,

                (SELECT COUNT(*)
                 FROM Users u
                 WHERE u.IsActive = 1${departmentFilter('u')}${this.buildScopeCondition('u.Id', scope)}) AS total_usuarios,

                (SELECT COUNT(*)
                 FROM Feedbacks f
                 JOIN Users uft ON f.to_user_id = uft.Id
                 WHERE f.created_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('uft')}${this.buildScopeCondition('f.to_user_id', scope)}) AS total_feedbacks,

                (SELECT COUNT(*)
                 FROM Recognitions r
                 JOIN Users urt ON r.to_user_id = urt.Id
                 WHERE r.created_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('urt')}${this.buildScopeCondition('r.to_user_id', scope)}) AS total_reconhecimentos,

                (SELECT COUNT(*)
                 FROM DailyMood dm2
                 JOIN Users um2 ON dm2.user_id = um2.Id
                 WHERE dm2.created_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('um2')}${this.buildScopeCondition('dm2.user_id', scope)}) AS total_registros_humor,

                (SELECT COUNT(*)
                 FROM Objetivos o
                 JOIN Users uo ON o.criado_por = uo.Id
                 WHERE o.status = 'Ativo'${departmentFilter('uo')}${this.buildScopeCondition('uo.Id', scope)}) AS objetivos_ativos,

                (SELECT COUNT(*)
                 FROM Objetivos o
                 JOIN Users uo2 ON o.criado_por = uo2.Id
                 WHERE o.status = 'Concluído'
                   AND o.updated_at >= DATEADD(day, -@period, GETDATE())${departmentFilter('uo2')}${this.buildScopeCondition('uo2.Id', scope)}) AS objetivos_concluidos,

                (SELECT COUNT(*)
                 FROM Objetivos o
                 JOIN Users uo3 ON o.criado_por = uo3.Id
                 WHERE o.status IN ('Aguardando Aprovação', 'Pausado')${departmentFilter('uo3')}${this.buildScopeCondition('uo3.Id', scope)}) AS objetivos_em_andamento
        `;
        const result = await request.query(query);
        return result.recordset[0];
    }
    
    /**
     * Busca detalhes de uma equipe para a página de gestão.
     */
    async getTeamManagementDetails(userIds, status) {
        if (!userIds || userIds.length === 0) return [];
        const pool = await this.getPool();
        let query = `
            SELECT u.Id, u.NomeCompleto, u.Departamento, u.DescricaoDepartamento, u.LastLogin, u.IsActive,
                   (SELECT AVG(CAST(score AS FLOAT)) FROM DailyMood WHERE user_id = u.Id AND created_at >= DATEADD(day, -30, GETDATE())) as lastMood,
                   (SELECT COUNT(*) FROM Feedbacks WHERE to_user_id = u.Id AND created_at >= DATEADD(day, -30, GETDATE())) as recentFeedbacks,
                   (SELECT COUNT(DISTINCT o.Id) FROM Objetivos o JOIN ObjetivoResponsaveis orr ON o.Id = orr.objetivo_id WHERE orr.responsavel_id = u.Id AND o.status = 'Ativo') as activeObjectives
            FROM Users u
            WHERE u.Id IN (${userIds.join(',')})
        `;
        if (status === 'ativo') query += ' AND u.IsActive = 1';
        if (status === 'inativo') query += ' AND u.IsActive = 0';
        query += ' ORDER BY u.NomeCompleto';
        
        const result = await pool.request().query(query);
        return result.recordset;
    }

    // Funções de gerenciamento de cache
    clearCache() {
        this.cache.flushAll();
        console.log('Cache do AnalyticsManager limpo.');
    }

    getCacheStats() {
        return this.cache.getStats();
    }
}

module.exports = AnalyticsManager;