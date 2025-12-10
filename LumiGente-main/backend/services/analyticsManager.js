const { getDatabasePool } = require('../config/db');
const NodeCache = require('node-cache');
const HierarchyManager = require('./hierarchyManager');

class AnalyticsManager {
    constructor() {
        this.cache = new NodeCache({ stdTTL: 300 });
        this.hierarchyManager = new HierarchyManager();
    }

    async getPool() {
        return await getDatabasePool();
    }

    async getCompleteDashboard(currentUser, period = 30, department = null, userId = null) {
        const scope = await this.resolveAnalyticsScope(currentUser);
        const scopeKey = scope.isPrivileged ? 'global' : `team_${scope.allowedUserIds.join('-') || 'empty'}`;
        const cacheKey = `dashboard_${currentUser?.userId || 'anon'}_${scopeKey}_${period}_${department || 'all'}_${userId || 'all'}`;
        const cachedData = this.cache.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const performance = await this.executeWithFallback(
            () => this.getPerformanceIndicators(currentUser, period, department, scope),
            {
                usuarios_ativos_humor: 0, usuarios_ativos_feedback: 0, usuarios_ativos_reconhecimento: 0,
                total_usuarios: 0, total_feedbacks: 0, total_reconhecimentos: 0, total_registros_humor: 0,
                objetivos_ativos: 0, objetivos_concluidos: 0, objetivos_aguardando_aprovacao: 0, objetivos_agendados: 0, objetivos_expirados: 0
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
            { promotores_perc: 0, detratores_perc: 0, media_humor: null },
            'getSatisfactionMetrics'
        );

        const userMetrics = userId
            ? await this.executeWithFallback(
                () => this.getUserEngagementMetrics(userId, period, scope),
                { feedbacks_enviados: 0, feedbacks_recebidos: 0, reconhecimentos_enviados: 0, reconhecimentos_recebidos: 0, humor_registros: 0 },
                'getUserEngagementMetrics'
            )
            : null;

        const dashboardData = {
            performance, rankings, departments, trends, satisfaction, userMetrics,
            period, department: department || 'Todos', generatedAt: new Date().toISOString()
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

        const privilegedDepartments = ['DEPARTAMENTO TREINAM&DESENVOLV', 'SUPERVISAO RH'];
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

        const accessibleUsers = await this.hierarchyManager.getAccessibleUsers(currentUser, { directReportsOnly: true }) || [];
        const allowedUserIds = Array.from(new Set(
            accessibleUsers.map(user => Number(user.userId)).filter(id => Number.isInteger(id) && id > 0)
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
            const [rows] = await pool.execute(`
                SELECT 
                    IFNULL(NULLIF(TRIM(DescricaoDepartamento), ''), Departamento) AS DepartamentoDescricao,
                    COUNT(*) AS userCount
                FROM Users
                WHERE IsActive = 1
                GROUP BY IFNULL(NULLIF(TRIM(DescricaoDepartamento), ''), Departamento)
                ORDER BY DepartamentoDescricao
            `);

            const departments = rows
                .map(row => {
                    const value = this.normalizeValue(row.DepartamentoDescricao);
                    if (!value) return null;
                    return { value, label: row.DepartamentoDescricao.trim(), userCount: row.userCount || 0 };
                })
                .filter(Boolean);

            return { departments, canViewAll: true };
        }

        const accessibleUsers = await this.hierarchyManager.getAccessibleUsers(currentUser, { directReportsOnly: true }) || [];
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
                departmentMap.set(key, { value: trimmedLabel, label: trimmedLabel, userCount: 0 });
            }
            departmentMap.get(key).userCount += 1;
        });

        if (departmentMap.size === 0) {
            const fallback = this.normalizeValue(currentUser.descricaoDepartamento || currentUser.Departamento || currentUser.departamento);
            if (fallback) {
                const trimmedFallback = fallback.trim();
                if (trimmedFallback) {
                    departmentMap.set(trimmedFallback.toUpperCase(), { value: trimmedFallback, label: trimmedFallback, userCount: 0 });
                }
            }
        }

        const departments = Array.from(departmentMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        return { departments, canViewAll: false };
    }

    async getUserRankings(period = 30, department = null, topUsers = 50, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        const params = [period];
        let departmentFilter = '';
        
        if (department) {
            departmentFilter = ` AND (TRIM(u.Departamento) = ? OR TRIM(IFNULL(u.DescricaoDepartamento,'')) = ?)`;
            params.push(this.normalizeValue(department), this.normalizeValue(department));
        }

        const query = `
            SELECT 
                u.Id as userId,
                u.NomeCompleto,
                COALESCE(
                    NULLIF(TRIM(u.DescricaoDepartamento), ''),
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
                    TRIM(Departamento) AS DepartamentoCodigo,
                    MAX(NULLIF(TRIM(DescricaoDepartamento), '')) AS DescricaoDepartamento
                FROM Users
                WHERE IsActive = 1
                GROUP BY TRIM(Departamento)
            ) dept ON TRIM(u.Departamento) = dept.DepartamentoCodigo
            LEFT JOIN Feedbacks f_sent ON u.Id = f_sent.from_user_id AND f_sent.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            LEFT JOIN Recognitions r_sent ON u.Id = r_sent.from_user_id AND r_sent.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            LEFT JOIN DailyMood dm ON u.Id = dm.user_id AND dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            WHERE u.IsActive = 1 ${departmentFilter} ${this.buildScopeCondition('u.Id', scope)}
            GROUP BY u.Id, u.NomeCompleto, u.DescricaoDepartamento, dept.DescricaoDepartamento, u.Departamento
            ORDER BY score DESC
            LIMIT ${topUsers}
        `;
        
        // Adicionar period três vezes para as três subconsultas
        const allParams = [period, period, period, ...params.slice(1)];
        const [rows] = await pool.execute(query, allParams);
        return rows;
    }

    async getGamificationLeaderboard(period = 30, department = null, topUsers = 100, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        const params = [];
        let departmentFilter = '';
        
        if (department) {
            departmentFilter = ` AND (TRIM(u.Departamento) = ? OR TRIM(IFNULL(u.DescricaoDepartamento,'')) = ?)`;
            params.push(this.normalizeValue(department), this.normalizeValue(department));
        }

        const query = `
            SELECT u.Id as userId, u.NomeCompleto, u.Departamento, up.TotalPoints as total_pontos
            FROM UserPoints up
            JOIN Users u ON up.UserId = u.Id
            WHERE u.IsActive = 1 ${departmentFilter} ${this.buildScopeCondition('u.Id', scope)}
            ORDER BY up.TotalPoints DESC
            LIMIT ${topUsers}
        `;
        
        const [rows] = await pool.execute(query, params);
        return rows;
    }

    async getDepartmentAnalytics(currentUser, period = 30, department = null, scope = null) {
        scope = scope || await this.resolveAnalyticsScope(currentUser);
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        const params = [period, period, period];
        let filterClause = '';
        
        if (department) {
            filterClause = ` AND (TRIM(u.Departamento) = ? OR TRIM(IFNULL(u.DescricaoDepartamento,'')) = ?)`;
            params.push(this.normalizeValue(department), this.normalizeValue(department));
        }

        const query = `
            SELECT 
                u.Departamento,
                IFNULL(NULLIF(TRIM(u.DescricaoDepartamento), ''), u.Departamento) AS DescricaoDepartamento,
                COUNT(DISTINCT u.Id) as total_usuarios,
                AVG(CAST(dm.score AS DECIMAL(10,2))) as media_humor,
                COUNT(DISTINCT f.Id) as total_feedbacks,
                COUNT(DISTINCT r.Id) as total_reconhecimentos
            FROM Users u
            LEFT JOIN DailyMood dm ON u.Id = dm.user_id AND dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            LEFT JOIN Feedbacks f ON u.Id = f.from_user_id AND f.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            LEFT JOIN Recognitions r ON u.Id = r.from_user_id AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            WHERE u.IsActive = 1 ${filterClause} ${this.buildScopeCondition('u.Id', scope)}
            GROUP BY u.Departamento, IFNULL(NULLIF(TRIM(u.DescricaoDepartamento), ''), u.Departamento)
            ORDER BY total_usuarios DESC
        `;

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    async getTrendAnalytics(currentUser, period = 30, department = null, scope = null) {
        scope = scope || await this.resolveAnalyticsScope(currentUser);
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return { daily: [], weekly: [] };
        }

        const pool = await this.getPool();
        let queryFilter = '';
        const params = [period];
        
        if (department) {
            queryFilter = ` AND (TRIM(u.Departamento) = ? OR TRIM(IFNULL(u.DescricaoDepartamento,'')) = ?)`;
            params.push(this.normalizeValue(department), this.normalizeValue(department));
        }

        const dailyQuery = `
            SELECT 
                CAST(dm.created_at AS DATE) as date,
                AVG(CAST(dm.score AS DECIMAL(10,2))) as avg_mood,
                COUNT(*) as entries
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ${queryFilter} ${this.buildScopeCondition('dm.user_id', scope)}
            GROUP BY CAST(dm.created_at AS DATE)
            ORDER BY date ASC
        `;
        const [dailyRows] = await pool.execute(dailyQuery, params);

        // Usar semana ISO (WEEK mode 3) para evitar defasagem (ex: semana 49 vs 50)
        const weeklyQuery = `
            SELECT 
                yearweek,
                FLOOR(yearweek / 100) as year,
                MOD(yearweek, 100) as week,
                AVG(CAST(score AS DECIMAL(10,2))) as avg_mood,
                COUNT(*) as entries
            FROM (
                SELECT 
                    YEARWEEK(dm.created_at, 3) as yearweek,
                    dm.score
                FROM DailyMood dm
                JOIN Users u ON dm.user_id = u.Id
                WHERE dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ${queryFilter} ${this.buildScopeCondition('dm.user_id', scope)}
            ) as weekly_data
            GROUP BY yearweek
            ORDER BY yearweek ASC
        `;
        const [weeklyRows] = await pool.execute(weeklyQuery, params);
        
        return { daily: dailyRows, weekly: weeklyRows };
    }

    async getSatisfactionMetrics(period = 30, department = null, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return [];
        }

        const pool = await this.getPool();
        const params = [period];
        let departmentFilter = '';
        
        if (department) {
            departmentFilter = ` AND (TRIM(u.Departamento) = ? OR TRIM(IFNULL(u.DescricaoDepartamento,'')) = ?)`;
            params.push(this.normalizeValue(department), this.normalizeValue(department));
        }

        const query = `
            SELECT
                CASE 
                    WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN score >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
                    ELSE 0
                END as promotores_perc,
                CASE 
                    WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN score <= 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
                    ELSE 0
                END as detratores_perc,
                CASE 
                    WHEN COUNT(*) > 0 THEN AVG(CAST(score AS DECIMAL(10,2)))
                    ELSE NULL
                END as media_humor
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE COALESCE(dm.updated_at, dm.created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY) ${departmentFilter} ${this.buildScopeCondition('dm.user_id', scope)}
        `;
        
        const [rows] = await pool.execute(query, params);
        const result = rows.length > 0 ? rows[0] : { promotores_perc: 0, detratores_perc: 0, media_humor: null };
        
        // Garantir que media_humor seja numérico ou null
        if (result.media_humor !== null && result.media_humor !== undefined) {
            result.media_humor = parseFloat(result.media_humor);
        }
        
        return result;
    }

