const sql = require('mssql');
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
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatMessages' AND xtype='U')
            CREATE TABLE ChatMessages (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                FeedbackId INT NOT NULL,
                UserId INT NOT NULL,
                Message TEXT NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                IsRead BIT DEFAULT 0,
                FOREIGN KEY (FeedbackId) REFERENCES Feedbacks(Id),
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            )
        `);
        
        // Criar tabela de status de leitura se não existir
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatReadStatus' AND xtype='U')
            CREATE TABLE ChatReadStatus (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                FeedbackId INT NOT NULL,
                UserId INT NOT NULL,
                LastReadAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (FeedbackId) REFERENCES Feedbacks(Id),
                FOREIGN KEY (UserId) REFERENCES Users(Id),
                UNIQUE(FeedbackId, UserId)
            )
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
        const messagesResult = await pool.request()
            .input('feedbackId', sql.Int, feedbackId)
            .query(`
                SELECT 
                    cm.Id,
                    cm.Message,
                    cm.CreatedAt,
                    cm.IsRead,
                    u.NomeCompleto as UserName,
                    u.Matricula,
                    CASE WHEN cm.UserId = @userId THEN 1 ELSE 0 END as IsOwnMessage
                FROM ChatMessages cm
                INNER JOIN Users u ON cm.UserId = u.Id
                WHERE cm.FeedbackId = @feedbackId
                ORDER BY cm.CreatedAt ASC
            `);
        
        // Marcar mensagens como lidas para o usuário atual
        await pool.request()
            .input('feedbackId', sql.Int, feedbackId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE ChatMessages 
                SET IsRead = 1 
                WHERE FeedbackId = @feedbackId AND UserId != @userId AND IsRead = 0
            `);
        
        res.json(messagesResult.recordset);
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
        const result = await pool.request()
            .input('feedbackId', sql.Int, feedbackId)
            .input('userId', sql.Int, userId)
            .input('message', sql.Text, message.trim())
            .query(`
                INSERT INTO ChatMessages (FeedbackId, UserId, Message)
                OUTPUT INSERTED.Id, INSERTED.CreatedAt
                VALUES (@feedbackId, @userId, @message)
            `);
        
        const newMessage = result.recordset[0];
        
        // Buscar dados do usuário para retornar na resposta
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT NomeCompleto as UserName, Matricula
                FROM Users
                WHERE Id = @userId
            `);
        
        const user = userResult.recordset[0];
        
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
        await pool.request()
            .input('feedbackId', sql.Int, feedbackId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE ChatMessages 
                SET IsRead = 1 
                WHERE FeedbackId = @feedbackId AND UserId != @userId AND IsRead = 0
            `);
        
        // Atualizar status de leitura
        await pool.request()
            .input('feedbackId', sql.Int, feedbackId)
            .input('userId', sql.Int, userId)
            .query(`
                IF EXISTS (SELECT 1 FROM ChatReadStatus WHERE FeedbackId = @feedbackId AND UserId = @userId)
                    UPDATE ChatReadStatus SET LastReadAt = GETDATE() WHERE FeedbackId = @feedbackId AND UserId = @userId
                ELSE
                    INSERT INTO ChatReadStatus (FeedbackId, UserId) VALUES (@feedbackId, @userId)
            `);
        
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
