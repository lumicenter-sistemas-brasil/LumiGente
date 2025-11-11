const sql = require('mssql');
const { getDatabasePool } = require('../config/db'); // Importa a função de conexão centralizada
const { getHierarchyLevel } = require('../utils/hierarchyHelper'); // Mantém a importação do helper

class HierarchyManager {
    constructor() {
        // com a modularização agora a gente não precisa mais injetar o 'dbConfig'
    }

    /**
     * Obtém o pool de conexão do banco de dados de forma centralizada.
     * @returns {Promise<sql.ConnectionPool>}
     */
    async getPool() {
        // Utiliza a função importada para garantir uma única fonte de conexão.
        return await getDatabasePool();
    }

    /**
     * Determina a hierarquia baseada na matrícula e CPF.
     * @param {string} matricula - Matrícula do funcionário.
     * @param {string} cpf - CPF do funcionário (opcional, mas recomendado).
     * @returns {Promise<Object>} - Objeto com path, departamento e um getter 'level'.
     */
    async getHierarchyInfo(matricula, cpf = null) {
        try {
            const pool = await this.getPool();
            
            const funcionarioQuery = cpf 
                ? `SELECT TOP 1 CENTRO_CUSTO, DEPARTAMENTO, NOME, CPF FROM TAB_HIST_SRA WHERE MATRICULA = @matricula AND CPF = @cpf ORDER BY CASE WHEN STATUS_GERAL = 'ATIVO' THEN 0 ELSE 1 END, MATRICULA DESC`
                : `SELECT TOP 1 CENTRO_CUSTO, DEPARTAMENTO, NOME, CPF FROM TAB_HIST_SRA WHERE MATRICULA = @matricula ORDER BY CASE WHEN STATUS_GERAL = 'ATIVO' THEN 0 ELSE 1 END, MATRICULA DESC`;
            
            const funcionarioRequest = pool.request().input('matricula', sql.VarChar, matricula);
            if (cpf) {
                funcionarioRequest.input('cpf', sql.VarChar, cpf);
            }
            
            const funcionarioResult = await funcionarioRequest.query(funcionarioQuery);
            
            if (funcionarioResult.recordset.length === 0) {
                return { path: '', departamento: 'Não definido', get level() { return 0; } };
            }
            
            const funcionario = funcionarioResult.recordset[0];
            const cpfParaUsar = cpf || funcionario.CPF;
            
            const hierarquiaResult = await pool.request()
                .input('matricula', sql.VarChar, matricula)
                .input('cpf', sql.VarChar, cpfParaUsar)
                .query(`
                    SELECT TOP 1 DEPTO_ATUAL, DESCRICAO_ATUAL, HIERARQUIA_COMPLETA
                    FROM HIERARQUIA_CC 
                    WHERE RESPONSAVEL_ATUAL = @matricula AND (CPF_RESPONSAVEL = @cpf OR CPF_RESPONSAVEL IS NULL)
                    ORDER BY LEN(HIERARQUIA_COMPLETA) DESC
                `);
            
            let path = '';
            let departamento = funcionario.DEPARTAMENTO || 'Não definido';
            
            if (hierarquiaResult.recordset.length > 0) {
                const hierarquia = hierarquiaResult.recordset[0];
                path = hierarquia.HIERARQUIA_COMPLETA;
            } else {
                const hierarquiaTrabalhoResult = await pool.request()
                    .input('deptoAtual', sql.VarChar, funcionario.DEPARTAMENTO)
                    .query(`
                        SELECT TOP 1 DEPTO_ATUAL, HIERARQUIA_COMPLETA
                        FROM HIERARQUIA_CC 
                        WHERE TRIM(DEPTO_ATUAL) = TRIM(@deptoAtual)
                        ORDER BY LEN(HIERARQUIA_COMPLETA) DESC
                    `);
                
                if (hierarquiaTrabalhoResult.recordset.length > 0) {
                    path = hierarquiaTrabalhoResult.recordset[0].HIERARQUIA_COMPLETA;
                }
            }

            path = await this.sanitizeHierarchyPath(path, funcionario.DEPARTAMENTO, pool);
            const departamentoFinal = funcionario.DEPARTAMENTO || departamento || 'Não definido';

            return {
                path,
                departamento: departamentoFinal,
                get level() { return getHierarchyLevel(this.path); }
            };
        } catch (error) {
            console.error('Erro ao determinar hierarquia:', error);
            return { path: '', departamento: 'Erro', get level() { return 0; } };
        }
    }
    
