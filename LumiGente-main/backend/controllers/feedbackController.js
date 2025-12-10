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
            return { success: false, message: 'Você já ganhou pontos por esta ação hoje' };
        }

        await pool.execute(
            `INSERT INTO Gamification (UserId, Action, Points, CreatedAt) VALUES (?, ?, ?, NOW())`,
            [userId, action, points]
        );

        const [existsCheck] = await pool.execute(`SELECT 1 FROM UserPoints WHERE UserId = ?`, [userId]);
        if (existsCheck.length > 0) {
            await pool.execute(`UPDATE UserPoints SET TotalPoints = TotalPoints + ?, LastUpdated = NOW() WHERE UserId = ?`, [points, userId]);
        } else {
            await pool.execute(`INSERT INTO UserPoints (UserId, TotalPoints, LastUpdated) VALUES (?, ?, NOW())`, [userId, points]);
        }

        return { success: true, points: points, message: `+${points} pontos por ${action.replace('_', ' ')}!` };
    } catch (error) {
        console.error(`Erro ao adicionar pontos para a ação '${action}':`, error);
        return { success: false, message: 'Erro ao adicionar pontos' };
    }
}


// =================================================================
// CONTROLLERS (Funções exportadas para as rotas)
// =================================================================

/**
 * GET /api/feedbacks/received - Lista os feedbacks recebidos pelo usuário logado.
 */
