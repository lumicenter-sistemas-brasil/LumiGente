const sql = require('mssql');
const { getDatabasePool } = require('../config/db');

/**
 * Cria tabela de notificações se não existir
 */
async function ensureNotificationsTableExists() {
    try {
        const pool = await getDatabasePool();
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notifications' AND xtype='U')
            CREATE TABLE Notifications (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                UserId INT NOT NULL,
                Type VARCHAR(50) NOT NULL,
                Message NVARCHAR(500) NOT NULL,
                RelatedId INT NULL,
                IsRead BIT DEFAULT 0,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            )
        `);
    } catch (error) {
        console.error('Erro ao criar tabela Notifications:', error);
    }
}

/**
 * Cria uma notificação
 */
async function createNotification(userId, type, message, relatedId = null) {
    try {
        const pool = await getDatabasePool();
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('type', sql.VarChar, type)
            .input('message', sql.NVarChar, message)
            .input('relatedId', sql.Int, relatedId)
            .query(`
                INSERT INTO Notifications (UserId, Type, Message, RelatedId)
                VALUES (@userId, @type, @message, @relatedId)
            `);
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
    }
}

/**
 * GET /api/notifications - Lista notificações do usuário
 */
exports.getNotifications = async (req, res) => {
    try {
        await ensureNotificationsTableExists();
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT TOP 20 * FROM Notifications
                WHERE UserId = @userId AND IsRead = 0
                ORDER BY CreatedAt DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ error: 'Erro ao buscar notificações.' });
    }
};

/**
 * PUT /api/notifications/:id/read - Marca notificação como lida
 */
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Notifications
                SET IsRead = 1
                WHERE Id = @id AND UserId = @userId
            `);

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ error: 'Erro ao marcar notificação como lida.' });
    }
};

/**
 * PUT /api/notifications/read-all - Marca todas as notificações como lidas
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Notifications
                SET IsRead = 1
                WHERE UserId = @userId AND IsRead = 0
            `);

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar todas como lidas:', error);
        res.status(500).json({ error: 'Erro ao marcar todas como lidas.' });
    }
};

/**
 * GET /api/notifications/count - Retorna contagem de notificações não lidas
 */
exports.getUnreadCount = async (req, res) => {
    try {
        await ensureNotificationsTableExists();
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as count FROM Notifications
                WHERE UserId = @userId AND IsRead = 0
            `);

        res.json({ count: result.recordset[0].count });
    } catch (error) {
        console.error('Erro ao buscar contagem de notificações:', error);
        res.status(500).json({ error: 'Erro ao buscar contagem.' });
    }
};

module.exports.createNotification = createNotification;
module.exports.ensureNotificationsTableExists = ensureNotificationsTableExists;
