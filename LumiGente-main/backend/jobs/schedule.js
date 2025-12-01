const schedule = require('node-schedule');
const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const { updatePesquisaStatus, updateObjetivoStatus } = require('./updateStatus'); // Funções de atualização
const AvaliacoesManager = require('../services/avaliacoesManager');
const oracleMonitor = require('../services/oracleMonitor');
const { atualizarStatusAvaliacoes } = require('./avaliacoesStatusJob');

/**
 * Função para verificar e criar avaliações de experiência automaticamente.
 * Executada diariamente.
 */
async function verificarAvaliacoesAutomaticamente() {
    try {
        console.log('📋 [JOB] Executando verificação automática de criação de avaliações...');
        
        // Verifica saúde do Oracle antes de executar
        const oracleStatus = await oracleMonitor.checkOracleHealth();
        if (oracleStatus.isDown) {
            console.warn('⚠️ [JOB] Oracle indisponível. Executando com fallback...');
        }
        
        const resultado = await AvaliacoesManager.verificarECriarAvaliacoes();
        console.log('✅ [JOB] Verificação automática de avaliações concluída:', resultado);
    } catch (error) {
        // Log do erro mas não interrompe o sistema
        if (error.message && error.message.includes('OraOLEDB.Oracle')) {
            console.warn('⚠️ [JOB] Problema de conectividade com Oracle detectado. Sistema continuará funcionando.');
            await oracleMonitor.checkOracleHealth(); // Atualiza status do monitor
        } else {
            console.error('❌ [JOB] Erro na verificação automática de avaliações:', error.message || error);
        }
        // Não re-lança o erro para evitar crash do sistema
    }
}

/**
 * Função para atualizar o status de avaliações e enviar notificações.
 * Executada diariamente à meia-noite.
 */
async function verificarStatusAvaliacoes() {
    try {
        console.log('📅 [JOB] Executando verificação de status de avaliações com notificações...');
        await atualizarStatusAvaliacoes();
    } catch (error) {
        // Ignora erro se a tabela não existir ainda
        if (!error.message.toLowerCase().includes("invalid object name 'avaliacoes'")) {
            console.error('❌ [JOB] Erro ao verificar status de avaliações:', error);
        }
    }
}


/**
 * Inicializa e configura todas as tarefas agendadas da aplicação.
 */
function setupScheduledJobs() {
    console.log('⏰ Configurando tarefas agendadas...');

    // --- Job de Atualização de Status de Pesquisas (a cada minuto) ---
    // Executa uma vez na inicialização e depois a cada minuto.
    console.log('🔄 [PESQUISAS] Executando primeira verificação de status...');
    updatePesquisaStatus();
    schedule.scheduleJob('* * * * *', updatePesquisaStatus); // Executa a cada minuto cheio
    console.log('   -> Tarefa de status de pesquisas agendada para rodar a cada minuto.');

    // --- Job de Atualização de Status de Objetivos (diariamente) ---
    const objetivoCheckTime = process.env.OBJETIVO_CHECK_TIME || '0 0 * * *'; // Meia-noite
    console.log('🔄 [OBJETIVOS] Executando primeira verificação de status...');
    updateObjetivoStatus();
    schedule.scheduleJob(objetivoCheckTime, updateObjetivoStatus);
    console.log(`   -> Tarefa de status de objetivos agendada para: ${objetivoCheckTime}`);

    // --- Job de Criação de Avaliações de Experiência (diariamente às 08:00) ---
    const avaliacaoCreateTime = '0 8 * * *'; // Todo dia às 08:00
    console.log('🔄 [AVALIAÇÕES] Executando primeira verificação para criação de avaliações...');
    setTimeout(verificarAvaliacoesAutomaticamente, 10000); // Roda 10s após o início
    schedule.scheduleJob(avaliacaoCreateTime, verificarAvaliacoesAutomaticamente);
    console.log(`   -> Tarefa de criação de avaliações agendada para: ${avaliacaoCreateTime}`);

    // --- Job de Atualização de Status de Avaliações (diariamente à meia-noite) ---
    const avaliacaoStatusTime = '0 0 * * *'; // Meia-noite
    console.log('🔄 [AVALIAÇÕES] Executando primeira verificação de status de avaliações...');
    setTimeout(verificarStatusAvaliacoes, 15000); // Roda 15s após o início
    schedule.scheduleJob(avaliacaoStatusTime, verificarStatusAvaliacoes);
    console.log(`   -> Tarefa de status de avaliações agendada para: ${avaliacaoStatusTime}`);

    // --- Job de Monitoramento Oracle (a cada 5 minutos) ---
    console.log('🔄 [ORACLE] Configurando monitoramento de conectividade Oracle...');
    schedule.scheduleJob('*/5 * * * *', async () => {
        await oracleMonitor.checkOracleHealth();
    });
    console.log('   -> Monitoramento Oracle agendado para rodar a cada 5 minutos.');

    console.log('✅ Todas as tarefas agendadas foram configuradas.');
}

module.exports = setupScheduledJobs;