exports.getReceivedFeedbacks = async (req, res) => {
    try {
        const { search, type, category, dateStart, dateEnd } = req.query;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        let query = `
            SELECT f.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name,
                   (SELECT COUNT(*) FROM FeedbackReplies fr WHERE fr.feedback_id = f.Id) as replies_count,
                   (SELECT COUNT(*) FROM FeedbackReactions WHERE feedback_id = f.Id AND reaction_type = 'viewed' AND user_id = ?) as viewed,
                   (SELECT COUNT(*) FROM FeedbackReactions WHERE feedback_id = f.Id AND reaction_type = 'useful') as useful_count,
                   CASE WHEN EXISTS(SELECT 1 FROM FeedbackReactions WHERE feedback_id = f.Id AND user_id = ? AND reaction_type = 'useful') THEN 1 ELSE 0 END as user_reacted,
                   CASE WHEN EXISTS(SELECT 1 FROM FeedbackReactions WHERE feedback_id = f.Id AND reaction_type != 'viewed') THEN 1 ELSE 0 END as has_reactions
            FROM Feedbacks f
            JOIN Users u1 ON f.from_user_id = u1.Id
            JOIN Users u2 ON f.to_user_id = u2.Id
            WHERE f.to_user_id = ?
        `;

        const params = [userId, userId, userId];

        if (search) {
            query += " AND (f.message LIKE ? OR u1.NomeCompleto LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (type) {
            query += " AND f.type = ?";
            params.push(type);
        }
        if (category) {
            query += " AND f.category = ?";
            params.push(category);
        }
        if (dateStart) {
            query += " AND CAST(f.created_at AS DATE) >= ?";
            params.push(dateStart);
        }
        if (dateEnd) {
            query += " AND CAST(f.created_at AS DATE) <= ?";
            params.push(dateEnd);
        }

        query += " ORDER BY f.created_at DESC";

        const [result] = await pool.execute(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar feedbacks recebidos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/feedbacks/sent - Lista os feedbacks enviados pelo usuário logado.
 */
exports.getSentFeedbacks = async (req, res) => {
    try {
        const { search, type, category, dateStart, dateEnd } = req.query;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        let query = `
            SELECT f.*, u1.NomeCompleto as from_name, u2.NomeCompleto as to_name,
                   (SELECT COUNT(*) FROM FeedbackReplies fr WHERE fr.feedback_id = f.Id) as replies_count,
                   (SELECT COUNT(*) FROM FeedbackReactions WHERE feedback_id = f.Id AND reaction_type = 'useful') as useful_count,
                   CASE WHEN EXISTS(SELECT 1 FROM FeedbackReactions WHERE feedback_id = f.Id AND reaction_type = 'viewed' AND user_id = f.to_user_id) THEN 1 ELSE 0 END as has_reactions,
                   CASE WHEN f.Id = (
                       SELECT f2.Id 
                       FROM Feedbacks f2 
                       WHERE f2.from_user_id = ? 
                       AND CAST(f2.created_at AS DATE) = CAST(f.created_at AS DATE)
                       ORDER BY f2.created_at ASC
                       LIMIT 1
                   ) AND EXISTS(
                       SELECT 1 FROM Gamification g 
                       WHERE g.UserId = ? 
                       AND g.Action = 'feedback_enviado' 
                       AND CAST(g.CreatedAt AS DATE) = CAST(f.created_at AS DATE)
                   ) THEN 1 ELSE 0 END as earned_points
            FROM Feedbacks f
            JOIN Users u1 ON f.from_user_id = u1.Id
            JOIN Users u2 ON f.to_user_id = u2.Id
            WHERE f.from_user_id = ?
        `;
        
        const params = [userId, userId, userId];
        
        if (search) {
            query += " AND (f.message LIKE ? OR u2.NomeCompleto LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (type) {
            query += " AND f.type = ?";
            params.push(type);
        }
        if (category) {
            query += " AND f.category = ?";
            params.push(category);
        }
        if (dateStart) {
            query += " AND CAST(f.created_at AS DATE) >= ?";
            params.push(dateStart);
        }
        if (dateEnd) {
            query += " AND CAST(f.created_at AS DATE) <= ?";
            params.push(dateEnd);
        }

        query += " ORDER BY f.created_at DESC";
        
        const [result] = await pool.execute(query, params);
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar feedbacks enviados:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * POST /api/feedbacks - Cria um novo feedback.
 */
exports.createFeedback = async (req, res) => {
    try {
        const { to_user_id, type, category, message } = req.body;
        const from_user_id = req.session.user.userId;

        if (!to_user_id || !type || !category || !message) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const pool = await getDatabasePool();
        const [result] = await pool.execute(`
            INSERT INTO Feedbacks (from_user_id, to_user_id, type, category, message, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [from_user_id, to_user_id, type, category, message]);

        const feedbackId = result.insertId;

        const pointsResult = await addPointsToUser(pool, from_user_id, 'feedback_enviado', 10);

        // Criar notificação para quem recebeu
        const [userResult] = await pool.execute('SELECT NomeCompleto FROM Users WHERE Id = ?', [from_user_id]);
        const fromName = userResult[0]?.NomeCompleto || 'Alguém';
        await createNotification(to_user_id, 'feedback_received', `${fromName} enviou um feedback para você`, feedbackId);

        // Enviar email de notificação para quem recebeu
        try {
            const [toUserResult] = await pool.execute('SELECT NomeCompleto, Email FROM Users WHERE Id = ?', [to_user_id]);
            const toUser = toUserResult[0];
            
            if (toUser && toUser.Email) {
                await emailService.sendFeedbackNotificationEmail(
                    toUser.Email,
                    toUser.NomeCompleto,
                    fromName,
                    type,
                    category
                ).catch(err => console.error('⚠️ Erro ao enviar email de notificação de feedback:', err.message));
            }
        } catch (emailError) {
            console.error('⚠️ Falha ao enviar email de notificação (não crítico):', emailError.message);
        }

        res.status(201).json({ 
            success: true, 
            id: feedbackId,
            ...pointsResult
        });
    } catch (error) {
        console.error('Erro ao criar feedback:', error);
        res.status(500).json({ error: 'Erro ao criar feedback' });
    }
};

/**
 * GET /api/feedbacks/:id/info - Busca informações básicas de um feedback para o chat.
 */
exports.getFeedbackInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        const [result] = await pool.execute(`
            SELECT f.type, f.category, f.message, f.created_at, f.from_user_id, f.to_user_id,
                   u1.NomeCompleto as from_name, u2.NomeCompleto as to_name
            FROM Feedbacks f
            JOIN Users u1 ON f.from_user_id = u1.Id
            JOIN Users u2 ON f.to_user_id = u2.Id
            WHERE f.Id = ?
        `, [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Feedback não encontrado' });
        }
        
        res.json(result[0]);
    } catch (error) {
        console.error('Erro ao buscar info do feedback:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/feedbacks/:id/messages - Busca todas as mensagens (chat) de um feedback.
 */
exports.getFeedbackMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        // Marcar feedback como visualizado
        const [existsCheck] = await pool.execute(
            `SELECT 1 FROM FeedbackReactions WHERE feedback_id = ? AND user_id = ? AND reaction_type = 'viewed'`,
            [id, userId]
        );
        if (existsCheck.length === 0) {
            await pool.execute(
                `INSERT INTO FeedbackReactions (feedback_id, user_id, reaction_type) VALUES (?, ?, 'viewed')`,
                [id, userId]
            );
        }

        const [result] = await pool.execute(`
            SELECT fr.Id, fr.user_id, fr.reply_text as message, fr.created_at, 
                   u.NomeCompleto as user_name, u.nome as user_first_name,
                   fr.reply_to_id, fr.reply_to_message, fr.reply_to_user
            FROM FeedbackReplies fr
            JOIN Users u ON fr.user_id = u.Id
            WHERE fr.feedback_id = ?
            ORDER BY fr.created_at ASC
        `, [id]);

        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar mensagens do chat:', error);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
};

/**
 * POST /api/feedbacks/:id/messages - Envia uma nova mensagem no chat de um feedback.
 */
exports.postFeedbackMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, reply_to } = req.body;
        const userId = req.session.user.userId;

        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'A mensagem não pode estar vazia' });
        }

        const pool = await getDatabasePool();
        
        // Buscar informações da mensagem que está sendo respondida (se houver)
        let replyToMessage = null;
        let replyToUser = null;
        
        if (reply_to) {
            const [replyInfoResult] = await pool.execute(`
                SELECT fr.reply_text, u.NomeCompleto as user_name
                FROM FeedbackReplies fr
                JOIN Users u ON fr.user_id = u.Id
                WHERE fr.Id = ?
            `, [reply_to]);
            
            if (replyInfoResult.length > 0) {
                replyToMessage = replyInfoResult[0].reply_text;
                replyToUser = replyInfoResult[0].user_name;
            }
        }
        
        // Inserir a nova mensagem
        const [result] = await pool.execute(`
            INSERT INTO FeedbackReplies (feedback_id, user_id, reply_text, reply_to_id, reply_to_message, reply_to_user, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [id, userId, message.trim(), reply_to || null, replyToMessage || null, replyToUser || null]);

        const newMessageId = result.insertId;

        // Buscar a mensagem completa com o nome do usuário para retornar ao front-end
        const [fullMessageResult] = await pool.execute(`
            SELECT fr.Id, fr.user_id, fr.reply_text as message, fr.created_at, u.NomeCompleto as user_name, u.nome as user_first_name
            FROM FeedbackReplies fr
            JOIN Users u ON fr.user_id = u.Id
            WHERE fr.Id = ?
        `, [newMessageId]);

        // Gamificação e notificação
        const [feedbackInfo] = await pool.execute('SELECT from_user_id, to_user_id FROM Feedbacks WHERE Id = ?', [id]);
        let pointsResult = {};
        if (feedbackInfo[0]?.to_user_id === userId) {
            pointsResult = await addPointsToUser(pool, userId, 'feedback_respondido', 10);
            // Notificar quem enviou o feedback original
            const [userResult] = await pool.execute('SELECT NomeCompleto FROM Users WHERE Id = ?', [userId]);
            const userName = userResult[0]?.NomeCompleto || 'Alguém';
            await createNotification(feedbackInfo[0].from_user_id, 'feedback_reply', `${userName} respondeu ao seu feedback`, id);
        }
        
        res.status(201).json({
            success: true,
            message: fullMessageResult[0],
            ...pointsResult
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
};

/**
 * POST /api/feedbacks/messages/:messageId/react - Adiciona ou remove uma reação a uma mensagem do chat.
 */
exports.reactToMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.session.user.userId;

        if (!emoji) {
            return res.status(400).json({ error: 'Emoji é obrigatório' });
        }

        const pool = await getDatabasePool();
        
        const [existingReaction] = await pool.execute(
            `SELECT Id FROM FeedbackReplyReactions WHERE reply_id = ? AND user_id = ? AND emoji = ?`,
            [messageId, userId, emoji]
        );

        if (existingReaction.length > 0) {
            // Remove a reação
            await pool.execute(`DELETE FROM FeedbackReplyReactions WHERE Id = ?`, [existingReaction[0].Id]);
            res.json({ success: true, action: 'removed', emoji });
        } else {
            // Adiciona a reação
            await pool.execute(
                `INSERT INTO FeedbackReplyReactions (reply_id, user_id, emoji) VALUES (?, ?, ?)`,
                [messageId, userId, emoji]
            );
            res.json({ success: true, action: 'added', emoji });
        }
    } catch (error) {
        console.error('Erro ao reagir à mensagem:', error);
        res.status(500).json({ error: 'Erro ao reagir à mensagem' });
    }
};

/**
 * POST /api/feedbacks/:id/react - Adiciona ou remove uma reação a um feedback.
 */
exports.reactToFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { reaction } = req.body;
        const userId = req.session.user.userId;

        if (!reaction) {
            return res.status(400).json({ error: 'Tipo de reação é obrigatório' });
        }

        const pool = await getDatabasePool();
        
        // Verificar se já existe uma reação do usuário para este feedback
        const [existingReaction] = await pool.execute(
            `SELECT Id FROM FeedbackReactions WHERE feedback_id = ? AND user_id = ? AND reaction_type = ?`,
            [id, userId, reaction]
        );

        if (existingReaction.length > 0) {
            // Remove a reação
            await pool.execute(`DELETE FROM FeedbackReactions WHERE Id = ?`, [existingReaction[0].Id]);
            res.json({ success: true, action: 'removed', reaction });
        } else {
            // Adiciona a reação
            await pool.execute(
                `INSERT INTO FeedbackReactions (feedback_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, NOW())`,
                [id, userId, reaction]
            );
            
            // Notificar se for reação útil
            if (reaction === 'useful') {
                const [feedbackInfo] = await pool.execute('SELECT from_user_id FROM Feedbacks WHERE Id = ?', [id]);
                const [userResult] = await pool.execute('SELECT NomeCompleto FROM Users WHERE Id = ?', [userId]);
                const userName = userResult[0]?.NomeCompleto || 'Alguém';
                await createNotification(feedbackInfo[0].from_user_id, 'feedback_useful', `${userName} marcou seu feedback como útil`, id);
            }
            
            res.json({ success: true, action: 'added', reaction });
        }
    } catch (error) {
        console.error('Erro ao reagir ao feedback:', error);
        res.status(500).json({ error: 'Erro ao reagir ao feedback' });
    }
};

/**
 * GET /api/filters - Retorna os tipos e categorias de feedback existentes para usar em filtros.
 */
exports.getFeedbackFilters = async (req, res) => {
    try {
        const pool = await getDatabasePool();

        const [typesResult] = await pool.execute(`SELECT DISTINCT type FROM Feedbacks WHERE type IS NOT NULL ORDER BY type`);
        const [categoriesResult] = await pool.execute(`SELECT DISTINCT category FROM Feedbacks WHERE category IS NOT NULL ORDER BY category`);

        res.json({
            types: typesResult.map(r => r.type),
            categories: categoriesResult.map(r => r.category)
        });
    } catch (error) {
        console.error('Erro ao buscar filtros de feedback:', error);
        res.status(500).json({ error: 'Erro ao buscar filtros' });
    }
};

/**
 * GET /api/metrics - Retorna métricas de feedbacks do usuário.
 */
exports.getMetrics = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const [result] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM Feedbacks WHERE to_user_id = ?) as feedbacksReceived,
                (SELECT COUNT(*) FROM Feedbacks WHERE from_user_id = ?) as feedbacksSent,
                (SELECT COUNT(*) FROM Recognitions WHERE to_user_id = ?) as recognitionsReceived,
                CAST(IFNULL((SELECT AVG(CAST(rating AS DECIMAL(10,2))) FROM Feedbacks WHERE to_user_id = ? AND rating IS NOT NULL), 0) AS DECIMAL(3,1)) as avgScore
        `, [userId, userId, userId, userId]);

        res.json(result[0] || { feedbacksReceived: 0, feedbacksSent: 0, recognitionsReceived: 0, avgScore: 0 });
    } catch (error) {
        console.error('Erro ao buscar métricas:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas' });
    }
};
