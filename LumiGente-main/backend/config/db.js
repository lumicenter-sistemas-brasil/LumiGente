const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    // Configurações de charset para suportar caracteres especiais (acentos, emojis)
    charset: 'utf8mb4'
};

let pool;

/**
 * Obtém o pool de conexões do MySQL.
 * Equivalente ao getDatabasePool() do SQL Server.
 * @returns {Promise<mysql.Pool>}
 */
async function getDatabasePool() {
    if (pool) {
        return pool;
    }
    try {
        pool = mysql.createPool(dbConfig);
        
        // Testar a conexão
        const connection = await pool.getConnection();
        console.log('[DB] Conectado ao MySQL');
        connection.release();
        
        return pool;
    } catch (error) {
        console.error('❌ Erro ao conectar ao MySQL:', error);
        process.exit(1);
    }
}

/**
 * Fecha o pool de conexões.
 * Útil para testes e shutdown graceful.
 */
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[DB] Pool de conexões MySQL encerrado');
    }
}

module.exports = { getDatabasePool, closePool };
