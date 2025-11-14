const { getDatabasePool } = require('../config/db');
const sql = require('mssql');

async function recalculateEligibleUsers() {
    try {
        const pool = await getDatabasePool();
        
        console.log('🔄 Recalculando usuários elegíveis para todas as pesquisas...\n');
        
        // Buscar todas as pesquisas
        const surveysResult = await pool.request().query(`
            SELECT Id, titulo FROM Surveys ORDER BY data_criacao DESC
        `);
        
        console.log(`📋 Encontradas ${surveysResult.recordset.length} pesquisa(s)\n`);
        
        for (const survey of surveysResult.recordset) {
            console.log(`🔄 Processando: ${survey.titulo} (ID: ${survey.Id})`);
            
            try {
                await pool.request()
                    .input('survey_id', sql.Int, survey.Id)
                    .execute('sp_CalculateSurveyEligibleUsers');
                
                const countResult = await pool.request()
                    .input('surveyId', sql.Int, survey.Id)
                    .query('SELECT COUNT(*) as total FROM SurveyEligibleUsers WHERE survey_id = @surveyId');
                
                console.log(`   ✅ ${countResult.recordset[0].total} usuários elegíveis\n`);
            } catch (error) {
                console.log(`   ❌ Erro: ${error.message}\n`);
            }
        }
        
        console.log('✅ Recálculo concluído!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

recalculateEligibleUsers();
