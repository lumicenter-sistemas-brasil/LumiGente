/**
 * Oracle Connection Helper (Legacy - Simplificado para MySQL)
 * 
 * Este arquivo foi simplificado pois no ambiente MySQL não há dependência de Oracle Linked Server.
 * A tabela TAB_HIST_SRA é agora populada diretamente via Airflow.
 * 
 * As funções são mantidas por compatibilidade, mas retornam valores simplificados.
 */

const { getDatabasePool } = require('../config/db');

class OracleConnectionHelper {
    /**
     * Testa a conexão com o banco de dados
     * No ambiente MySQL, apenas verifica se o pool está conectado
     */
    static async testOracleConnection(pool = null) {
        try {
            const dbPool = pool || await getDatabasePool();
            await dbPool.query('SELECT 1');
            
            return {
                connected: true,
                message: 'Conexão com MySQL estabelecida (TAB_HIST_SRA via Airflow)',
                timestamp: new Date()
            };
        } catch (error) {
            return {
                connected: false,
                message: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * Executa query com fallback
     * No ambiente MySQL, executa diretamente na tabela local
     */
    static async executeWithFallback(oracleQuery, sqlServerFallbackQuery, pool = null) {
        try {
            const dbPool = pool || await getDatabasePool();
            
            // No MySQL, usa a query de fallback que aponta para TAB_HIST_SRA local
            const [result] = await dbPool.query(sqlServerFallbackQuery);
            
            return {
                success: true,
                data: result,
                source: 'local_mysql',
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Erro ao executar query:', error.message);
            return {
                success: false,
                error: error.message,
                source: 'error',
                timestamp: new Date()
            };
        }
    }

    /**
     * Verifica se a tabela TAB_HIST_SRA existe e tem dados
     */
    static async checkTabHistSraStatus(pool = null) {
        try {
            const dbPool = pool || await getDatabasePool();
            
            const [result] = await dbPool.query(`
                SELECT COUNT(*) as total FROM TAB_HIST_SRA
            `);
            
            return {
                exists: true,
                recordCount: result[0].total,
                source: 'Airflow sync',
                timestamp: new Date()
            };
        } catch (error) {
            return {
                exists: false,
                recordCount: 0,
                error: error.message,
                timestamp: new Date()
            };
        }
    }
}

module.exports = OracleConnectionHelper;
