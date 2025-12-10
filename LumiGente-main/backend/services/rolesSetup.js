const mysql = require('mysql2/promise');
const { getDatabasePool } = require('../config/db');

/**
 * Garante que a tabela Roles tenha os dados padrão necessários.
 * Executado na inicialização do servidor.
 */
async function ensureRolesExist() {
    try {
        const pool = await getDatabasePool();

        // Verificar se a tabela Roles existe
        const [rolesTableCheck] = await pool.query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Roles'
        `);

        if (rolesTableCheck[0].existe === 0) {
            // Tabela não existe - criar com estrutura e inserir dados padrão
            await pool.query(`
                CREATE TABLE Roles (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    Name VARCHAR(50) NOT NULL,
                    Description VARCHAR(255),
                    created_at DATETIME DEFAULT NOW()
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            
            await pool.query(`
                INSERT INTO Roles (Name, Description) VALUES
                ('admin', 'Administrador do sistema'),
                ('public', 'Usuário comum'),
                ('manager', 'Gestor')
            `);
            
            console.log('  -> Tabela Roles criada e populada com dados padrão');
        } else {
            // Tabela existe - verificar se está vazia e inserir dados se necessário
            const [rolesCountCheck] = await pool.query(`
                SELECT COUNT(*) as total FROM Roles
            `);

            if (rolesCountCheck[0].total === 0) {
                // Tabela existe mas está vazia - inserir dados padrão
                await pool.query(`
                    INSERT INTO Roles (Name, Description) VALUES
                    ('admin', 'Administrador do sistema'),
                    ('public', 'Usuário comum'),
                    ('manager', 'Gestor')
                `);
                
                console.log('  -> Tabela Roles estava vazia - dados padrão inseridos');
            } else {
                // Verificar se os roles essenciais existem
                const [rolesCheck] = await pool.query(`
                    SELECT Name FROM Roles WHERE Name IN ('admin', 'public', 'manager')
                `);
                
                const existingRoles = rolesCheck.map(r => r.Name);
                const requiredRoles = [
                    { name: 'admin', description: 'Administrador do sistema' },
                    { name: 'public', description: 'Usuário comum' },
                    { name: 'manager', description: 'Gestor' }
                ];
                const missingRoles = requiredRoles.filter(r => !existingRoles.includes(r.name));
                
                if (missingRoles.length > 0) {
                    // Inserir roles faltantes
                    for (const role of missingRoles) {
                        await pool.query(
                            `INSERT INTO Roles (Name, Description) VALUES (?, ?)`,
                            [role.name, role.description]
                        );
                    }
                    
                    const missingNames = missingRoles.map(r => r.name);
                    console.log(`  -> Tabela Roles - inseridos ${missingRoles.length} roles faltantes: ${missingNames.join(', ')}`);
                } else {
                    console.log('  -> Tabela Roles já existe e possui todos os roles necessários');
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Erro ao verificar/criar tabela Roles:', error);
        throw error;
    }
}

/**
 * Busca o ID de um role pelo nome.
 * @param {string} roleName - Nome do role ('admin', 'public', 'manager')
 * @returns {Promise<number|null>} - ID do role ou null se não encontrado
 */
async function getRoleIdByName(roleName) {
    try {
        const pool = await getDatabasePool();
        const [result] = await pool.query('SELECT Id FROM Roles WHERE Name = ?', [roleName]);
        
        if (result.length > 0) {
            return result[0].Id;
        }
        
        return null;
    } catch (error) {
        console.error(`Erro ao buscar RoleId para '${roleName}':`, error);
        return null;
    }
}

module.exports = { ensureRolesExist, getRoleIdByName };
