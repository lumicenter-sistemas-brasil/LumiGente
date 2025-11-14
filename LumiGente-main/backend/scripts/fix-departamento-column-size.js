const { getDatabasePool } = require('../config/db');

async function fixColumnSize() {
    try {
        const pool = await getDatabasePool();
        
        console.log('🔧 Verificando tamanho das colunas...\n');
        
        const checkResult = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'SurveyDepartamentoFilters'
              AND COLUMN_NAME IN ('departamento_codigo', 'Departamento')
        `);
        
        console.log('📋 Tamanho atual das colunas:');
        checkResult.recordset.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`);
        });
        
        console.log('\n🔧 Aumentando tamanho das colunas para NVARCHAR(200)...\n');
        
        await pool.request().query(`
            ALTER TABLE SurveyDepartamentoFilters 
            ALTER COLUMN departamento_codigo NVARCHAR(200);
        `);
        
        await pool.request().query(`
            ALTER TABLE SurveyDepartamentoFilters 
            ALTER COLUMN Departamento NVARCHAR(200);
        `);
        
        console.log('✅ Colunas atualizadas com sucesso!\n');
        
        const verifyResult = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'SurveyDepartamentoFilters'
              AND COLUMN_NAME IN ('departamento_codigo', 'Departamento')
        `);
        
        console.log('📋 Novo tamanho das colunas:');
        verifyResult.recordset.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao atualizar colunas:', error);
        process.exit(1);
    }
}

fixColumnSize();
