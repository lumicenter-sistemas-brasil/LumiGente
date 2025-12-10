const mysql = require('mysql2/promise');
const { getDatabasePool } = require('../config/db');

// =================================================================
// CONTROLLERS DE CHAT
// =================================================================

/**
 * POST /api/chat/setup-tables - Cria as tabelas de chat se não existirem
 */
async function setupTables(req, res) {
    try {
        const pool = await getDatabasePool();
        
        // Criar tabela de mensagens de chat se não existir
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ChatMessages (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                FeedbackId INT NOT NULL,
                UserId INT NOT NULL,
                Message TEXT NOT NULL,
                CreatedAt DATETIME DEFAULT NOW(),
                IsRead TINYINT(1) DEFAULT 0,
                FOREIGN KEY (FeedbackId) REFERENCES Feedbacks(Id),
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        // Criar tabela de status de leitura se não existir
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ChatReadStatus (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                FeedbackId INT NOT NULL,
                UserId INT NOT NULL,
                LastReadAt DATETIME DEFAULT NOW(),
                FOREIGN KEY (FeedbackId) REFERENCES Feedbacks(Id),
                FOREIGN KEY (UserId) REFERENCES Users(Id),
                UNIQUE KEY unique_feedback_user (FeedbackId, UserId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        res.json({ success: true, message: 'Tabelas de chat configuradas com sucesso' });
    } catch (error) {
        console.error('Erro ao configurar tabelas de chat:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * GET /api/chat/feedbacks/:feedbackId/messages - Obtém mensagens de um feedback
 */
async function getMessages(req, res) {
    try {
        const { feedbackId } = req.params;
        const userId = req.session.user.userId;
        
        const pool = await getDatabasePool();
        
        // Buscar mensagens do feedback
        const [messagesResult] = await pool.query(`
            SELECT 
                cm.Id,
                cm.Message,
                cm.CreatedAt,
                cm.IsRead,
                u.NomeCompleto as UserName,
                u.Matricula,
                CASE WHEN cm.UserId = ? THEN 1 ELSE 0 END as IsOwnMessage
            FROM ChatMessages cm
            INNER JOIN Users u ON cm.UserId = u.Id
            WHERE cm.FeedbackId = ?
            ORDER BY cm.CreatedAt ASC
        `, [userId, feedbackId]);
        
        // Marcar mensagens como lidas para o usuário atual
        await pool.query(`
            UPDATE ChatMessages 
            SET IsRead = 1 
            WHERE FeedbackId = ? AND UserId != ? AND IsRead = 0
        `, [feedbackId, userId]);
        
        res.json(messagesResult);
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * POST /api/chat/feedbacks/:feedbackId/messages - Envia uma nova mensagem
 */
async function sendMessage(req, res) {
    try {
        const { feedbackId } = req.params;
        const { message } = req.body;
        const userId = req.session.user.userId;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Mensagem não pode estar vazia' });
        }
        
        const pool = await getDatabasePool();
        
        // Inserir nova mensagem
        const [result] = await pool.query(`
            INSERT INTO ChatMessages (FeedbackId, UserId, Message)
            VALUES (?, ?, ?)
        `, [feedbackId, userId, message.trim()]);
        
        const newMessageId = result.insertId;
        
        // Buscar a mensagem inserida
        const [newMessageResult] = await pool.query(`
            SELECT Id, CreatedAt FROM ChatMessages WHERE Id = ?
        `, [newMessageId]);
        
        const newMessage = newMessageResult[0];
        
        // Buscar dados do usuário para retornar na resposta
        const [userResult] = await pool.query(`
            SELECT NomeCompleto as UserName, Matricula
            FROM Users
            WHERE Id = ?
        `, [userId]);
        
        const user = userResult[0];
        
        res.json({
            Id: newMessage.Id,
            Message: message.trim(),
            CreatedAt: newMessage.CreatedAt,
            IsRead: false,
            UserName: user.UserName,
            Matricula: user.Matricula,
            IsOwnMessage: true
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * PUT /api/chat/feedbacks/:feedbackId/messages/read - Marca mensagens como lidas
 */
async function markAsRead(req, res) {
    try {
        const { feedbackId } = req.params;
        const userId = req.session.user.userId;
        
        const pool = await getDatabasePool();
        
        // Marcar mensagens como lidas
        await pool.query(`
            UPDATE ChatMessages 
            SET IsRead = 1 
            WHERE FeedbackId = ? AND UserId != ? AND IsRead = 0
        `, [feedbackId, userId]);
        
        // Atualizar status de leitura usando INSERT ... ON DUPLICATE KEY UPDATE
        await pool.query(`
            INSERT INTO ChatReadStatus (FeedbackId, UserId, LastReadAt)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE LastReadAt = NOW()
        `, [feedbackId, userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

module.exports = {
    setupTables,
    getMessages,
    sendMessage,
    markAsRead
};
