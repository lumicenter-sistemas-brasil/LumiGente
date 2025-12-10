const schedule = require('node-schedule');
const mysql = require('mysql2/promise');
const { getDatabasePool } = require('../config/db');
const { updatePesquisaStatus, updateObjetivoStatus, updatePDIStatus } = require('./updateStatus'); // Funções de atualização
const AvaliacoesManager = require('../services/avaliacoesManager');
const { atualizarStatusAvaliacoes } = require('./avaliacoesStatusJob');

/**
 * Função para verificar e criar avaliações de experiência automaticamente.
 * Executada diariamente.
 */
async function verificarAvaliacoesAutomaticamente() {
    try {
        const resultado = await AvaliacoesManager.verificarECriarAvaliacoes();
        console.log(`[JOB][AVALIACOES] Criacao ok - 45d: ${resultado.criadas45dias}, 90d: ${resultado.criadas90dias}`);
    } catch (error) {
        console.error('[JOB][AVALIACOES] Criacao erro:', error.message || error);
        // Não re-lança o erro para evitar crash do sistema
    }
}

/**
 * Função para atualizar o status de avaliações e enviar notificações.
 * Executada diariamente à meia-noite.
 */
async function verificarStatusAvaliacoes() {
    try {
        await atualizarStatusAvaliacoes();
        console.log('[JOB][AVALIACOES] Status ok');
    } catch (error) {
        // Ignora erro se a tabela não existir ainda
        if (!error.message || !error.message.toLowerCase().includes("avaliacoes")) {
            console.error('❌ [JOB] Erro ao verificar status de avaliações:', error);
        }
    }
}


/**
 * Inicializa e configura todas as tarefas agendadas da aplicação.
 */
function setupScheduledJobs() {

    // --- Job de Atualização de Status de Pesquisas (a cada minuto) ---
    // Executa uma vez na inicialização e depois a cada minuto.
    updatePesquisaStatus();
    schedule.scheduleJob('* * * * *', updatePesquisaStatus); // Executa a cada minuto cheio

    // --- Job de Atualização de Status de Objetivos (diariamente) ---
    const objetivoCheckTime = process.env.OBJETIVO_CHECK_TIME || '0 0 * * *'; // Meia-noite
    updateObjetivoStatus();
    schedule.scheduleJob(objetivoCheckTime, updateObjetivoStatus);

    // --- Job de Atualização de Status de PDIs (diariamente) ---
    const pdiCheckTime = process.env.PDI_CHECK_TIME || '0 0 * * *'; // Meia-noite
    updatePDIStatus();
    schedule.scheduleJob(pdiCheckTime, updatePDIStatus);

    // --- Job de Criação de Avaliações de Experiência (diariamente às 08:00) ---
    const avaliacaoCreateTime = '0 8 * * *'; // Todo dia às 08:00
    setTimeout(verificarAvaliacoesAutomaticamente, 10000); // Roda 10s após o início
    schedule.scheduleJob(avaliacaoCreateTime, verificarAvaliacoesAutomaticamente);

    // --- Job de Atualização de Status de Avaliações (diariamente à meia-noite) ---
    const avaliacaoStatusTime = '0 0 * * *'; // Meia-noite
    setTimeout(verificarStatusAvaliacoes, 15000); // Roda 15s após o início
    schedule.scheduleJob(avaliacaoStatusTime, verificarStatusAvaliacoes);

    console.log('[SCHEDULE] Tarefas configuradas.');
}

module.exports = setupScheduledJobs;
