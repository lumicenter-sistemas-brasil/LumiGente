/**
 * Script para consultar os detalhes do job TAB_HIST_SRA no SQL Server Agent
 * e descobrir exatamente de onde ele busca os dados.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sql = require('mssql');
const { getDatabasePool } = require('../config/db');

async function checkJobDetails() {
    let pool;
    
    try {
        console.log('[CHECK JOB] Conectando ao banco de dados...');
        pool = await getDatabasePool();
        console.log('[CHECK JOB] Conectado!\n');

        // 1. Buscar informações do job
        console.log('=== INFORMAÇÕES DO JOB ===');
        const jobInfo = await pool.request().query(`
            SELECT 
                job_id,
                name,
                enabled,
                description,
                date_created,
                date_modified
            FROM msdb.dbo.sysjobs
            WHERE name = 'TAB_HIST_SRA'
        `);

        if (jobInfo.recordset.length === 0) {
            console.log('❌ Job TAB_HIST_SRA não encontrado!');
            return;
        }

        const job = jobInfo.recordset[0];
        console.log(`Nome: ${job.name}`);
        console.log(`ID: ${job.job_id}`);
        console.log(`Ativo: ${job.enabled ? 'Sim' : 'Não'}`);
        console.log(`Descrição: ${job.description || '(sem descrição)'}`);
        console.log(`Criado em: ${job.date_created}`);
        console.log(`Modificado em: ${job.date_modified}\n`);

        // 2. Buscar os steps (etapas) do job
        console.log('=== STEPS DO JOB ===');
        const steps = await pool.request()
            .input('job_id', sql.UniqueIdentifier, job.job_id)
            .query(`
                SELECT 
                    step_id,
                    step_name,
                    subsystem,
                    command,
                    on_success_action,
                    on_fail_action,
                    database_name
                FROM msdb.dbo.sysjobsteps
                WHERE job_id = @job_id
                ORDER BY step_id
            `);

        if (steps.recordset.length === 0) {
            console.log('❌ Nenhum step encontrado para este job!');
        } else {
            steps.recordset.forEach((step, index) => {
                console.log(`\n--- Step ${step.step_id}: ${step.step_name} ---`);
                console.log(`Subsistema: ${step.subsystem}`);
                console.log(`Banco de dados: ${step.database_name || '(padrão)'}`);
                console.log(`Ação em sucesso: ${step.on_success_action}`);
                console.log(`Ação em falha: ${step.on_fail_action}`);
                console.log(`\nComando SQL:`);
                console.log('─'.repeat(80));
                console.log(step.command);
                console.log('─'.repeat(80));
            });
        }

        // 3. Buscar informações sobre linked servers mencionados
        console.log('\n=== LINKED SERVERS DISPONÍVEIS ===');
        const linkedServers = await pool.request().query(`
            SELECT 
                name,
                product,
                provider,
                data_source,
                location,
                provider_string,
                catalog
            FROM sys.servers
            WHERE is_linked = 1
        `);

        if (linkedServers.recordset.length === 0) {
            console.log('❌ Nenhum linked server encontrado!');
        } else {
            linkedServers.recordset.forEach((server, index) => {
                console.log(`\n--- Linked Server ${index + 1}: ${server.name} ---`);
                console.log(`Produto: ${server.product || '(não especificado)'}`);
                console.log(`Provedor: ${server.provider || '(não especificado)'}`);
                console.log(`Data Source: ${server.data_source || '(não especificado)'}`);
                console.log(`Location: ${server.location || '(não especificado)'}`);
                console.log(`Catalog: ${server.catalog || '(não especificado)'}`);
            });
        }

        // 4. Verificar histórico recente do job
        console.log('\n=== HISTÓRICO RECENTE DO JOB ===');
        const history = await pool.request()
            .input('job_id', sql.UniqueIdentifier, job.job_id)
            .query(`
                SELECT TOP 5
                    h.run_date,
                    h.run_time,
                    h.step_name,
                    h.run_status,
                    h.run_duration,
                    h.message
                FROM msdb.dbo.sysjobhistory h
                WHERE h.job_id = @job_id
                ORDER BY h.run_date DESC, h.run_time DESC
            `);

        if (history.recordset.length === 0) {
            console.log('❌ Nenhum histórico encontrado!');
        } else {
            history.recordset.forEach((exec, index) => {
                const dateStr = exec.run_date.toString();
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const timeStr = exec.run_time.toString().padStart(6, '0');
                const hour = timeStr.substring(0, 2);
                const min = timeStr.substring(2, 4);
                const sec = timeStr.substring(4, 6);
                const execTime = `${day}/${month}/${year} ${hour}:${min}:${sec}`;
                
                const status = exec.run_status === 1 ? '✅ Sucesso' : 
                              exec.run_status === 0 ? '❌ Falha' : 
                              '⚠️ Desconhecido';
                
                console.log(`\n--- Execução ${index + 1} ---`);
                console.log(`Data/Hora: ${execTime}`);
                console.log(`Step: ${exec.step_name}`);
                console.log(`Status: ${status}`);
                console.log(`Duração: ${exec.run_duration} segundos`);
                if (exec.message && exec.message.length > 0) {
                    console.log(`Mensagem: ${exec.message.substring(0, 200)}${exec.message.length > 200 ? '...' : ''}`);
                }
            });
        }

        // 5. Verificar schedule (agendamento) do job
        console.log('\n=== AGENDAMENTO DO JOB ===');
        const schedules = await pool.request()
            .input('job_id', sql.UniqueIdentifier, job.job_id)
            .query(`
                SELECT 
                    s.name as schedule_name,
                    s.enabled,
                    s.freq_type,
                    s.freq_interval,
                    s.freq_subday_type,
                    s.freq_subday_interval,
                    s.active_start_time,
                    s.active_start_date
                FROM msdb.dbo.sysjobschedules js
                INNER JOIN msdb.dbo.sysschedules s ON js.schedule_id = s.schedule_id
                WHERE js.job_id = @job_id
            `);

        if (schedules.recordset.length === 0) {
            console.log('❌ Nenhum agendamento encontrado!');
        } else {
            schedules.recordset.forEach((schedule, index) => {
                console.log(`\n--- Agendamento ${index + 1}: ${schedule.schedule_name} ---`);
                console.log(`Ativo: ${schedule.enabled ? 'Sim' : 'Não'}`);
                console.log(`Tipo de frequência: ${schedule.freq_type}`);
                console.log(`Intervalo: ${schedule.freq_interval}`);
                console.log(`Hora de início: ${schedule.active_start_time}`);
                console.log(`Data de início: ${schedule.active_start_date}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    checkJobDetails()
        .then(() => {
            console.log('\n[CHECK JOB] Script finalizado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[CHECK JOB] Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkJobDetails };

