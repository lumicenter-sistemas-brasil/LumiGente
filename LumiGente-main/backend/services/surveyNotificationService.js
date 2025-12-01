const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const { createNotification } = require('../controllers/notificationController');
const emailService = require('./emailService');

/**
 * Notifica usuários sobre nova pesquisa
 */
async function notifyNewSurvey(surveyId) {
    try {
        const pool = await getDatabasePool();
        
        const surveyResult = await pool.request()
            .input('surveyId', sql.Int, surveyId)
            .query('SELECT titulo, descricao FROM Surveys WHERE Id = @surveyId');
        
        if (surveyResult.recordset.length === 0) return;
        
        const survey = surveyResult.recordset[0];
        
        const usersResult = await pool.request()
            .input('surveyId', sql.Int, surveyId)
            .query(`
                SELECT DISTINCT u.Id, u.Email, u.NomeCompleto
                FROM SurveyEligibleUsers seu
                INNER JOIN Users u ON seu.user_id = u.Id
                WHERE seu.survey_id = @surveyId AND u.IsActive = 1
            `);
        
        for (const user of usersResult.recordset) {
            // Notificação no sistema
            await createNotification(
                user.Id,
                'SURVEY_NEW',
                `Nova pesquisa disponível: ${survey.titulo}`,
                surveyId
            );
            
            // Email
            try {
                await emailService.sendSurveyNotificationEmail(
                    user.Email,
                    user.NomeCompleto,
                    survey.titulo,
                    survey.descricao,
                    'nova'
                );
            } catch (emailError) {
                console.error(`Erro ao enviar email para ${user.Email}:`, emailError);
            }
        }
        
        console.log(`✅ Notificações enviadas para ${usersResult.recordset.length} usuários sobre nova pesquisa`);
    } catch (error) {
        console.error('Erro ao notificar nova pesquisa:', error);
    }
}

/**
 * Notifica usuários sobre pesquisa próxima do encerramento
 */
async function notifySurveyClosingSoon(surveyId) {
    try {
        const pool = await getDatabasePool();
        
        const surveyResult = await pool.request()
            .input('surveyId', sql.Int, surveyId)
            .query('SELECT titulo, data_encerramento FROM Surveys WHERE Id = @surveyId');
        
        if (surveyResult.recordset.length === 0) return;
        
        const survey = surveyResult.recordset[0];
        
        const usersResult = await pool.request()
            .input('surveyId', sql.Int, surveyId)
            .query(`
                SELECT DISTINCT u.Id, u.Email, u.NomeCompleto
                FROM SurveyEligibleUsers seu
                INNER JOIN Users u ON seu.user_id = u.Id
                WHERE seu.survey_id = @surveyId 
                  AND u.IsActive = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM SurveyResponses sr 
                      WHERE sr.survey_id = @surveyId AND sr.user_id = u.Id
                  )
            `);
        
        for (const user of usersResult.recordset) {
            await createNotification(
                user.Id,
                'SURVEY_CLOSING',
                `A pesquisa "${survey.titulo}" encerra em breve!`,
                surveyId
            );
            
            try {
                await emailService.sendSurveyNotificationEmail(
                    user.Email,
                    user.NomeCompleto,
                    survey.titulo,
                    null,
                    'encerrando'
                );
            } catch (emailError) {
                console.error(`Erro ao enviar email para ${user.Email}:`, emailError);
            }
        }
        
        console.log(`✅ Notificações de encerramento enviadas para ${usersResult.recordset.length} usuários`);
    } catch (error) {
        console.error('Erro ao notificar pesquisa encerrando:', error);
    }
}

/**
 * Notifica usuários sobre pesquisa encerrada
 */
async function notifySurveyClosed(surveyId) {
    try {
        const pool = await getDatabasePool();
        
        const surveyResult = await pool.request()
            .input('surveyId', sql.Int, surveyId)
            .query('SELECT titulo FROM Surveys WHERE Id = @surveyId');
        
        if (surveyResult.recordset.length === 0) return;
        
        const survey = surveyResult.recordset[0];
        
        const usersResult = await pool.request()
            .input('surveyId', sql.Int, surveyId)
            .query(`
                SELECT DISTINCT u.Id, u.Email, u.NomeCompleto
                FROM SurveyEligibleUsers seu
                INNER JOIN Users u ON seu.user_id = u.Id
                WHERE seu.survey_id = @surveyId 
                  AND u.IsActive = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM SurveyResponses sr 
                      WHERE sr.survey_id = @surveyId AND sr.user_id = u.Id
                  )
            `);
        
        for (const user of usersResult.recordset) {
            await createNotification(
                user.Id,
                'SURVEY_CLOSED',
                `A pesquisa "${survey.titulo}" foi encerrada`,
                surveyId
            );
        }
        
        console.log(`✅ Notificações de encerramento enviadas para ${usersResult.recordset.length} usuários`);
    } catch (error) {
        console.error('Erro ao notificar pesquisa encerrada:', error);
    }
}

module.exports = {
    notifyNewSurvey,
    notifySurveyClosingSoon,
    notifySurveyClosed
};
