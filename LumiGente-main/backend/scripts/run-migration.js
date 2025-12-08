const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') }); // Ajuste o path para backend/config.env

// Configuração do banco de dados
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};

async function runMigration() {
    try {
        console.log('Conectando ao banco de dados...');
        console.log(`Server: ${config.server}, Database: ${config.database}`);

        await sql.connect(config);
        console.log('Conectado!');

        const scriptPath = path.join(__dirname, 'create-perguntas-tables.sql');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        console.log('Executando script de migração...');

        const request = new sql.Request();
        await request.query(scriptContent);

        console.log('Migração concluída com sucesso!');
    } catch (err) {
        console.error('Erro ao executar migração:', err);
    } finally {
        await sql.close();
    }
}

runMigration();
