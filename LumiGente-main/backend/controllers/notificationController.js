const { getDatabasePool } = require('../config/db');

/**
 * Cria tabela de notificações se não existir
 */
async function ensureNotificationsTableExists() {
    try {
        const pool = await getDatabasePool();
        
        const [tableExists] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Notifications'
        `);
        
        if (tableExists[0].existe === 0) {
            await pool.execute(`
                CREATE TABLE Notifications (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    UserId INT NOT NULL,
                    Type VARCHAR(50) NOT NULL,
                    Message VARCHAR(500) NOT NULL,
                    RelatedId INT NULL,
                    IsRead TINYINT(1) DEFAULT 0,
                    CreatedAt DATETIME DEFAULT NOW(),
                    FOREIGN KEY (UserId) REFERENCES Users(Id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }
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
        await pool.execute(`
            INSERT INTO Notifications (UserId, Type, Message, RelatedId)
            VALUES (?, ?, ?, ?)
        `, [userId, type, message, relatedId]);
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

        const [result] = await pool.execute(`
            SELECT * FROM Notifications
            WHERE UserId = ? AND IsRead = 0
            ORDER BY CreatedAt DESC
            LIMIT 20
        `, [userId]);

        res.json(result);
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

        await pool.execute(`
            UPDATE Notifications
            SET IsRead = 1
            WHERE Id = ? AND UserId = ?
        `, [id, userId]);

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

        await pool.execute(`
            UPDATE Notifications
            SET IsRead = 1
            WHERE UserId = ? AND IsRead = 0
        `, [userId]);

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

        const [result] = await pool.execute(`
            SELECT COUNT(*) as count FROM Notifications
            WHERE UserId = ? AND IsRead = 0
        `, [userId]);

        res.json({ count: result[0].count });
    } catch (error) {
        console.error('Erro ao buscar contagem de notificações:', error);
        res.status(500).json({ error: 'Erro ao buscar contagem.' });
    }
};

module.exports.createNotification = createNotification;
module.exports.ensureNotificationsTableExists = ensureNotificationsTableExists;
