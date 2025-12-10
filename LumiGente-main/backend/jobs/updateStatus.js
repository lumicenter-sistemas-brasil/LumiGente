const mysql = require('mysql2/promise');
const { getDatabasePool } = require('../config/db');

/**
 * Atualiza o status das pesquisas no novo sistema (tabela Surveys) e no sistema legado.
 * - 'Agendada' -> 'Ativa' quando a data de início é alcançada.
 * - 'Ativa' -> 'Encerrada' quando a data de encerramento é ultrapassada.
 */
async function updatePesquisaStatus() {
    try {
        const pool = await getDatabasePool();
        // --- NOVO SISTEMA DE PESQUISAS (Tabela Surveys) ---
        // Ativar pesquisas agendadas
        const [ativarResult] = await pool.query(`
            UPDATE Surveys 
            SET status = 'Ativa'
            WHERE status = 'Agendada' AND data_inicio IS NOT NULL AND data_inicio <= NOW()
        `);

        // Encerrar pesquisas ativas que passaram do prazo
        const [encerrarResult] = await pool.query(`
            UPDATE Surveys 
            SET status = 'Encerrada'
            WHERE status = 'Ativa' AND data_encerramento IS NOT NULL AND data_encerramento <= NOW()
        `);
        
        console.log(`[JOB][PESQUISAS] Status ok - Ativadas: ${ativarResult.affectedRows}, Encerradas: ${encerrarResult.affectedRows}`);

    } catch (error) {
        // Ignora erro se a tabela 'Surveys' não existir ainda
        if (!error.message || !error.message.toLowerCase().includes("surveys")) {
            console.error('❌ [JOB] Erro ao atualizar status das pesquisas:', error);
        }
    }
}


/**
 * Atualiza o status dos objetivos com base em suas datas.
 * - 'Agendado' -> 'Ativo' quando a data de início é alcançada.
 * - 'Ativo' -> 'Expirado' quando a data de fim é ultrapassada.
 * Executada diariamente à meia-noite.
 */
async function updateObjetivoStatus() {
    try {
        const pool = await getDatabasePool();
        let totalAtivados = 0;
        let totalExpirados = 0;

        // Ativar objetivos agendados quando a data de início é alcançada
        const [ativarResult] = await pool.query(`
            UPDATE Objetivos 
            SET status = 'Ativo', updated_at = NOW()
            WHERE status = 'Agendado' AND data_inicio IS NOT NULL AND data_inicio <= DATE(NOW())
        `);
        
        totalAtivados = ativarResult.affectedRows;

        // Expirar objetivos ativos quando a data de fim é ultrapassada
        const [expirarResult] = await pool.query(`
            UPDATE Objetivos 
            SET status = 'Expirado', updated_at = NOW()
            WHERE status = 'Ativo' AND data_fim IS NOT NULL AND data_fim < DATE(NOW())
        `);

        totalExpirados = expirarResult.affectedRows;
        console.log(`[JOB][OBJETIVOS] Status ok - Ativados: ${totalAtivados}, Expirados: ${totalExpirados}`);
    } catch (error) {
        // Ignora erro se a tabela 'Objetivos' não existir ainda
        if (!error.message || !error.message.toLowerCase().includes("objetivos")) {
            console.error('❌ [JOB] Erro ao atualizar status dos objetivos:', error);
        }
    }
}

/**
 * Atualiza o status dos PDIs com base no prazo de conclusão.
 * - Marca como 'Expirado' quando o prazo é ultrapassado e o PDI não está concluído/cancelado/expirado.
 * Executada diariamente à meia-noite.
 */
async function updatePDIStatus() {
    try {
        const pool = await getDatabasePool();
        // Descobrir qual coluna de prazo existe (PrazoConclusao ou PrazoRevisao)
        const [prazoCheck] = await pool.query(`
            SELECT COUNT(*) AS hasPrazoConclusao
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
        `);

        const hasPrazoConclusao = prazoCheck[0]?.hasPrazoConclusao > 0;
        const prazoColumn = hasPrazoConclusao ? 'PrazoConclusao' : 'PrazoRevisao';

        // Expirar PDIs cujo prazo passou e que não estão concluídos/cancelados/expirados
        const [expirarResult] = await pool.query(`
            UPDATE PDIs
            SET Status = 'Expirado', DataAtualizacao = NOW()
            WHERE ${prazoColumn} IS NOT NULL
              AND DATE(${prazoColumn}) < DATE(NOW())
              AND Status NOT IN ('Concluído', 'Cancelado', 'Expirado')
        `);

        const totalExpirados = expirarResult.affectedRows;

        console.log(`[JOB][PDI] Status ok - Expirados: ${totalExpirados}`);
    } catch (error) {
        if (!error.message || !error.message.toLowerCase().includes("pdis")) {
            console.error('❌ [JOB] Erro ao atualizar status dos PDIs:', error);
        }
    }
}


module.exports = {
    updatePesquisaStatus,
    updateObjetivoStatus,
    updatePDIStatus
};
