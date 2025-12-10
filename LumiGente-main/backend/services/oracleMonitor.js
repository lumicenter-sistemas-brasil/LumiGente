/**
 * Monitor de conectividade (Legacy - mantido por compatibilidade)
 * No novo ambiente MySQL, este monitor é simplificado pois não há mais Oracle Linked Server.
 * A tabela TAB_HIST_SRA é agora populada diretamente via Airflow.
 */

class OracleMonitor {
    constructor() {
        this.isOracleDown = false;
        this.lastOracleCheck = null;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
    }

    /**
     * Verifica a conectividade (simplificado para MySQL)
     * Como TAB_HIST_SRA é agora populada via Airflow, apenas retorna status OK
     */
    async checkOracleHealth() {
        this.lastOracleCheck = new Date();
        
        // No ambiente MySQL, não há Oracle Linked Server
        // A tabela TAB_HIST_SRA é populada externamente via Airflow
        return {
            connected: true, // Sempre conectado pois não há dependência Oracle
            isDown: false,
            consecutiveFailures: 0,
            lastCheck: this.lastOracleCheck,
            message: 'TAB_HIST_SRA é populada via Airflow - sem dependência Oracle'
        };
    }

    /**
     * Notifica sobre problemas (mantido por compatibilidade)
     */
    async notifyOracleDown() {
        console.log('ℹ️ No ambiente MySQL, não há dependência de Oracle Linked Server');
    }

    /**
     * Retorna o status atual
     */
    getStatus() {
        return {
            isDown: false, // Nunca down no ambiente MySQL
            consecutiveFailures: 0,
            lastCheck: this.lastOracleCheck,
            message: 'Ambiente MySQL - sem dependência Oracle'
        };
    }

    /**
     * Força reset do status (útil para testes)
     */
    resetStatus() {
        this.isOracleDown = false;
        this.consecutiveFailures = 0;
        this.lastOracleCheck = null;
        console.log('🔄 Status do monitor resetado');
    }
}

// Singleton instance
const oracleMonitor = new OracleMonitor();

module.exports = oracleMonitor;
