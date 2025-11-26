/**
 * Helper para gerenciar conectividade com Oracle linked server
 * Implementa retry logic e fallback strategies
 */

const sql = require('mssql');

class OracleConnectionHelper {
    static async executeWithFallback(pool, primaryQuery, fallbackQuery, maxRetries = 2) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Tentativa ${attempt}/${maxRetries} - Executando query Oracle...`);
                const result = await pool.request().query(primaryQuery);
                console.log('✅ Conexão Oracle bem-sucedida');
                return result;
            } catch (error) {
                lastError = error;
                
                // Verifica se é erro específico do Oracle linked server
                if (this.isOracleConnectionError(error)) {
                    console.warn(`⚠️ Erro Oracle detectado (tentativa ${attempt}/${maxRetries}):`, error.message);
                    
                    // Se é a última tentativa, usa fallback
                    if (attempt === maxRetries && fallbackQuery) {
                        console.log('🔄 Usando query de fallback...');
                        try {
                            const fallbackResult = await pool.request().query(fallbackQuery);
                            console.log('✅ Fallback executado com sucesso');
                            return fallbackResult;
                        } catch (fallbackError) {
                            console.error('❌ Erro no fallback:', fallbackError.message);
                            throw fallbackError;
                        }
                    }
                    
                    // Aguarda antes da próxima tentativa
                    if (attempt < maxRetries) {
                        await this.delay(1000 * attempt); // Backoff exponencial
                    }
                } else {
                    // Se não é erro do Oracle, re-lança imediatamente
                    throw error;
                }
            }
        }
        
        // Se chegou aqui, todas as tentativas falharam
        throw lastError;
    }
    
    static isOracleConnectionError(error) {
        const oracleErrorPatterns = [
            'OraOLEDB.Oracle',
            'ORACLE_PROD_SJP',
            'linked server',
            'Cannot get the data of the row from the OLE DB provider'
        ];
        
        const errorMessage = error.message || '';
        return oracleErrorPatterns.some(pattern => 
            errorMessage.toLowerCase().includes(pattern.toLowerCase())
        );
    }
    
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Testa a conectividade com o Oracle linked server
     */
    static async testOracleConnection(pool) {
        try {
            await pool.request().query('SELECT 1 FROM TAB_HIST_SRA WHERE ROWNUM = 1');
            return { connected: true, message: 'Oracle conectado' };
        } catch (error) {
            return { 
                connected: false, 
                message: error.message,
                isOracleError: this.isOracleConnectionError(error)
            };
        }
    }
}

module.exports = OracleConnectionHelper;