const sql = require('mssql');
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
        const ativarResult = await pool.request().query(`
            UPDATE Surveys 
            SET status = 'Ativa'
            WHERE status = 'Agendada' AND data_inicio IS NOT NULL AND data_inicio <= GETDATE()
        `);

        // Encerrar pesquisas ativas que passaram do prazo
        const encerrarResult = await pool.request().query(`
            UPDATE Surveys 
            SET status = 'Encerrada'
            WHERE status = 'Ativa' AND data_encerramento IS NOT NULL AND data_encerramento <= GETDATE()
        `);
        
        console.log(`[JOB][PESQUISAS] Status ok - Ativadas: ${ativarResult.rowsAffected[0]}, Encerradas: ${encerrarResult.rowsAffected[0]}`);

    } catch (error) {
        // Ignora erro se a tabela 'Surveys' não existir ainda
        if (!error.message.toLowerCase().includes("invalid object name 'surveys'")) {
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
        const ativarResult = await pool.request().query(`
            UPDATE Objetivos 
            SET status = 'Ativo', updated_at = GETDATE()
            WHERE status = 'Agendado' AND data_inicio IS NOT NULL AND data_inicio <= CAST(GETDATE() AS DATE)
        `);
        
        totalAtivados = ativarResult.rowsAffected[0];

        // Expirar objetivos ativos quando a data de fim é ultrapassada
        const expirarResult = await pool.request().query(`
            UPDATE Objetivos 
            SET status = 'Expirado', updated_at = GETDATE()
            WHERE status = 'Ativo' AND data_fim IS NOT NULL AND data_fim < CAST(GETDATE() AS DATE)
        `);

        totalExpirados = expirarResult.rowsAffected[0];
        console.log(`[JOB][OBJETIVOS] Status ok - Ativados: ${totalAtivados}, Expirados: ${totalExpirados}`);
    } catch (error) {
        // Ignora erro se a tabela 'Objetivos' não existir ainda
        if (!error.message.toLowerCase().includes("invalid object name 'objetivos'")) {
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
        const prazoCheck = await pool.request().query(`
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
            ) THEN 1 ELSE 0 END AS hasPrazoConclusao
        `);

        const hasPrazoConclusao = prazoCheck.recordset[0]?.hasPrazoConclusao === 1;
        const prazoColumn = hasPrazoConclusao ? 'PrazoConclusao' : 'PrazoRevisao';

        // Expirar PDIs cujo prazo passou e que não estão concluídos/cancelados/expirados
        const expirarResult = await pool.request().query(`
            UPDATE PDIs
            SET Status = 'Expirado', DataAtualizacao = GETDATE()
            WHERE ${prazoColumn} IS NOT NULL
              AND CAST(${prazoColumn} AS DATE) < CAST(GETDATE() AS DATE)
              AND Status NOT IN ('Concluído', 'Cancelado', 'Expirado')
        `);

        const totalExpirados = expirarResult.rowsAffected[0];

        console.log(`[JOB][PDI] Status ok - Expirados: ${totalExpirados}`);
    } catch (error) {
        if (!error.message.toLowerCase().includes("invalid object name 'pdis'")) {
            console.error('❌ [JOB] Erro ao atualizar status dos PDIs:', error);
        }
    }
}


module.exports = {
    updatePesquisaStatus,
    updateObjetivoStatus,
    updatePDIStatus
};