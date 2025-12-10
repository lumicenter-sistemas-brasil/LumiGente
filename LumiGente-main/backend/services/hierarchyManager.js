const { getDatabasePool } = require('../config/db');
const { getHierarchyLevel } = require('../utils/hierarchyHelper');

class HierarchyManager {
    constructor() {
        // com a modularização agora a gente não precisa mais injetar o 'dbConfig'
    }

    /**
     * Obtém o pool de conexão do banco de dados de forma centralizada.
     * @returns {Promise<mysql.Pool>}
     */
    async getPool() {
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
            
            let funcionarioRows;
            if (cpf) {
                [funcionarioRows] = await pool.execute(
                    `SELECT CENTRO_CUSTO, DEPARTAMENTO, NOME, CPF FROM TAB_HIST_SRA 
                     WHERE MATRICULA = ? AND CPF = ? 
                     ORDER BY CASE WHEN STATUS_GERAL = 'ATIVO' THEN 0 ELSE 1 END, MATRICULA DESC 
                     LIMIT 1`,
                    [matricula, cpf]
                );
            } else {
                [funcionarioRows] = await pool.execute(
                    `SELECT CENTRO_CUSTO, DEPARTAMENTO, NOME, CPF FROM TAB_HIST_SRA 
                     WHERE MATRICULA = ? 
                     ORDER BY CASE WHEN STATUS_GERAL = 'ATIVO' THEN 0 ELSE 1 END, MATRICULA DESC 
                     LIMIT 1`,
                    [matricula]
                );
            }
            
            if (funcionarioRows.length === 0) {
                return { path: '', departamento: 'Não definido', get level() { return 0; } };
            }
            
            const funcionario = funcionarioRows[0];
            const cpfParaUsar = cpf || funcionario.CPF;
            
            const [hierarquiaRows] = await pool.execute(`
                SELECT DEPTO_ATUAL, DESCRICAO_ATUAL, HIERARQUIA_COMPLETA
                FROM HIERARQUIA_CC 
                WHERE RESPONSAVEL_ATUAL = ? AND (CPF_RESPONSAVEL = ? OR CPF_RESPONSAVEL IS NULL)
                ORDER BY LENGTH(HIERARQUIA_COMPLETA) DESC
                LIMIT 1
            `, [matricula, cpfParaUsar]);
            
            let path = '';
            let departamento = funcionario.DEPARTAMENTO || 'Não definido';
            
            if (hierarquiaRows.length > 0) {
                const hierarquia = hierarquiaRows[0];
                path = hierarquia.HIERARQUIA_COMPLETA;
            } else {
                const [hierarquiaTrabalhoRows] = await pool.execute(`
                    SELECT DEPTO_ATUAL, HIERARQUIA_COMPLETA
                    FROM HIERARQUIA_CC 
                    WHERE TRIM(DEPTO_ATUAL) = TRIM(?)
                    ORDER BY LENGTH(HIERARQUIA_COMPLETA) DESC
                    LIMIT 1
                `, [funcionario.DEPARTAMENTO]);
                
                if (hierarquiaTrabalhoRows.length > 0) {
                    path = hierarquiaTrabalhoRows[0].HIERARQUIA_COMPLETA;
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
            let rows;
            
            if (cpf) {
                [rows] = await pool.execute(
                    `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF, u.LastLogin 
                     FROM Users u 
                     JOIN HIERARQUIA_CC h ON u.Matricula = h.RESPONSAVEL_ATUAL AND u.CPF = h.CPF_RESPONSAVEL 
                     WHERE h.RESPONSAVEL_ATUAL = ? AND h.CPF_RESPONSAVEL = ? AND u.IsActive = 1 
                     ORDER BY u.NomeCompleto`,
                    [matricula, cpf]
                );
            } else {
                [rows] = await pool.execute(
                    `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF, u.LastLogin 
                     FROM Users u 
                     JOIN HIERARQUIA_CC h ON u.Matricula = h.RESPONSAVEL_ATUAL 
                     WHERE h.RESPONSAVEL_ATUAL = ? AND u.IsActive = 1 
                     ORDER BY u.NomeCompleto`,
                    [matricula]
                );
            }

            const recordsWithLevel = rows.map(record => ({
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
            let rows;
            
            if (cpf) {
                [rows] = await pool.execute(
                    `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF 
                     FROM Users u 
                     JOIN HIERARQUIA_CC h ON (
                         (u.Matricula = h.NIVEL_1_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL) OR 
                         (u.Matricula = h.NIVEL_2_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL) OR 
                         (u.Matricula = h.NIVEL_3_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL) OR 
                         (u.Matricula = h.NIVEL_4_MATRICULA_RESP AND u.CPF = h.CPF_RESPONSAVEL)
                     ) 
                     WHERE h.RESPONSAVEL_ATUAL = ? AND h.CPF_RESPONSAVEL = ? AND u.IsActive = 1 AND u.Matricula != ? 
                     ORDER BY u.NomeCompleto`,
                    [matricula, cpf, matricula]
                );
            } else {
                [rows] = await pool.execute(
                    `SELECT DISTINCT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF 
                     FROM Users u 
                     JOIN HIERARQUIA_CC h ON (
                         u.Matricula = h.NIVEL_1_MATRICULA_RESP OR 
                         u.Matricula = h.NIVEL_2_MATRICULA_RESP OR 
                         u.Matricula = h.NIVEL_3_MATRICULA_RESP OR 
                         u.Matricula = h.NIVEL_4_MATRICULA_RESP
                     ) 
                     WHERE h.RESPONSAVEL_ATUAL = ? AND u.IsActive = 1 AND u.Matricula != ? 
                     ORDER BY u.NomeCompleto`,
                    [matricula, matricula]
                );
            }
            
            const recordsWithLevel = rows.map(record => ({
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
            
            if (!currentUser || !currentUser.userId) {
                console.log('❌ Usuário inválido para buscar usuários acessíveis');
                return [];
            }
            
            const isHRTDWithFilial = await this.checkHRTDWithFilial(currentUser, pool);
            const directOnly = Boolean(options.directReportsOnly);
            
            if (isHRTDWithFilial && !directOnly) {
                let query = `SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, HierarchyPath as hierarchyPath, Matricula, 'RH_TD_ACCESS' as TipoRelacao FROM Users WHERE IsActive = 1`;
                const params = [];
                
                if (options.department && options.department !== 'Todos') {
                    query += ` AND Departamento = ?`;
                    params.push(options.department);
                }
                query += ` ORDER BY NomeCompleto`;
                
                const [rows] = await pool.execute(query, params);
                
                if (!rows || !Array.isArray(rows)) {
                    console.log('⚠️ Resultado inválido da query RH/TD, retornando array vazio');
                    return [];
                }
                
                return rows.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.Matricula, record.departamento) 
                }));
            }
            
            if (!currentUser.matricula) {
                console.log('⚠️ Usuário sem matrícula, retornando apenas ele mesmo');
                const [rows] = await pool.execute(
                    `SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, HierarchyPath as hierarchyPath, Matricula FROM Users WHERE IsActive = 1 AND Id = ? ORDER BY NomeCompleto`,
                    [currentUser.userId]
                );
                
                if (!rows || !Array.isArray(rows)) {
                    return [];
                }
                
                return rows.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) 
                }));
            }
            
            const [isManagerRows] = await pool.execute(`
                SELECT COUNT(*) as count 
                FROM HIERARQUIA_CC 
                WHERE (RESPONSAVEL_ATUAL = ? OR NIVEL_1_MATRICULA_RESP = ? OR NIVEL_2_MATRICULA_RESP = ? OR NIVEL_3_MATRICULA_RESP = ? OR NIVEL_4_MATRICULA_RESP = ?)
                AND (FILIAL = ? OR (? = '' AND FILIAL IS NULL))
            `, [
                currentUser.matricula, currentUser.matricula, currentUser.matricula, currentUser.matricula, currentUser.matricula,
                currentUser.Filial || currentUser.filial || '', currentUser.Filial || currentUser.filial || ''
            ]);
            
            const isManager = isManagerRows[0].count > 0;
            
            if (isManager) {
                const userFilial = currentUser.Filial || currentUser.filial || '';
                
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
                            h.RESPONSAVEL_ATUAL = ?
                            OR h.NIVEL_1_MATRICULA_RESP = ?
                            OR h.NIVEL_2_MATRICULA_RESP = ?
                            OR h.NIVEL_3_MATRICULA_RESP = ?
                            OR h.NIVEL_4_MATRICULA_RESP = ?
                        )
                        WHERE u.IsActive = 1
                          AND s.STATUS_GERAL = 'ATIVO'
                          AND (TRIM(s.DEPARTAMENTO) = TRIM(h.DEPTO_ATUAL) OR s.MATRICULA = h.RESPONSAVEL_ATUAL)
                          AND (h.FILIAL = ? OR (? = '' AND h.FILIAL IS NULL))

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
                        WHERE u.Matricula = ? AND u.IsActive = 1
                    )
                    SELECT DISTINCT userId, nomeCompleto, departamento, descricaoDepartamento, hierarchyPath, Matricula, TipoRelacao
                    FROM UsuariosAcessiveis
                `;
                
                const params = [
                    currentUser.matricula, currentUser.matricula, currentUser.matricula, currentUser.matricula, currentUser.matricula,
                    userFilial, userFilial, currentUser.matricula
                ];

                if (options.department && options.department !== 'Todos') {
                    query += ` WHERE TRIM(IFNULL(descricaoDepartamento, departamento)) = ? OR TipoRelacao = 'PROPRIO_USUARIO'`;
                    params.push(options.department);
                }

                query += ` ORDER BY nomeCompleto`;

                const [rows] = await pool.execute(query, params);
                 
                if (!rows || !Array.isArray(rows)) {
                    console.log('⚠️ Resultado inválido da query de gestor, retornando array vazio');
                    return [];
                }

                const managerInfo = await this.getManagerHierarchyData(currentUser, pool);

                const filteredRecords = directOnly
                    ? rows.filter(record => this.isDirectSubordinateRecord(record, managerInfo))
                    : rows;

                return filteredRecords.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) 
                }));
            } else {
                const [rows] = await pool.execute(
                    `SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, HierarchyPath as hierarchyPath, Matricula FROM Users WHERE IsActive = 1 AND Id = ? ORDER BY NomeCompleto`,
                    [currentUser.userId]
                );
                
                if (!rows || !Array.isArray(rows)) {
                    console.log('⚠️ Resultado inválido da query de usuário comum, retornando array vazio');
                    return [];
                }
                
                return rows.map(record => ({ 
                    ...record, 
                    hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) 
                }));
            }
        } catch (error) {
            console.error('❌ Erro ao buscar usuários acessíveis:', error);
            return [];
        }
    }

    /**
     * Verifica se o usuário é RH/T&D considerando também a filial
     */
    async checkHRTDWithFilial(currentUser, pool) {
        try {
            const departamento = currentUser.departamento ? currentUser.departamento.toUpperCase() : '';
            const filial = currentUser.Filial || currentUser.filial || '';
            
            const isHRByCode = departamento === '122134101';
            
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
                         
            const isTD = departamento.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
                         departamento.includes('TREINAMENTO') ||
                         departamento.includes('DESENVOLVIMENTO') ||
                         departamento.includes('T&D') ||
                         departamento.includes('TREINAM&DESENVOLV') ||
                         departamento.includes('TREINAM') ||
                         departamento.includes('DESENVOLV') ||
                         departamento.includes('TREINAMENTO E DESENVOLVIMENTO');
            
            if (!isHR && !isTD) {
                return false;
            }
            
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
                const placeholders = uniqueMiddle.map(() => '?').join(', ');

                if (placeholders) {
                    const query = `
                        SELECT DISTINCT TRIM(DEPARTAMENTO) AS codigo
                        FROM TAB_HIST_SRA
                        WHERE STATUS_GERAL = 'ATIVO'
                          AND TRIM(DEPARTAMENTO) IN (${placeholders})
                    `;
                    const [rows] = await pool.execute(query, uniqueMiddle);
                    activeSet = new Set(
                        rows
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
            const [rows] = await pool.execute(
                `SELECT Id as userId, NomeCompleto as nomeCompleto, Departamento as departamento, DescricaoDepartamento as descricaoDepartamento, HierarchyPath as hierarchyPath FROM Users WHERE IsActive = 1 ORDER BY NomeCompleto`
            );
            return rows.map(record => ({ ...record, hierarchyLevel: getHierarchyLevel(record.hierarchyPath, record.userId, record.departamento) }));
        } catch (error) {
            console.error('Erro ao buscar usuários para feedback:', error);
            throw error;
        }
    }

    /**
     * Sincroniza a hierarquia de um utilizador específico.
     * Convertido de Stored Procedure para código Node.js.
     */
    async syncUserHierarchy(userId) {
        try {
            const pool = await this.getPool();
            
            // Buscar dados do usuário
            const [userRows] = await pool.execute(
                `SELECT Id, Matricula, CPF, Departamento FROM Users WHERE Id = ?`,
                [userId]
            );
            
            if (userRows.length === 0) {
                console.log(`⚠️ Usuário ${userId} não encontrado para sincronização`);
                return false;
            }
            
            const user = userRows[0];
            
            // Buscar informações de hierarquia
            const { path, departamento } = await this.getHierarchyInfo(user.Matricula, user.CPF);
            
            // Atualizar usuário com nova hierarquia
            await pool.execute(
                `UPDATE Users SET HierarchyPath = ?, Departamento = ?, updated_at = NOW() WHERE Id = ?`,
                [path, departamento, userId]
            );
            
            console.log(`✅ Hierarquia sincronizada para usuário ${userId}`);
            return true;
        } catch (error) {
            console.error('Erro ao sincronizar hierarquia do usuário:', error);
            throw error;
        }
    }

    /**
     * Sincroniza a hierarquia de todos os utilizadores.
     * Convertido de Stored Procedure para código Node.js.
     */
    async syncAllHierarchies() {
        try {
            const pool = await this.getPool();
            
            // Buscar todos os usuários ativos
            const [users] = await pool.execute(
                `SELECT Id, Matricula, CPF FROM Users WHERE IsActive = 1`
            );
            
            console.log(`🔄 Iniciando sincronização de hierarquia para ${users.length} usuários...`);
            
            let synced = 0;
            for (const user of users) {
                try {
                    await this.syncUserHierarchy(user.Id);
                    synced++;
                } catch (err) {
                    console.warn(`⚠️ Erro ao sincronizar usuário ${user.Id}: ${err.message}`);
                }
            }
            
            console.log(`✅ Sincronização concluída: ${synced}/${users.length} usuários`);
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
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as count, Departamento FROM Users WHERE IsActive = 1 GROUP BY Departamento ORDER BY COUNT(*) DESC`
            );
            return rows;
        } catch (error) {
            console.error('Erro ao buscar estatísticas da hierarquia:', error);
            throw error;
        }
    }

    async getManagerHierarchyData(currentUser, pool) {
        try {
            const [rows] = await pool.execute(
                `SELECT Departamento, HierarchyPath FROM Users WHERE Id = ?`,
                [currentUser.userId]
            );

            if (rows.length > 0) {
                const record = rows[0];
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
