const cron = require('node-cron');
const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const { notifySurveyClosingSoon, notifySurveyClosed } = require('../services/surveyNotificationService');

/**
 * Job que verifica pesquisas próximas do encerramento (6 horas antes)
 * Executa a cada hora
 */
function startSurveyNotificationJob() {
    cron.schedule('0 * * * *', async () => {
        try {
            const pool = await getDatabasePool();
            
            // Buscar pesquisas que encerram em 6 horas e ainda não foram notificadas
            const result = await pool.request().query(`
                SELECT Id, titulo, data_encerramento
                FROM Surveys
                WHERE status = 'Ativa'
                  AND data_encerramento IS NOT NULL
                  AND data_encerramento > GETDATE()
                  AND data_encerramento <= DATEADD(HOUR, 6, GETDATE())
                  AND DATEDIFF(HOUR, data_inicio, data_encerramento) >= 6
                  AND NOT EXISTS (
                      SELECT 1 FROM SurveyNotificationLog 
                      WHERE survey_id = Surveys.Id AND notification_type = 'CLOSING_SOON'
                  )
            `);
            
            for (const survey of result.recordset) {
                await notifySurveyClosingSoon(survey.Id);
                
                // Registrar que a notificação foi enviada
                await pool.request()
                    .input('surveyId', sql.Int, survey.Id)
                    .input('type', sql.VarChar, 'CLOSING_SOON')
                    .query(`
                        INSERT INTO SurveyNotificationLog (survey_id, notification_type, sent_at)
                        VALUES (@surveyId, @type, GETDATE())
                    `);
            }
            
            console.log(`[JOB][PESQUISAS] Closing soon ok - Enviadas: ${result.recordset.length}`);
        } catch (error) {
            console.error('❌ Erro no job de notificações:', error);
        }
    });
    
    // Job para verificar pesquisas encerradas
    cron.schedule('*/30 * * * *', async () => {
        try {
            const pool = await getDatabasePool();
            
            const result = await pool.request().query(`
                SELECT Id, titulo
                FROM Surveys
                WHERE status = 'Encerrada'
                  AND NOT EXISTS (
                      SELECT 1 FROM SurveyNotificationLog 
                      WHERE survey_id = Surveys.Id AND notification_type = 'CLOSED'
                  )
            `);
            
            for (const survey of result.recordset) {
                await notifySurveyClosed(survey.Id);
                
                await pool.request()
                    .input('surveyId', sql.Int, survey.Id)
                    .input('type', sql.VarChar, 'CLOSED')
                    .query(`
                        INSERT INTO SurveyNotificationLog (survey_id, notification_type, sent_at)
                        VALUES (@surveyId, @type, GETDATE())
                    `);
            }
            
            console.log(`[JOB][PESQUISAS] Closed ok - Enviadas: ${result.recordset.length}`);
        } catch (error) {
            console.error('❌ Erro no job de pesquisas encerradas:', error);
        }
    });
    
    console.log('[JOB][PESQUISAS] Notificacoes agendadas');
}

/**
 * Cria tabela de log de notificações se não existir
 */
async function ensureSurveyNotificationLogExists() {
    try {
        const pool = await getDatabasePool();
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SurveyNotificationLog' AND xtype='U')
            CREATE TABLE SurveyNotificationLog (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                survey_id INT NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                sent_at DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (survey_id) REFERENCES Surveys(Id)
            )
        `);
    } catch (error) {
        console.error('Erro ao criar tabela SurveyNotificationLog:', error);
    }
}

module.exports = {
    startSurveyNotificationJob,
    ensureSurveyNotificationLogExists
};
