const express = require('express');
const router = express.Router();
const { getDatabasePool } = require('../config/db');
const OracleConnectionHelper = require('../utils/oracleConnectionHelper');
const oracleMonitor = require('../services/oracleMonitor');

/**
 * Endpoint para verificar a saúde do sistema e conectividade Oracle
 */
router.get('/health', async (req, res) => {
    try {
        const pool = await getDatabasePool();
        
        // Testa conexão SQL Server local
        const sqlServerTest = await pool.request().query('SELECT 1 as test');
        
        // Testa conexão Oracle linked server e atualiza monitor
        const oracleTest = await oracleMonitor.checkOracleHealth();
        
        const healthStatus = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            services: {
                sqlServer: {
                    status: 'connected',
                    message: 'SQL Server conectado'
                },
                oracle: {
                    status: oracleTest.connected ? 'connected' : 'disconnected',
                    isDown: oracleTest.isDown,
                    consecutiveFailures: oracleTest.consecutiveFailures,
                    lastCheck: oracleTest.lastCheck,
                    message: oracleTest.error || 'Oracle linked server status'
                }
            }
        };
        
        // Se Oracle está desconectado, marca como degraded mas não como erro
        if (!oracleTest.connected) {
            healthStatus.status = 'degraded';
            healthStatus.message = 'Sistema funcionando com limitações (Oracle indisponível)';
        }
        
        res.json(healthStatus);
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            message: error.message,
            services: {
                sqlServer: {
                    status: 'error',
                    message: error.message
                },
                oracle: {
                    status: 'unknown',
                    message: 'Não foi possível testar devido a erro no SQL Server'
                }
            }
        });
    }
});

/**
 * Endpoint para forçar teste de conectividade Oracle
 */
router.post('/test-oracle', async (req, res) => {
    try {
        const result = await oracleMonitor.checkOracleHealth();
        
        res.json({
            timestamp: new Date().toISOString(),
            oracle: result
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * Endpoint para resetar o status do monitor Oracle
 */
router.post('/reset-oracle-status', async (req, res) => {
    try {
        oracleMonitor.resetStatus();
        
        res.json({
            timestamp: new Date().toISOString(),
            message: 'Status do Oracle monitor resetado com sucesso',
            status: oracleMonitor.getStatus()
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * Endpoint para obter status detalhado do Oracle
 */
router.get('/oracle-status', async (req, res) => {
    try {
        const status = oracleMonitor.getStatus();
        
        res.json({
            timestamp: new Date().toISOString(),
            oracle: status
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;