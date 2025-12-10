const express = require('express');
const router = express.Router();
const { getDatabasePool } = require('../config/db');

/**
 * Endpoint para verificar a saúde do sistema
 */
router.get('/health', async (req, res) => {
    try {
        const pool = await getDatabasePool();
        
        // Testa conexão MySQL
        const [rows] = await pool.execute('SELECT 1 as test');
        
        const healthStatus = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            services: {
                mysql: {
                    status: 'connected',
                    message: 'MySQL conectado'
                }
            }
        };
        
        res.json(healthStatus);
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            message: error.message,
            services: {
                mysql: {
                    status: 'error',
                    message: error.message
                }
            }
        });
    }
});

/**
 * Endpoint para verificar status do banco
 */
router.get('/db-status', async (req, res) => {
    try {
        const pool = await getDatabasePool();
        
        // Verificar conexão e obter algumas estatísticas básicas
        const [dbInfo] = await pool.execute('SELECT VERSION() as version, DATABASE() as current_db');
        
        res.json({
            timestamp: new Date().toISOString(),
            database: {
                status: 'connected',
                version: dbInfo[0].version,
                currentDatabase: dbInfo[0].current_db
            }
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;
