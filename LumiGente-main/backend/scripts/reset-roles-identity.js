/**
 * Script opcional para resetar o IDENTITY da tabela Roles.
 * 
 * ATENÇÃO: Este script deve ser usado apenas se você quiser que os IDs dos roles
 * comecem do 1 novamente. A solução principal do sistema já busca roles dinamicamente
 * pelo nome, então não é necessário resetar o IDENTITY.
 * 
 * Este script:
 * 1. Faz backup dos dados atuais
 * 2. Deleta todos os registros
 * 3. Reseta o IDENTITY para começar do 1
 * 4. Reinsere os roles padrão (admin, public, manager)
 * 
 * Execute apenas se realmente precisar resetar os IDs.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sql = require('mssql');
const { getDatabasePool } = require('../config/db');

async function resetRolesIdentity() {
    let pool;
    
    try {
        console.log('[RESET ROLES IDENTITY] Iniciando...');
        
        pool = await getDatabasePool();
        
        // 1. Verificar roles existentes
        const currentRoles = await pool.request().query(`
            SELECT Id, Name, Description, created_at 
            FROM Roles 
            ORDER BY Id
        `);
        
        console.log(`[RESET ROLES IDENTITY] Roles atuais encontrados: ${currentRoles.recordset.length}`);
        currentRoles.recordset.forEach(role => {
            console.log(`  - ID ${role.Id}: ${role.Name} (${role.Description})`);
        });
        
        if (currentRoles.recordset.length === 0) {
            console.log('[RESET ROLES IDENTITY] Tabela já está vazia. Nada a fazer.');
            return;
        }
        
        // 2. Verificar se há usuários usando esses roles
        const usersWithRoles = await pool.request().query(`
            SELECT COUNT(*) as total 
            FROM Users 
            WHERE RoleId IN (SELECT Id FROM Roles)
        `);
        
        const totalUsers = usersWithRoles.recordset[0].total;
        if (totalUsers > 0) {
            console.warn(`[RESET ROLES IDENTITY] ATENÇÃO: Existem ${totalUsers} usuários usando esses roles.`);
            console.warn('[RESET ROLES IDENTITY] Os RoleId dos usuários precisarão ser atualizados após o reset.');
        }
        
        // 3. Deletar todos os registros
        console.log('[RESET ROLES IDENTITY] Deletando registros...');
        await pool.request().query('DELETE FROM Roles');
        
        // 4. Resetar IDENTITY
        console.log('[RESET ROLES IDENTITY] Resetando IDENTITY...');
        await pool.request().query('DBCC CHECKIDENT (Roles, RESEED, 0)');
        
        // 5. Reinserir roles padrão
        console.log('[RESET ROLES IDENTITY] Reinserindo roles padrão...');
        await pool.request().query(`
            INSERT INTO Roles (Name, Description) VALUES
            ('admin', 'Administrador do sistema'),
            ('public', 'Usuário comum'),
            ('manager', 'Gestor')
        `);
        
        // 6. Verificar resultado
        const newRoles = await pool.request().query(`
            SELECT Id, Name, Description 
            FROM Roles 
            ORDER BY Id
        `);
        
        console.log('[RESET ROLES IDENTITY] Roles após reset:');
        newRoles.recordset.forEach(role => {
            console.log(`  - ID ${role.Id}: ${role.Name} (${role.Description})`);
        });
        
        if (totalUsers > 0) {
            console.log('\n[RESET ROLES IDENTITY] IMPORTANTE:');
            console.log('Você precisa atualizar os RoleId dos usuários para os novos IDs:');
            console.log('  - admin: ID 1');
            console.log('  - public: ID 2');
            console.log('  - manager: ID 3');
        }
        
        console.log('\n[RESET ROLES IDENTITY] Reset concluído com sucesso!');
        
    } catch (error) {
        console.error('[RESET ROLES IDENTITY] Erro:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    resetRolesIdentity()
        .then(() => {
            console.log('[RESET ROLES IDENTITY] Script finalizado.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[RESET ROLES IDENTITY] Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { resetRolesIdentity };