    async getUserEngagementMetrics(userId, period = 30, scope = null) {
        scope = scope || { isPrivileged: true };
        if (!scope.isPrivileged) {
            if (!scope.allowedUserIds || scope.allowedUserIds.length === 0 || !scope.allowedUserIds.includes(userId)) {
                return { feedbacks_enviados: 0, feedbacks_recebidos: 0, reconhecimentos_enviados: 0, reconhecimentos_recebidos: 0, humor_registros: 0 };
            }
        }

        const pool = await this.getPool();
        const [rows] = await pool.execute(`
            SELECT
                (SELECT COUNT(*) FROM Feedbacks WHERE from_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as feedbacks_enviados,
                (SELECT COUNT(*) FROM Feedbacks WHERE to_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as feedbacks_recebidos,
                (SELECT COUNT(*) FROM Recognitions WHERE from_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as reconhecimentos_enviados,
                (SELECT COUNT(*) FROM Recognitions WHERE to_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as reconhecimentos_recebidos,
                (SELECT COUNT(*) FROM DailyMood WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as humor_registros
        `, [userId, period, userId, period, userId, period, userId, period, userId, period]);
        
        return rows[0];
    }

    async getPerformanceIndicators(currentUser, period = 30, department = null, scope = null) {
        scope = scope || await this.resolveAnalyticsScope(currentUser);
        if (!scope.isPrivileged && (!scope.allowedUserIds || scope.allowedUserIds.length === 0)) {
            return {
                usuarios_ativos_humor: 0, usuarios_ativos_feedback: 0, usuarios_ativos_reconhecimento: 0,
                total_usuarios: 0, total_feedbacks: 0, total_reconhecimentos: 0, total_registros_humor: 0,
                objetivos_ativos: 0, objetivos_concluidos: 0, objetivos_aguardando_aprovacao: 0, objetivos_agendados: 0, objetivos_expirados: 0
            };
        }

        const pool = await this.getPool();
        const departmentFilter = (alias) => department
            ? ` AND (TRIM(${alias}.Departamento) = '${this.normalizeValue(department)}' OR TRIM(IFNULL(${alias}.DescricaoDepartamento,'')) = '${this.normalizeValue(department)}')`
            : '';

        const query = `
            SELECT
                (SELECT COUNT(DISTINCT dm.user_id) FROM DailyMood dm JOIN Users uh ON dm.user_id = uh.Id WHERE dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('uh')}${this.buildScopeCondition('dm.user_id', scope)}) AS usuarios_ativos_humor,
                (SELECT COUNT(DISTINCT f.from_user_id) FROM Feedbacks f JOIN Users uf ON f.from_user_id = uf.Id WHERE f.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('uf')}${this.buildScopeCondition('f.from_user_id', scope)}) AS usuarios_ativos_feedback,
                (SELECT COUNT(DISTINCT r.from_user_id) FROM Recognitions r JOIN Users ur ON r.from_user_id = ur.Id WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('ur')}${this.buildScopeCondition('r.from_user_id', scope)}) AS usuarios_ativos_reconhecimento,
                (SELECT COUNT(*) FROM Users u WHERE u.IsActive = 1${departmentFilter('u')}${this.buildScopeCondition('u.Id', scope)}) AS total_usuarios,
                (SELECT COUNT(*) FROM Feedbacks f JOIN Users uft ON f.to_user_id = uft.Id WHERE f.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('uft')}${this.buildScopeCondition('f.to_user_id', scope)}) AS total_feedbacks,
                (SELECT COUNT(*) FROM Recognitions r JOIN Users urt ON r.to_user_id = urt.Id WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('urt')}${this.buildScopeCondition('r.to_user_id', scope)}) AS total_reconhecimentos,
                (SELECT COUNT(*) FROM DailyMood dm2 JOIN Users um2 ON dm2.user_id = um2.Id WHERE dm2.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('um2')}${this.buildScopeCondition('dm2.user_id', scope)}) AS total_registros_humor,
                (SELECT COUNT(*) FROM Objetivos o JOIN Users uo ON o.criado_por = uo.Id WHERE o.status = 'Ativo'${departmentFilter('uo')}${this.buildScopeCondition('uo.Id', scope)}) AS objetivos_ativos,
                (SELECT COUNT(*) FROM Objetivos o JOIN Users uo2 ON o.criado_por = uo2.Id WHERE o.status = 'Concluído' AND o.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${departmentFilter('uo2')}${this.buildScopeCondition('uo2.Id', scope)}) AS objetivos_concluidos,
                (SELECT COUNT(*) FROM Objetivos o JOIN Users uo3 ON o.criado_por = uo3.Id WHERE o.status = 'Aguardando Aprovação'${departmentFilter('uo3')}${this.buildScopeCondition('uo3.Id', scope)}) AS objetivos_aguardando_aprovacao,
                (SELECT COUNT(*) FROM Objetivos o JOIN Users uo4 ON o.criado_por = uo4.Id WHERE o.status = 'Agendado'${departmentFilter('uo4')}${this.buildScopeCondition('uo4.Id', scope)}) AS objetivos_agendados,
                (SELECT COUNT(*) FROM Objetivos o JOIN Users uo5 ON o.criado_por = uo5.Id WHERE o.status = 'Expirado'${departmentFilter('uo5')}${this.buildScopeCondition('uo5.Id', scope)}) AS objetivos_expirados
        `;
        
        const [rows] = await pool.execute(query, [period, period, period, period, period, period, period]);
        return rows[0];
    }
    
