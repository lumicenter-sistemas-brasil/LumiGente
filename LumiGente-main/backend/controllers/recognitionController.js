const { getDatabasePool } = require('../config/db');
const { createNotification } = require('./notificationController');
const emailService = require('../services/emailService');

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

        const [existsCheck] = await pool.execute(`SELECT 1 FROM UserPoints WHERE UserId = ?`, [userId]);
        if (existsCheck.length > 0) {
            await pool.execute(`UPDATE UserPoints SET TotalPoints = TotalPoints + ? WHERE UserId = ?`, [points, userId]);
        } else {
            await pool.execute(`INSERT INTO UserPoints (UserId, TotalPoints) VALUES (?, ?)`, [userId, points]);
        }

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

        const points = 5;
        const pool = await getDatabasePool();

        const [result] = await pool.execute(`
            INSERT INTO Recognitions (from_user_id, to_user_id, badge, message, points, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [from_user_id, to_user_id, badge, message, points]);

        const recognitionId = result.insertId;

        // Adicionar pontos para quem enviou e para quem recebeu
        const pointsResultSent = await addPointsToUser(pool, from_user_id, 'reconhecimento_enviado', 5);
        const pointsResultReceived = await addPointsToUser(pool, to_user_id, 'reconhecimento_recebido', 10);

        // Criar notificação para quem recebeu
        const [userResult] = await pool.execute('SELECT NomeCompleto FROM Users WHERE Id = ?', [from_user_id]);
        const fromName = userResult[0]?.NomeCompleto || 'Alguém';
        await createNotification(to_user_id, 'recognition_received', `${fromName} reconheceu você com o badge "${badge}"`, recognitionId);

        // Enviar email de notificação para quem recebeu
        try {
            const [toUserResult] = await pool.execute('SELECT NomeCompleto, Email FROM Users WHERE Id = ?', [to_user_id]);
            const toUser = toUserResult[0];

            if (toUser && toUser.Email) {
                await emailService.sendRecognitionNotificationEmail(
                    toUser.Email,
                    toUser.NomeCompleto,
                    fromName,
                    badge
                ).catch(err => console.error('⚠️ Erro ao enviar email de notificação de reconhecimento:', err.message));
            }
        } catch (emailError) {
            console.error('⚠️ Falha ao enviar email de notificação (não crítico):', emailError.message);
        }

        res.status(201).json({
            success: true,
            id: recognitionId,
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
 */
exports.getReceivedRecognitions = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const [result] = await pool.execute(`
            SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name,
                   CASE WHEN r.Id = (
                       SELECT Id FROM Recognitions r2 
                       WHERE CAST(r2.created_at AS DATE) = CAST(r.created_at AS DATE) 
                       AND r2.to_user_id = ? 
                       ORDER BY r2.created_at ASC
                       LIMIT 1
                   ) THEN 1 ELSE 0 END as show_points
            FROM Recognitions r
            JOIN Users u1 ON r.from_user_id = u1.Id
            JOIN Users u2 ON r.to_user_id = u2.Id
            WHERE r.to_user_id = ?
            ORDER BY r.created_at DESC
        `, [userId, userId]);

        res.json(result);
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

        const [result] = await pool.execute(`
            SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name,
                   CASE WHEN r.Id = (
                       SELECT Id FROM Recognitions r2 
                       WHERE CAST(r2.created_at AS DATE) = CAST(r.created_at AS DATE) 
                       AND r2.from_user_id = ? 
                       ORDER BY r2.created_at ASC
                       LIMIT 1
                   ) THEN 1 ELSE 0 END as show_points
            FROM Recognitions r
            JOIN Users u1 ON r.from_user_id = u1.Id
            JOIN Users u2 ON r.to_user_id = u2.Id
            WHERE r.from_user_id = ?
            ORDER BY r.created_at DESC
        `, [userId, userId]);

        res.json(result);
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
        const params = [userId, userId];
        
        if (dateStart && dateEnd) {
            dateFilter = ` AND CAST(r.created_at AS DATE) BETWEEN ? AND ?`;
            params.push(dateStart, dateEnd);
        } else if (dateStart) {
            dateFilter = ` AND CAST(r.created_at AS DATE) >= ?`;
            params.push(dateStart);
        } else if (dateEnd) {
            dateFilter = ` AND CAST(r.created_at AS DATE) <= ?`;
            params.push(dateEnd);
        }

        let badgeFilter = '';
        if (badge) {
            if (badge === 'Outros') {
                badgeFilter = ` AND r.badge NOT IN ('Inovador', 'Colaborativo', 'Dedicado', 'Criativo')`;
            } else {
                badgeFilter = ` AND r.badge = ?`;
                params.push(badge);
            }
        }

        // Reconhecimentos recebidos
        const [receivedResult] = await pool.execute(`
            SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name, 'received' as direction,
                   CASE WHEN r.Id = (
                       SELECT Id FROM Recognitions r2 
                       WHERE CAST(r2.created_at AS DATE) = CAST(r.created_at AS DATE) 
                       AND r2.to_user_id = ? 
                       ORDER BY r2.created_at ASC
                       LIMIT 1
                   ) THEN 1 ELSE 0 END as show_points
            FROM Recognitions r
            JOIN Users u1 ON r.from_user_id = u1.Id
            JOIN Users u2 ON r.to_user_id = u2.Id
            WHERE r.to_user_id = ?${dateFilter}${badgeFilter}
        `, params);

        // Reconhecimentos enviados (refazer params)
        const paramsGiven = [userId, userId];
        if (dateStart && dateEnd) {
            paramsGiven.push(dateStart, dateEnd);
        } else if (dateStart) {
            paramsGiven.push(dateStart);
        } else if (dateEnd) {
            paramsGiven.push(dateEnd);
        }
        if (badge && badge !== 'Outros') {
            paramsGiven.push(badge);
        }

        const [givenResult] = await pool.execute(`
            SELECT r.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name, 'given' as direction,
                   CASE WHEN r.Id = (
                       SELECT Id FROM Recognitions r2 
                       WHERE CAST(r2.created_at AS DATE) = CAST(r.created_at AS DATE) 
                       AND r2.from_user_id = ? 
                       ORDER BY r2.created_at ASC
                       LIMIT 1
                   ) THEN 1 ELSE 0 END as show_points
            FROM Recognitions r
            JOIN Users u1 ON r.from_user_id = u1.Id
            JOIN Users u2 ON r.to_user_id = u2.Id
            WHERE r.from_user_id = ?${dateFilter}${badgeFilter}
        `, paramsGiven);

        // Combina os resultados e ordena pela data de criação (mais recente primeiro)
        const allRecognitions = [
            ...receivedResult,
            ...givenResult
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

        const [result] = await pool.execute(`
            SELECT IFNULL(TotalPoints, 0) as TotalPoints
            FROM UserPoints
            WHERE UserId = ?
        `, [userId]);

        res.json({ TotalPoints: result[0]?.TotalPoints || 0 });
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

        const [leaderboardResult] = await pool.query(`
            SELECT u.Id, u.NomeCompleto, u.DescricaoDepartamento, up.TotalPoints
            FROM UserPoints up
            JOIN Users u ON up.UserId = u.Id
            ORDER BY up.TotalPoints DESC
            LIMIT ?
        `, [topUsers]);

        const [userRankingResult] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) + 1 FROM UserPoints WHERE TotalPoints > (SELECT IFNULL(TotalPoints, 0) FROM UserPoints WHERE UserId = ?)) as position,
                IFNULL((SELECT TotalPoints FROM UserPoints WHERE UserId = ?), 0) as totalPoints,
                CASE WHEN EXISTS (SELECT 1 FROM UserPoints WHERE UserId = ?) THEN 1 ELSE 0 END as hasPoints
        `, [userId, userId, userId]);

        res.json({
            leaderboard: leaderboardResult,
            userRanking: userRankingResult[0]
        });
    } catch (error) {
        console.error('Erro ao buscar leaderboard:', error);
        res.status(500).json({ error: 'Erro ao buscar leaderboard.' });
    }
};