    /**
     * Alias para getHierarchyInfo() para manter compatibilidade com código legado.
     * @deprecated Use getHierarchyInfo()
     */
    async getHierarchyLevel(matricula, cpf = null) {
        return this.getHierarchyInfo(matricula, cpf);
    }

    /**
     * Verifica se um usuário pode aceder aos dados de outro.
     */
    canAccessUser(currentUser, targetUser) {
        if (currentUser.role === 'Administrador') return true;

        const currentLevel = getHierarchyLevel(currentUser.hierarchyPath || currentUser.HierarchyPath);
        const targetLevel = getHierarchyLevel(targetUser.hierarchyPath || targetUser.HierarchyPath);

        if (currentLevel > targetLevel) return true;
        if (currentLevel === targetLevel) return currentUser.departamento === targetUser.Departamento;

        return false;
    }

    /**
     * Busca os subordinados de um utilizador.
     */
    async getSubordinates(matricula, cpf = null) {
        try {
            const pool = await this.getPool();
            const query = cpf
                ? `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF, u.LastLogin FROM Users u JOIN HIERARQUIA_CC h ON u.Matricula = h.RESPONSAVEL_ATUAL AND u.CPF = h.CPF_RESPONSAVEL WHERE h.RESPONSAVEL_ATUAL = @matricula AND h.CPF_RESPONSAVEL = @cpf AND u.IsActive = 1 ORDER BY u.NomeCompleto`
                : `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF, u.LastLogin FROM Users u JOIN HIERARQUIA_CC h ON u.Matricula = h.RESPONSAVEL_ATUAL WHERE h.RESPONSAVEL_ATUAL = @matricula AND u.IsActive = 1 ORDER BY u.NomeCompleto`;
            
            const request = pool.request().input('matricula', sql.VarChar, matricula);
            if (cpf) request.input('cpf', sql.VarChar, cpf);
            
            const result = await request.query(query);

            const recordsWithLevel = result.recordset.map(record => ({
                ...record,
                HierarchyLevel: getHierarchyLevel(record.HierarchyPath, record.Matricula, record.Departamento)
            })).sort((a, b) => b.HierarchyLevel - a.HierarchyLevel || a.NomeCompleto.localeCompare(b.NomeCompleto));

            return recordsWithLevel;
        } catch (error) {
            console.error('Erro ao buscar subordinados:', error);
            throw error;
        }
    }

    /**
     * Busca os superiores de um utilizador.
     */
    async getSuperiors(matricula, cpf = null) {
        try {
            const pool = await this.getPool();
            const query = cpf 
                ? `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF FROM Users u JOIN HIERARQUIA_CC h ON ((u.Matricula = h.NIVEL_1_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL) OR (u.Matricula = h.NIVEL_2_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL) OR (u.Matricula = h.NIVEL_3_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL) OR (u.Matricula = h.NIVEL_4_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL)) WHERE h.RESPONSAVEL_ATUAL = @matricula AND h.CPF_RESPONSAVEL = @cpf AND u.IsActive = 1 AND u.Matricula != @matricula ORDER BY u.NomeCompleto`
                : `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF FROM Users u JOIN HIERARQUIA_CC h ON (u.Matricula = h.NIVEL_1_MATRICULA_RESP OR u.Matricula = h.NIVEL_2_MATRICULA_RESP OR u.Matricula = h.NIVEL_3_MATRICULA_RESP OR u.Matricula = h.NIVEL_4_MATRICULA_RESP) WHERE h.RESPONSAVEL_ATUAL = @matricula AND u.IsActive = 1 AND u.Matricula != @matricula ORDER BY u.NomeCompleto`;

            const request = pool.request().input('matricula', sql.VarChar, matricula);
            if (cpf) request.input('cpf', sql.VarChar, cpf);
            
            const result = await request.query(query);
            
            const recordsWithLevel = result.recordset.map(record => ({
                ...record,
                HierarchyLevel: getHierarchyLevel(record.HierarchyPath, record.Matricula, record.Departamento)
            })).sort((a, b) => b.HierarchyLevel - a.HierarchyLevel || a.NomeCompleto.localeCompare(b.NomeCompleto));

            return recordsWithLevel;
        } catch (error) {
            console.error('Erro ao buscar superiores:', error);
            throw error;
        }
    }