    async getTeamManagementDetails(userIds, status) {
        if (!userIds || userIds.length === 0) return [];
        const pool = await this.getPool();
        let query = `
            SELECT u.Id, u.NomeCompleto, u.Departamento, u.DescricaoDepartamento, u.LastLogin, u.IsActive,
                   (SELECT AVG(CAST(score AS DECIMAL(10,2))) FROM DailyMood WHERE user_id = u.Id AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as lastMood,
                   (SELECT COUNT(*) FROM Feedbacks WHERE to_user_id = u.Id AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as recentFeedbacks,
                   (SELECT COUNT(DISTINCT o.Id) FROM Objetivos o JOIN ObjetivoResponsaveis orr ON o.Id = orr.objetivo_id WHERE orr.responsavel_id = u.Id AND o.status = 'Ativo') as activeObjectives
            FROM Users u
            WHERE u.Id IN (${userIds.join(',')})
        `;
        if (status === 'ativo') query += ' AND u.IsActive = 1';
        if (status === 'inativo') query += ' AND u.IsActive = 0';
        query += ' ORDER BY u.NomeCompleto';
        
        const [rows] = await pool.execute(query);
        return rows;
    }

    clearCache() {
        this.cache.flushAll();
        console.log('Cache do AnalyticsManager limpo.');
    }

    getCacheStats() {
        return this.cache.getStats();
    }
}

module.exports = AnalyticsManager;
