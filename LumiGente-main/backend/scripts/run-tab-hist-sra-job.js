const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    driver: process.env.DB_DRIVER,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
        requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 30000,
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000
    }
};

async function runTAB_HIST_SRAJob() {
    try {
        console.log('Conectando ao banco de dados...');
        const pool = await sql.connect(dbConfig);
        console.log('Conectado!\n');

        console.log('=== EXECUTANDO JOB TAB_HIST_SRA MANUALMENTE ===\n');

        // Verificar se o job existe e está ativo
        const jobCheck = await pool.request().query(`
            SELECT name, enabled 
            FROM msdb.dbo.sysjobs 
            WHERE name = 'TAB_HIST_SRA'
        `);

        if (jobCheck.recordset.length === 0) {
            console.error('❌ Job TAB_HIST_SRA não encontrado!');
            await pool.close();
            process.exit(1);
        }

        const job = jobCheck.recordset[0];
        console.log(`Job encontrado: ${job.name}`);
        console.log(`Status: ${job.enabled ? '✅ ATIVO' : '❌ INATIVO'}\n`);

        if (!job.enabled) {
            console.log('⚠️ Job está inativo. Tentando executar mesmo assim...\n');
        }

        // Obter job_id
        const jobIdResult = await pool.request().query(`
            SELECT job_id 
            FROM msdb.dbo.sysjobs 
            WHERE name = 'TAB_HIST_SRA'
        `);
        const jobId = jobIdResult.recordset[0].job_id;

        console.log('Iniciando execução do job...');
        const startTime = new Date();
        console.log(`Hora de início: ${startTime.toLocaleString('pt-BR')}\n`);

        // Executar o job usando sp_start_job
        try {
            await pool.request()
                .input('job_name', sql.VarChar, 'TAB_HIST_SRA')
                .execute('msdb.dbo.sp_start_job');

            console.log('✅ Comando de execução enviado com sucesso!');
            console.log('⏳ Aguardando conclusão do job...\n');

            // Aguardar e verificar status
            let attempts = 0;
            const maxAttempts = 60; // 5 minutos máximo (5s * 60)
            let jobRunning = true;

            while (jobRunning && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5 segundos

                const statusCheck = await pool.request().query(`
                    SELECT TOP 1
                        h.run_status,
                        h.step_name,
                        h.message,
                        h.run_date,
                        h.run_time
                    FROM msdb.dbo.sysjobhistory h
                    INNER JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
                    WHERE j.name = 'TAB_HIST_SRA'
                    ORDER BY h.run_date DESC, h.run_time DESC
                `);

                if (statusCheck.recordset.length > 0) {
                    const latest = statusCheck.recordset[0];
                    const dateStr = latest.run_date.toString();
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    const timeStr = latest.run_time.toString().padStart(6, '0');
                    const hour = timeStr.substring(0, 2);
                    const min = timeStr.substring(2, 4);
                    const sec = timeStr.substring(4, 6);
                    const execTime = `${day}/${month}/${year} ${hour}:${min}:${sec}`;

                    // Verificar se é uma execução recente (últimos 2 minutos)
                    const execDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
                    const timeDiff = (new Date() - execDate) / 1000; // diferença em segundos

                    if (timeDiff < 120 && latest.run_status !== null) {
                        // Execução concluída
                        jobRunning = false;
                        
                        if (latest.run_status === 1) {
                            console.log('✅ Job executado com SUCESSO!');
                            console.log(`Step: ${latest.step_name}`);
                            console.log(`Hora de conclusão: ${execTime}`);
                        } else if (latest.run_status === 0) {
                            console.log('❌ Job executado com FALHA!');
                            console.log(`Step: ${latest.step_name}`);
                            console.log(`Mensagem: ${latest.message || 'Sem mensagem'}`);
                            console.log(`Hora de conclusão: ${execTime}`);
                        } else {
                            console.log(`⚠️ Status desconhecido: ${latest.run_status}`);
                        }
                    } else {
                        attempts++;
                        process.stdout.write(`\r⏳ Aguardando... (${attempts * 5}s)`);
                    }
                } else {
                    attempts++;
                    process.stdout.write(`\r⏳ Aguardando início... (${attempts * 5}s)`);
                }
            }

            if (jobRunning) {
                console.log('\n⚠️ Timeout aguardando conclusão do job.');
                console.log('Verifique o status manualmente no SQL Server Agent.');
            }

            // Verificar quantos registros foram inseridos
            console.log('\n=== VERIFICANDO RESULTADO ===');
            const countResult = await pool.request().query(`
                SELECT COUNT(*) as total FROM TAB_HIST_SRA
            `);
            console.log(`Total de registros em TAB_HIST_SRA: ${countResult.recordset[0].total}`);

            const endTime = new Date();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`\n⏱️ Tempo total: ${duration} segundos`);

        } catch (error) {
            console.error('\n❌ Erro ao executar job:', error.message);
            console.error('Detalhes:', error);
        }

        await pool.close();
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

runTAB_HIST_SRAJob();

