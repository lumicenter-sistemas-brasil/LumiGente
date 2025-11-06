const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const { createNotification } = require('./notificationController');
const emailService = require('../services/emailService');

// =================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO (Helpers)
// =================================================================

/**
 * Adiciona pontos de gamificação a um usuário por uma ação específica, uma vez por dia.
 * @param {object} pool - A instância do pool de conexão com o banco de dados.
 * @param {number} userId - ID do usuário que receberá os pontos.
 * @param {string} action - Ação que gerou os pontos (ex: 'reconhecimento_enviado').
 * @param {number} points - Quantidade de pontos a serem adicionados.
 * @returns {Promise<object>} - Objeto com o resultado da operação.
 */
async function addPointsToUser(pool, userId, action, points) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const alreadyEarnedResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('action', sql.VarChar, action)
            .input('today', sql.Date, today)
            .query(`SELECT COUNT(*) as count FROM Gamification WHERE UserId = @userId AND Action = @action AND CAST(CreatedAt AS DATE) = @today`);

        if (alreadyEarnedResult.recordset[0].count > 0) {
            return { success: false, points: 0, message: 'Pontos para esta ação já concedidos hoje.' };
        }

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('action', sql.VarChar, action)
            .input('points', sql.Int, points)
            .query(`INSERT INTO Gamification (UserId, Action, Points) VALUES (@userId, @action, @points)`);

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('points', sql.Int, points)
            .query(`
                IF EXISTS (SELECT 1 FROM UserPoints WHERE UserId = @userId)
                    UPDATE UserPoints SET TotalPoints = TotalPoints + @points WHERE UserId = @userId
                ELSE
                    INSERT INTO UserPoints (UserId, TotalPoints) VALUES (@userId, @points)
            `);

        return { success: true, points, message: `+${points} pontos!` };
    } catch (err) {
        console.error(`Erro ao adicionar pontos para '${action}':`, err);
        return { success: false, points: 0, message: 'Erro ao adicionar pontos.' };
    }
}

// =================================================================
// CONTROLLERS (Funções exportadas para as rotas)
// =================================================================

/**
 * POST /api/recognitions - Cria um novo reconhecimento.
 */
exports.createRecognition = async (req, res) => {
    try {
        const { to_user_id, badge, message } = req.body;
        const from_user_id = req.session.user.userId;

        if (!to_user_id || !badge || !message) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        const points = 5; // Valor fixo para reconhecimentos
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('from_user_id', sql.Int, from_user_id)
            .input('to_user_id', sql.Int, to_user_id)
            .input('badge', sql.VarChar, badge)
            .input('message', sql.NText, message)
            .input('points', sql.Int, points)
            .query(`
                INSERT INTO Recognitions (from_user_id, to_user_id, badge, message, points, created_at)
                OUTPUT INSERTED.Id
                VALUES (@from_user_id, @to_user_id, @badge, @message, @points, GETDATE())
            `);

        // Adicionar pontos para quem enviou e para quem recebeu
        const pointsResultSent = await addPointsToUser(pool, from_user_id, 'reconhecimento_enviado', 5);
        const pointsResultReceived = await addPointsToUser(pool, to_user_id, 'reconhecimento_recebido', 5);

        // Criar notificação para quem recebeu
        const userResult = await pool.request().input('userId', sql.Int, from_user_id).query('SELECT NomeCompleto FROM Users WHERE Id = @userId');
        const fromName = userResult.recordset[0]?.NomeCompleto || 'Alguém';
        await createNotification(to_user_id, 'recognition_received', `${fromName} reconheceu você com o badge "${badge}"`, result.recordset[0].Id);

        // Enviar email de notificação para quem recebeu
        try {
            const toUserResult = await pool.request().input('userId', sql.Int, to_user_id).query('SELECT NomeCompleto, Email FROM Users WHERE Id = @userId');
            const toUser = toUserResult.recordset[0];
            
            if (toUser && toUser.Email) {
                await emailService.sendRecognitionNotificationEmail(
                    toUser.Email,
                    toUser.NomeCompleto,
                    fromName,
                    badge
                ).catch(err => console.error('⚠️ Erro ao enviar email de notificação de reconhecimento:', err.message));
            } else {
                console.log('⚠️ Usuário sem email cadastrado, notificação de reconhecimento não enviada por email');
            }
        } catch (emailError) {
            console.error('⚠️ Falha ao enviar email de notificação (não crítico):', emailError.message);
        }

        res.status(201).json({
            success: true,
            id: result.recordset[0].Id,
            pointsSent: pointsResultSent,
            pointsReceived: pointsResultReceived
        });
    } catch (error) {
        console.error('Erro ao criar reconhecimento:', error);
        res.status(500).json({ error: 'Erro ao criar reconhecimento.' });
    }
};

/**
 * GET /api/recognitions/received - Lista os reconhecimentos recebidos pelo usuário logado.
 * Esta rota substitui a antiga GET /api/recognitions.
 */
exports.getReceivedRecognitions = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name
                FROM Recognitions r
                JOIN Users u1 ON r.from_user_id = u1.Id
                JOIN Users u2 ON r.to_user_id = u2.Id
                WHERE r.to_user_id = @userId
                ORDER BY r.created_at DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar reconhecimentos recebidos:', error);
        res.status(500).json({ error: 'Erro ao buscar reconhecimentos recebidos.' });
    }
};

/**
 * GET /api/recognitions/given - Lista os reconhecimentos enviados pelo usuário logado.
 */
exports.getGivenRecognitions = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name
                FROM Recognitions r
                JOIN Users u1 ON r.from_user_id = u1.Id
                JOIN Users u2 ON r.to_user_id = u2.Id
                WHERE r.from_user_id = @userId
                ORDER BY r.created_at DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar reconhecimentos enviados:', error);
        res.status(500).json({ error: 'Erro ao buscar reconhecimentos enviados.' });
    }
};

/**
 * GET /api/recognitions/all - Lista todos os reconhecimentos (enviados e recebidos) do usuário.
 */
exports.getAllRecognitions = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const { dateStart, dateEnd, badge } = req.query;
        const pool = await getDatabasePool();

        let dateFilter = '';
        if (dateStart && dateEnd) {
            dateFilter = ` AND CAST(r.created_at AS DATE) BETWEEN '${dateStart}' AND '${dateEnd}'`;
        } else if (dateStart) {
            dateFilter = ` AND CAST(r.created_at AS DATE) >= '${dateStart}'`;
        } else if (dateEnd) {
            dateFilter = ` AND CAST(r.created_at AS DATE) <= '${dateEnd}'`;
        }

        let badgeFilter = '';
        if (badge) {
            if (badge === 'Outros') {
                badgeFilter = ` AND r.badge NOT IN ('Inovador', 'Colaborativo', 'Dedicado', 'Criativo')`;
            } else {
                badgeFilter = ` AND r.badge = '${badge}'`;
            }
        }

        // Reconhecimentos recebidos
        const receivedResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name, 'received' as direction,
                       CASE WHEN EXISTS(SELECT 1 FROM Gamification WHERE UserId = @userId AND Action = 'reconhecimento_recebido' AND CAST(CreatedAt AS DATE) = CAST(r.created_at AS DATE)) THEN 1 ELSE 0 END as earned_points
                FROM Recognitions r
                JOIN Users u1 ON r.from_user_id = u1.Id
                JOIN Users u2 ON r.to_user_id = u2.Id
                WHERE r.to_user_id = @userId${dateFilter}${badgeFilter}
            `);

        // Reconhecimentos enviados
        const givenResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name, 'given' as direction,
                       CASE WHEN EXISTS(SELECT 1 FROM Gamification WHERE UserId = @userId AND Action = 'reconhecimento_enviado' AND CAST(CreatedAt AS DATE) = CAST(r.created_at AS DATE)) THEN 1 ELSE 0 END as earned_points
                FROM Recognitions r
                JOIN Users u1 ON r.from_user_id = u1.Id
                JOIN Users u2 ON r.to_user_id = u2.Id
                WHERE r.from_user_id = @userId${dateFilter}${badgeFilter}
            `);

        // Combina os resultados e ordena pela data de criação (mais recente primeiro)
        const allRecognitions = [
            ...receivedResult.recordset,
            ...givenResult.recordset
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(allRecognitions);
    } catch (error) {
        console.error('Erro ao buscar todos os reconhecimentos:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os reconhecimentos.' });
    }
};

/**
 * GET /api/gamification/points - Retorna os pontos do usuário.
 */
exports.getUserPoints = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ISNULL(TotalPoints, 0) as TotalPoints
                FROM UserPoints
                WHERE UserId = @userId
            `);

        res.json({ TotalPoints: result.recordset[0]?.TotalPoints || 0 });
    } catch (error) {
        console.error('Erro ao buscar pontos do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar pontos.' });
    }
};

/**
 * GET /api/gamification/leaderboard - Retorna o ranking de pontos.
 */
exports.getLeaderboard = async (req, res) => {
    try {
        const topUsers = parseInt(req.query.topUsers) || 10;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const leaderboardResult = await pool.request()
            .input('topUsers', sql.Int, topUsers)
            .query(`
                SELECT TOP (@topUsers) u.Id, u.NomeCompleto, u.DescricaoDepartamento, up.TotalPoints
                FROM UserPoints up
                JOIN Users u ON up.UserId = u.Id
                ORDER BY up.TotalPoints DESC
            `);

        const userRankingResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    (SELECT COUNT(*) + 1 FROM UserPoints WHERE TotalPoints > (SELECT ISNULL(TotalPoints, 0) FROM UserPoints WHERE UserId = @userId)) as position,
                    ISNULL((SELECT TotalPoints FROM UserPoints WHERE UserId = @userId), 0) as totalPoints,
                    CASE WHEN EXISTS (SELECT 1 FROM UserPoints WHERE UserId = @userId) THEN 1 ELSE 0 END as hasPoints
            `);

        res.json({
            leaderboard: leaderboardResult.recordset,
            userRanking: userRankingResult.recordset[0]
        });
    } catch (error) {
        console.error('Erro ao buscar leaderboard:', error);
        res.status(500).json({ error: 'Erro ao buscar leaderboard.' });
    }
};
