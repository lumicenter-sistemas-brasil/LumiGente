const { getDatabasePool } = require('../config/db');
const { createNotification } = require('./notificationController');

// =================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO (Helpers)
// =================================================================

async function addPointsToUser(pool, userId, action, points) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [alreadyEarnedResult] = await pool.execute(
            `SELECT COUNT(*) as count FROM Gamification WHERE UserId = ? AND Action = ? AND CAST(CreatedAt AS DATE) = ?`,
            [userId, action, today]
        );

        if (alreadyEarnedResult[0].count > 0) {
            return { success: false, points: 0, message: 'Pontos para esta ação já concedidos hoje.' };
        }

        await pool.execute(
            `INSERT INTO Gamification (UserId, Action, Points) VALUES (?, ?, ?)`,
            [userId, action, points]
        );

        // MySQL não tem IF EXISTS em statement único, usar INSERT ... ON DUPLICATE KEY UPDATE
        const [existsCheck] = await pool.execute(`SELECT 1 FROM UserPoints WHERE UserId = ?`, [userId]);
        if (existsCheck.length > 0) {
            await pool.execute(`UPDATE UserPoints SET TotalPoints = TotalPoints + ?, LastUpdated = NOW() WHERE UserId = ?`, [points, userId]);
        } else {
            await pool.execute(`INSERT INTO UserPoints (UserId, TotalPoints) VALUES (?, ?)`, [userId, points]);
        }

        return { success: true, points, message: `+${points} pontos!` };
    } catch (error) {
        console.error(`Erro ao adicionar pontos para '${action}':`, error);
        return { success: false, points: 0, message: 'Erro ao adicionar pontos.' };
    }
}


// =================================================================
// CONTROLLERS (Funções exportadas para as rotas)
// =================================================================

/**
 * POST /api/humor - Registra ou atualiza o humor do dia para o usuário logado.
 */
exports.registrarHumor = async (req, res) => {
    try {
        const { score, description } = req.body;
        const userId = req.session.user.userId;

        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ error: 'Score deve ser um número entre 1 e 5' });
        }

        const pool = await getDatabasePool();
        const today = new Date().toISOString().split('T')[0];
        
        const [existingResult] = await pool.execute(
            `SELECT Id FROM DailyMood WHERE user_id = ? AND CAST(created_at AS DATE) = ?`,
            [userId, today]
        );

        if (existingResult.length > 0) {
            // Atualiza registro existente
            await pool.execute(
                `UPDATE DailyMood SET score = ?, description = ?, updated_at = NOW() WHERE Id = ?`,
                [score, description || null, existingResult[0].Id]
            );
            
            res.json({ success: true, message: 'Humor atualizado com sucesso', pointsEarned: 0 });
        } else {
            // Cria novo registro
            await pool.execute(
                `INSERT INTO DailyMood (user_id, score, description) VALUES (?, ?, ?)`,
                [userId, score, description || null]
            );

            const pointsResult = await addPointsToUser(pool, userId, 'humor_respondido', 5);
            
            // Notificar colegas do mesmo setor
            const [userInfo] = await pool.execute('SELECT NomeCompleto, Departamento FROM Users WHERE Id = ?', [userId]);
            const userName = userInfo[0]?.NomeCompleto || 'Um colega';
            const userDept = userInfo[0]?.Departamento;
            
            if (userDept) {
                const [colleagues] = await pool.execute(
                    'SELECT Id FROM Users WHERE Departamento = ? AND Id != ? AND IsActive = 1',
                    [userDept, userId]
                );
                
                for (const colleague of colleagues) {
                    await createNotification(colleague.Id, 'mood_update', `${userName} registrou o humor do dia`, null);
                }
            }
            
            res.status(201).json({ 
                success: true, 
                message: 'Humor registrado com sucesso',
                pointsEarned: pointsResult.points,
                pointsMessage: pointsResult.message
            });
        }
    } catch (error) {
        console.error('Erro ao registrar humor:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao registrar humor' });
    }
};

/**
 * GET /api/humor - Busca o registro de humor do usuário para o dia atual.
 */
exports.getHumorDoDia = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        const today = new Date().toISOString().split('T')[0];

        const [result] = await pool.execute(
            `SELECT 
                score, 
                description, 
                CONCAT(
                    DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%d'),
                    'T',
                    DATE_FORMAT(COALESCE(updated_at, created_at), '%H:%i:%s')
                ) as updated_at 
             FROM DailyMood 
             WHERE user_id = ? AND CAST(COALESCE(updated_at, created_at) AS DATE) = ?`,
            [userId, today]
        );

        if (result.length > 0) {
            res.json(result[0]);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error('Erro ao buscar humor do dia:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar humor' });
    }
};

/**
 * GET /api/humor/colleagues-today - Busca o humor do dia dos colegas do mesmo departamento.
 */
