const { getDatabasePool } = require('../config/db');

async function addDepartamentoUnicoField() {
    try {
        const pool = await getDatabasePool();
        
        console.log('🔧 Adicionando campo DepartamentoUnico na tabela Users...\n');
        
        // Adicionar coluna se não existir
        await pool.request().query(`
            IF COL_LENGTH('Users', 'DepartamentoUnico') IS NULL
            BEGIN
                ALTER TABLE Users ADD DepartamentoUnico AS 
                    UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial)))) + ' - ' + 
                    UPPER(LTRIM(RTRIM(DescricaoDepartamento))) PERSISTED;
                PRINT 'Coluna DepartamentoUnico adicionada com sucesso!';
            END
            ELSE
            BEGIN
                PRINT 'Coluna DepartamentoUnico já existe.';
            END
        `);
        
        console.log('✅ Campo DepartamentoUnico criado como coluna computada!\n');
        
        // Verificar alguns exemplos
        console.log('📋 Exemplos de DepartamentoUnico gerados:\n');
        const result = await pool.request().query(`
            SELECT TOP 10
                COALESCE(Unidade, Filial) AS Filial,
                DescricaoDepartamento,
                DepartamentoUnico
            FROM Users
            WHERE DescricaoDepartamento IS NOT NULL
            ORDER BY DepartamentoUnico
        `);
        
        result.recordset.forEach((row, index) => {
            console.log(`${index + 1}. Filial: ${row.Filial} | Depto: ${row.DescricaoDepartamento}`);
            console.log(`   → DepartamentoUnico: ${row.DepartamentoUnico}\n`);
        });
        
        // Verificar departamentos únicos
        console.log('📊 Verificando departamentos únicos...\n');
        const uniqueResult = await pool.request().query(`
            SELECT 
                COUNT(DISTINCT DepartamentoUnico) AS TotalDepartamentosUnicos,
                COUNT(DISTINCT DescricaoDepartamento) AS TotalDescricoes
            FROM Users
            WHERE DescricaoDepartamento IS NOT NULL
        `);
        
        const stats = uniqueResult.recordset[0];
        console.log(`Total de descrições de departamento: ${stats.TotalDescricoes}`);
        console.log(`Total de departamentos únicos (Filial + Depto): ${stats.TotalDepartamentosUnicos}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao adicionar campo:', error);
        process.exit(1);
    }
}

addDepartamentoUnicoField();