    /**
     * Busca utilizadores acessíveis com base na hierarquia e filtros.
     */
    async getAccessibleUsers(currentUser, options = {}) {
        try {
            const pool = await this.getPool();
            
            // Verificar se o usuário tem dados necessários
            if (!currentUser || !currentUser.userId) {
                console.log('❌ Usuário inválido para buscar usuários acessíveis');
                return [];
            }
            
            // IMPORTANTE: Verificar se é RH/T&D considerando também a FILIAL
            // Para evitar que gestores de Manaus sejam identificados como RH/T&D de SJP
            const isHRTDWithFilial = await this.checkHRTDWithFilial(currentUser, pool);
            const directOnly = Boolean(options.directReportsOnly);
            
            if (isHRTDWithFilial && !directOnly) {
                let query = `SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, HierarchyPath as hierarchyPath, Matricula, 'RH_TD_ACCESS' as TipoRelacao FROM Users WHERE IsActive = 1`;
                if (options.department && options.department !== 'Todos') {
                    query += ` AND Departamento = @department`;
                }
                query += ` ORDER BY NomeCompleto`;
                
                const request = pool.request();
                if (options.department && options.department !== 'Todos') {
                    request.input('department', sql.NVarChar, options.department);
                }
                const result = await request.query(query);
                
                // Verificar se result.recordset existe e é um array
                if (!result.recordset || !Array.isArray(result.recordset)) {
                    console.log('⚠️ Resultado inválido da query RH/TD, retornando array vazio');
                    return [];
                }
                
                return result.recordset.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.Matricula, record.departamento) 
                }));
            }
            
            // Verificar se o usuário tem matrícula para verificação de gestor
            if (!currentUser.matricula) {
                console.log('⚠️ Usuário sem matrícula, retornando apenas ele mesmo');
                const result = await pool.request().input('currentUserId', sql.Int, currentUser.userId).query(`SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, HierarchyPath as hierarchyPath, Matricula FROM Users WHERE IsActive = 1 AND Id = @currentUserId ORDER BY NomeCompleto`);
                
                if (!result.recordset || !Array.isArray(result.recordset)) {
                    return [];
                }
                
                return result.recordset.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) 
                }));
            }
            
            const isManagerCheck = await pool.request()
                .input('userMatricula', sql.VarChar, currentUser.matricula)
                .input('userFilial', sql.VarChar, currentUser.Filial || currentUser.filial || '')
                .query(`
                    SELECT COUNT(*) as count 
                    FROM HIERARQUIA_CC 
                    WHERE (RESPONSAVEL_ATUAL = @userMatricula OR NIVEL_1_MATRICULA_RESP = @userMatricula OR NIVEL_2_MATRICULA_RESP = @userMatricula OR NIVEL_3_MATRICULA_RESP = @userMatricula OR NIVEL_4_MATRICULA_RESP = @userMatricula)
                    AND (FILIAL = @userFilial OR (@userFilial = '' AND FILIAL IS NULL))
                `);
            const isManager = isManagerCheck.recordset[0].count > 0;
            
            if (isManager) {
                const request = pool.request()
                    .input('userMatricula', sql.VarChar, currentUser.matricula)
                    .input('userFilial', sql.VarChar, currentUser.Filial || currentUser.filial || '');

                let query = `
                    WITH UsuariosAcessiveis AS (
                        SELECT DISTINCT
                            u.Id AS userId,
                            u.NomeCompleto AS nomeCompleto,
                            u.Departamento AS departamento,
                            u.DescricaoDepartamento AS descricaoDepartamento,
                            u.HierarchyPath AS hierarchyPath,
                            u.Matricula,
                            'SUBORDINADO' AS TipoRelacao
                        FROM Users u
                        INNER JOIN TAB_HIST_SRA s ON u.Matricula = s.MATRICULA AND u.CPF = s.CPF
                        INNER JOIN HIERARQUIA_CC h ON (
                            h.RESPONSAVEL_ATUAL = @userMatricula
                            OR h.NIVEL_1_MATRICULA_RESP = @userMatricula
                            OR h.NIVEL_2_MATRICULA_RESP = @userMatricula
                            OR h.NIVEL_3_MATRICULA_RESP = @userMatricula
                            OR h.NIVEL_4_MATRICULA_RESP = @userMatricula
                        )
                        WHERE u.IsActive = 1
                          AND s.STATUS_GERAL = 'ATIVO'
                          AND (TRIM(s.DEPARTAMENTO) = TRIM(h.DEPTO_ATUAL) OR s.MATRICULA = h.RESPONSAVEL_ATUAL)
                          AND (h.FILIAL = @userFilial OR (@userFilial = '' AND h.FILIAL IS NULL))

                        UNION

                        SELECT
                            u.Id,
                            u.NomeCompleto,
                            u.Departamento,
                            u.DescricaoDepartamento,
                            u.HierarchyPath,
                            u.Matricula,
                            'PROPRIO_USUARIO'
                        FROM Users u
                        WHERE u.Matricula = @userMatricula AND u.IsActive = 1
                    )
                    SELECT DISTINCT userId, nomeCompleto, departamento, descricaoDepartamento, hierarchyPath, Matricula, TipoRelacao
                    FROM UsuariosAcessiveis
                `;

                if (options.department && options.department !== 'Todos') {
                    query += ` WHERE TRIM(ISNULL(descricaoDepartamento, departamento)) = @department OR TipoRelacao = 'PROPRIO_USUARIO'`;
                    request.input('department', sql.NVarChar, options.department);
                }

                query += ` ORDER BY nomeCompleto`;

                const result = await request.query(query);
                 
                if (!result.recordset || !Array.isArray(result.recordset)) {
                    console.log('⚠️ Resultado inválido da query de gestor, retornando array vazio');
                    return [];
                }

                const managerInfo = await this.getManagerHierarchyData(currentUser, pool);

                const filteredRecords = directOnly
                    ? result.recordset.filter(record => this.isDirectSubordinateRecord(record, managerInfo))
                    : result.recordset;

                return filteredRecords.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) 
                }));
            } else {
                const result = await pool.request().input('currentUserId', sql.Int, currentUser.userId).query(`SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, HierarchyPath as hierarchyPath, Matricula FROM Users WHERE IsActive = 1 AND Id = @currentUserId ORDER BY NomeCompleto`);
                
                if (!result.recordset || !Array.isArray(result.recordset)) {
                    console.log('⚠️ Resultado inválido da query de usuário comum, retornando array vazio');
                    return [];
                }
                
                return result.recordset.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) 
                }));
            }
        } catch (error) {
            console.error('❌ Erro ao buscar usuários acessíveis:', error);
            // Retornar array vazio em caso de erro para evitar quebrar o frontend
            return [];
        }
    }

    /**
     * Verifica se o usuário é RH/T&D considerando também a filial para evitar conflitos
     * entre gestores de Manaus e RH/T&D de SJP
     */
    async checkHRTDWithFilial(currentUser, pool) {
        try {
            const departamento = currentUser.departamento ? currentUser.departamento.toUpperCase() : '';
            const filial = currentUser.Filial || currentUser.filial || '';
            
            // Verificar se é RH baseado no código do departamento (122134101 = DEPARTAMENTO ADM/RH/SESMT)
            const isHRByCode = departamento === '122134101';
            
            // Verificações mais abrangentes para RH
            const isHR = isHRByCode || 
                         departamento.includes('RH') || 
                         departamento.includes('RECURSOS HUMANOS') ||
                         departamento.includes('DEPARTAMENTO RH') ||
                         departamento.includes('ADM/RH') ||
                         departamento.includes('COORDENACAO ADM/RH') ||
                         departamento.includes('DEPARTAMENTO ADM/RH') ||
                         departamento.includes('COORDENACAO ADM/RH/SESMT') ||
                         departamento.includes('DEPARTAMENTO ADM/RH/SESMT') ||
                         departamento.includes('RH/SESMT');
                         
            // Verificações mais abrangentes para T&D
            const isTD = departamento.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
                         departamento.includes('TREINAMENTO') ||
                         departamento.includes('DESENVOLVIMENTO') ||
                         departamento.includes('T&D') ||
                         departamento.includes('TREINAM&DESENVOLV') ||
                         departamento.includes('TREINAM') ||
                         departamento.includes('DESENVOLV') ||
                         departamento.includes('TREINAMENTO E DESENVOLVIMENTO');
            
            // Se não é RH/T&D por departamento, retornar false
            if (!isHR && !isTD) {
                return false;
            }
            
            // IMPORTANTE: Verificar se é realmente RH/T&D considerando a filial
            // Para gestores de Manaus com departamento 122134101, não devem ser considerados RH/T&D
            if (isHRByCode && filial && filial.toUpperCase().includes('MANAUS')) {
                console.log(`🔍 Usuário ${currentUser.nomeCompleto} tem departamento RH (${departamento}) mas é de Manaus (${filial}) - NÃO é RH/T&D`);
                return false;
            }
            
            console.log(`🔍 Usuário ${currentUser.nomeCompleto} identificado como RH/T&D: departamento=${departamento}, filial=${filial}`);
            return true;
            
        } catch (error) {
            console.error('Erro ao verificar RH/T&D com filial:', error);
            return false;
        }
    }

    async sanitizeHierarchyPath(path, funcionarioDepartamento, pool) {
        try {
            if (!path) {
                return '';
            }

            const parts = path
                .split('>')
                .map(part => part.trim())
                .filter(part => part.length > 0);

            if (parts.length === 0) {
                return '';
            }

            if (parts.length === 1) {
                return parts[0];
            }

            const first = parts[0];
            const last = parts[parts.length - 1];
            const middle = parts.slice(1, parts.length - 1);

            let activeSet = new Set();
            if (middle.length > 0) {
                const uniqueMiddle = [...new Set(middle)];
                const request = pool.request();
                const placeholders = [];

                uniqueMiddle.forEach((code, index) => {
                    const param = `dep${index}`;
                    request.input(param, sql.VarChar, code);
                    placeholders.push(`@${param}`);
                });

                if (placeholders.length > 0) {
                    const query = `
                        SELECT DISTINCT TRIM(DEPARTAMENTO) AS codigo
                        FROM TAB_HIST_SRA
                        WHERE STATUS_GERAL = 'ATIVO'
                          AND TRIM(DEPARTAMENTO) IN (${placeholders.join(', ')})
                    `;
                    const result = await request.query(query);
                    activeSet = new Set(
                        result.recordset
                            .map(row => (row.codigo || '').trim())
                            .filter(Boolean)
                    );
                }
            }

            const sanitizedMiddle = middle.filter(code => activeSet.has(code));

            let sanitizedParts = [first, ...sanitizedMiddle];
            if (last && last !== first) {
                sanitizedParts.push(last);
            }

            const departamentoCodigo = (funcionarioDepartamento || '').trim();
            if (departamentoCodigo) {
                const hasDepartamento = sanitizedParts.some(code => code === departamentoCodigo);
                if (!hasDepartamento) {
                    if (sanitizedParts.length > 1) {
                        sanitizedParts.splice(sanitizedParts.length - 1, 0, departamentoCodigo);
                    } else {
                        sanitizedParts.push(departamentoCodigo);
                    }
                }
            }

            const seen = new Set();
            sanitizedParts = sanitizedParts.filter(code => {
                if (!code) return false;
                if (seen.has(code)) return false;
                seen.add(code);
                return true;
            });

            return sanitizedParts.join(' > ');
        } catch (error) {
            console.error('⚠️ Erro ao sanitizar HierarchyPath:', error);
            return path;
        }
    }

    /**
     * Busca todos os utilizadores ativos para a funcionalidade de dar feedback (sem restrições).
     */
    async getUsersForFeedback() {
        try {
            const pool = await this.getPool();
            const query = `SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, DescricaoDepartamento as descricaoDepartamento, HierarchyPath as hierarchyPath FROM Users WHERE IsActive = 1 ORDER BY NomeCompleto`;
            const result = await pool.request().query(query);
            return result.recordset.map(record => ({ ...record, hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) }));
        } catch (error) {
            console.error('Erro ao buscar usuários para feedback:', error);
            throw error;
        }
    }

    /**
     * Sincroniza a hierarquia de um utilizador específico via Stored Procedure.
     */
    async syncUserHierarchy(userId) {
        try {
            const pool = await this.getPool();
            await pool.request().input('userId', sql.Int, userId).query(`EXEC sp_SyncUserHierarchy @UserId = @userId`);
            return true;
        } catch (error) {
            console.error('Erro ao sincronizar hierarquia do usuário:', error);
            throw error;
        }
    }

    /**
     * Sincroniza a hierarquia de todos os utilizadores via Stored Procedure.
     */
    async syncAllHierarchies() {
        try {
            const pool = await this.getPool();
            await pool.request().query(`EXEC sp_SyncUserHierarchy`);
            return true;
        } catch (error) {
            console.error('Erro ao sincronizar todas as hierarquias:', error);
            throw error;
        }
    }

    /**
     * Obtém estatísticas da hierarquia (contagem de utilizadores por departamento).
     */
    async getHierarchyStats() {
        try {
            const pool = await this.getPool();
            const result = await pool.request().query(`SELECT COUNT(*) as count, Departamento FROM Users WHERE IsActive = 1 GROUP BY Departamento ORDER BY COUNT(*) DESC`);
            return result.recordset;
        } catch (error) {
            console.error('Erro ao buscar estatísticas da hierarquia:', error);
            throw error;
        }
    }

    async getManagerHierarchyData(currentUser, pool) {
        try {
            const result = await pool.request()
                .input('managerId', sql.Int, currentUser.userId)
                .query(`SELECT Departamento, HierarchyPath FROM Users WHERE Id = @managerId`);

            if (result.recordset.length > 0) {
                const record = result.recordset[0];
                return {
                    departamento: (record.Departamento || '').trim(),
                    hierarchyPath: record.HierarchyPath || ''
                };
            }

            return {
                departamento: (currentUser.departamento || currentUser.Departamento || '').trim(),
                hierarchyPath: currentUser.hierarchyPath || currentUser.HierarchyPath || ''
            };
        } catch (error) {
            console.error('⚠️ Erro ao obter dados de hierarquia do gestor:', error);
            return {
                departamento: (currentUser.departamento || currentUser.Departamento || '').trim(),
                hierarchyPath: currentUser.hierarchyPath || currentUser.HierarchyPath || ''
            };
        }
    }

    isDirectSubordinateRecord(record, managerInfo) {
        try {
            if (!record) return false;

            if (record.TipoRelacao === 'PROPRIO_USUARIO') {
                return true;
            }

            const managerDepartment = (managerInfo?.departamento || '').trim();
            if (!managerDepartment) {
                return false;
            }

            const subordinateDepartment = (record.departamento || '').trim();
            if (!subordinateDepartment) {
                return false;
            }

            const parentDepartment = this.getParentDepartmentFromPath(record.hierarchyPath, subordinateDepartment);

            return parentDepartment === managerDepartment;
        } catch (error) {
            console.error('⚠️ Erro ao verificar subordinado direto:', error);
            return false;
        }
    }

    getParentDepartmentFromPath(path, departamentoAtual) {
        if (!path) {
            return null;
        }

        const parts = path
            .split('>')
            .map(segment => segment.trim())
            .filter(segment => segment.length > 0);

        if (parts.length === 0) {
            return null;
        }

        const departamentoAlvo = (departamentoAtual || '').trim();
        let index = departamentoAlvo ? parts.lastIndexOf(departamentoAlvo) : -1;

        if (index === -1) {
            index = parts.length - 1;
        }

        if (index <= 0) {
            return null;
        }

        return parts[index - 1];
    }
}

module.exports = HierarchyManager;