exports.getColleaguesToday = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        const today = new Date().toISOString().split('T')[0];

        const [result] = await pool.execute(`
            SELECT dm.score, dm.description, u.NomeCompleto as user_name
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE u.Departamento = (SELECT Departamento FROM Users WHERE Id = ?)
              AND u.Id != ?
              AND CAST(dm.created_at AS DATE) = ?
              AND u.IsActive = 1
            ORDER BY u.NomeCompleto
        `, [userId, userId, today]);

        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar humor dos colegas:', error);
        res.status(500).json({ error: 'Erro ao buscar humor dos colegas' });
    }
};

/**
 * GET /api/humor/history - Busca o histórico de humor do usuário nos últimos 7 dias.
 */
exports.getHumorHistory = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const [result] = await pool.execute(`
            SELECT 
                score, 
                description, 
                CONCAT(
                    DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%d'),
                    'T',
                    DATE_FORMAT(COALESCE(updated_at, created_at), '%H:%i:%s')
                ) as updated_at 
            FROM DailyMood 
            WHERE user_id = ? AND COALESCE(updated_at, created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY COALESCE(updated_at, created_at) DESC
        `, [userId]);

        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar histórico de humor:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar histórico de humor' });
    }
};

/**
 * GET /api/humor/team-metrics - Busca a média de humor da equipe (acesso de gestor).
 */
exports.getTeamMetrics = async (req, res) => {
    try {
        const managerId = req.session.user.userId;
        const pool = await getDatabasePool();

        const [result] = await pool.execute(`
            SELECT 
                AVG(CAST(dm.score AS DECIMAL(10,2))) as teamAverage,
                COUNT(DISTINCT dm.user_id) as teamMembers
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE u.Departamento = (SELECT Departamento FROM Users WHERE Id = ?)
              AND dm.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND u.IsActive = 1
        `, [managerId]);
        
        const metrics = {
            teamAverage: result[0].teamAverage || 0,
            teamMembers: result[0].teamMembers || 0
        };

        res.json(metrics);
    } catch (error) {
        console.error('Erro ao buscar métricas da equipe:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas da equipe' });
    }
};

/**
 * GET /api/humor/team-history - Busca o histórico de humor da equipe nos últimos 7 dias.
 */
exports.getTeamHistory = async (req, res) => {
    try {
        const managerId = req.session.user.userId;
        const pool = await getDatabasePool();

        const [result] = await pool.execute(`
            SELECT 
                dm.score, 
                dm.description, 
                CONCAT(
                    DATE_FORMAT(COALESCE(dm.updated_at, dm.created_at), '%Y-%m-%d'),
                    'T',
                    DATE_FORMAT(COALESCE(dm.updated_at, dm.created_at), '%H:%i:%s')
                ) as updated_at, 
                u.NomeCompleto as user_name, 
                u.Departamento as department
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE (
                u.Departamento = (SELECT Departamento FROM Users WHERE Id = ?)
                OR u.Id = ?
            )
              AND COALESCE(dm.updated_at, dm.created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND u.IsActive = 1
            ORDER BY COALESCE(dm.updated_at, dm.created_at) DESC
        `, [managerId, managerId]);
        
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar histórico da equipe:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico da equipe' });
    }
};

/**
 * GET /api/humor/empresa - Busca dados de humor de toda a empresa.
 */
exports.getHumorEmpresa = async (req, res) => {
    try {
        const pool = await getDatabasePool();
        const { departamento, periodo } = req.query;
        
        let query = `
            SELECT 
                AVG(CAST(dm.score AS DECIMAL(10,2))) as avgScore,
                COUNT(*) as totalRecords,
                COUNT(DISTINCT dm.user_id) as uniqueUsers
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE u.IsActive = 1
        `;
        const params = [];
        
        if (periodo) {
            const days = parseInt(periodo) || 30;
            query += ` AND dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
            params.push(days);
        }
        
        if (departamento && departamento !== 'todos') {
            query += ` AND u.Departamento = ?`;
            params.push(departamento);
        }
        
        const [result] = await pool.execute(query, params);
        
        res.json(result[0] || { avgScore: 0, totalRecords: 0, uniqueUsers: 0 });
    } catch (error) {
        console.error('Erro ao buscar humor da empresa:', error);
        res.status(500).json({ error: 'Erro ao buscar humor da empresa' });
    }
};

/**
 * GET /api/humor/metrics - Busca métricas gerais de humor.
 */
exports.getHumorMetrics = async (req, res) => {
    try {
        const pool = await getDatabasePool();
        const { periodo } = req.query;
        
        let query = `
            SELECT 
                u.Departamento,
                AVG(CAST(dm.score AS DECIMAL(10,2))) as avgScore,
                COUNT(*) as totalRecords
            FROM DailyMood dm
            JOIN Users u ON dm.user_id = u.Id
            WHERE u.IsActive = 1
        `;
        const params = [];
        
        if (periodo) {
            const days = parseInt(periodo) || 30;
            query += ` AND dm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
            params.push(days);
        }
        
        query += ` GROUP BY u.Departamento ORDER BY avgScore DESC`;
        
        const [result] = await pool.execute(query, params);
        
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar métricas de humor:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas de humor' });
    }
};
