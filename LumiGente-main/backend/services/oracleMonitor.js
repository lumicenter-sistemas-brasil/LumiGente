/**
 * Monitor de conectividade Oracle
 * Monitora a saúde da conexão e envia alertas quando necessário
 */

const { getDatabasePool } = require('../config/db');
const OracleConnectionHelper = require('../utils/oracleConnectionHelper');

class OracleMonitor {
    constructor() {
        this.isOracleDown = false;
        this.lastOracleCheck = null;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
    }

    /**
     * Verifica a conectividade Oracle e atualiza o status
     */
    async checkOracleHealth() {
        try {
            const pool = await getDatabasePool();
            const result = await OracleConnectionHelper.testOracleConnection(pool);
            
            if (result.connected) {
                // Oracle voltou a funcionar
                if (this.isOracleDown) {
                    console.log('✅ Oracle linked server reconectado!');
                    this.isOracleDown = false;
                    this.consecutiveFailures = 0;
                }
            } else {
                this.consecutiveFailures++;
                
                // Oracle está com problema
                if (!this.isOracleDown && this.consecutiveFailures >= this.maxConsecutiveFailures) {
                    console.warn('⚠️ Oracle linked server indisponível após múltiplas tentativas');
                    this.isOracleDown = true;
                    
                    // Aqui você pode implementar notificações por email/Slack
                    await this.notifyOracleDown();
                }
            }
            
            this.lastOracleCheck = new Date();
            
            return {
                connected: result.connected,
                isDown: this.isOracleDown,
                consecutiveFailures: this.consecutiveFailures,
                lastCheck: this.lastOracleCheck
            };
            
        } catch (error) {
            console.error('❌ Erro ao verificar saúde do Oracle:', error.message);
            this.consecutiveFailures++;
            
            if (!this.isOracleDown && this.consecutiveFailures >= this.maxConsecutiveFailures) {
                this.isOracleDown = true;
                await this.notifyOracleDown();
            }
            
            return {
                connected: false,
                isDown: this.isOracleDown,
                consecutiveFailures: this.consecutiveFailures,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    /**
     * Notifica sobre problemas no Oracle
     */
    async notifyOracleDown() {
        const message = `
🚨 ALERTA: Oracle Linked Server Indisponível

O sistema detectou que o Oracle linked server (ORACLE_PROD_SJP) está indisponível.

Impactos:
- Criação automática de avaliações pode usar dados locais como fallback
- Sincronização de funcionários pode ser afetada
- Sistema continua funcionando com limitações

Timestamp: ${new Date().toLocaleString('pt-BR')}
Falhas consecutivas: ${this.consecutiveFailures}
        `;
        
        console.warn(message);
        
        // Aqui você pode implementar envio de email/Slack/Teams
        // await emailService.sendAlert('Oracle Down', message);
    }

    /**
     * Retorna o status atual do Oracle
     */
    getStatus() {
        return {
            isDown: this.isOracleDown,
            consecutiveFailures: this.consecutiveFailures,
            lastCheck: this.lastOracleCheck
        };
    }

    /**
     * Força reset do status (útil para testes)
     */
    resetStatus() {
        this.isOracleDown = false;
        this.consecutiveFailures = 0;
        this.lastOracleCheck = null;
        console.log('🔄 Status do Oracle monitor resetado');
    }
}

// Singleton instance
const oracleMonitor = new OracleMonitor();

module.exports = oracleMonitor;