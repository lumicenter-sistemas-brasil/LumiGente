const { getDatabasePool } = require('../config/db');
const sql = require('mssql');

async function detectDepartamentosMultiplasFiliais() {
    try {
        const pool = await getDatabasePool();
        
        console.log('🔍 Consultando estrutura da tabela Users...\n');
        
        // Consultar estrutura da tabela Users
        const estruturaResult = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Users'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('📋 Colunas disponíveis na tabela Users:');
        estruturaResult.recordset.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''})`);
        });
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 SCRIPT SQL: Detectar departamentos em múltiplas filiais');
        console.log('='.repeat(80) + '\n');
        
        const scriptSQL = `
-- Script para detectar departamentos que existem em mais de uma filial
-- Consultando apenas a tabela Users

SELECT 
    UPPER(LTRIM(RTRIM(DescricaoDepartamento))) AS Departamento,
    COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) AS QtdFiliais
FROM Users
WHERE DescricaoDepartamento IS NOT NULL 
  AND LTRIM(RTRIM(DescricaoDepartamento)) <> ''
  AND (Unidade IS NOT NULL OR Filial IS NOT NULL)
GROUP BY UPPER(LTRIM(RTRIM(DescricaoDepartamento)))
HAVING COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) > 1
ORDER BY QtdFiliais DESC, Departamento;
`;
        
        console.log(scriptSQL);
        console.log('='.repeat(80) + '\n');
        
        console.log('🚀 Executando consulta...\n');
        
        const result = await pool.request().query(scriptSQL);
        
        if (result.recordset.length === 0) {
            console.log('✅ Nenhum departamento encontrado em múltiplas filiais.');
        } else {
            console.log(`⚠️  Encontrados ${result.recordset.length} departamento(s) em múltiplas filiais:\n`);
            
            for (const row of result.recordset) {
                // Buscar as filiais específicas para este departamento
                const filiaisResult = await pool.request()
                    .input('dept', sql.NVarChar, row.Departamento)
                    .query(`
                        SELECT DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial)))) AS Filial
                        FROM Users
                        WHERE UPPER(LTRIM(RTRIM(DescricaoDepartamento))) = @dept
                          AND (Unidade IS NOT NULL OR Filial IS NOT NULL)
                        ORDER BY Filial
                    `);
                
                const filiais = filiaisResult.recordset.map(f => f.Filial).join(', ');
                
                console.log(`${result.recordset.indexOf(row) + 1}. ${row.Departamento}`);
                console.log(`   Quantidade de filiais: ${row.QtdFiliais}`);
                console.log(`   Filiais: ${filiais}`);
                console.log('');
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao executar script:', error);
        process.exit(1);
    }
}

detectDepartamentosMultiplasFiliais();
