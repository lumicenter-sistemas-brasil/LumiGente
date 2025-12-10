// LumiGente-main/services/authService.js

const bcrypt = require('bcrypt');
const { getDatabasePool } = require('../config/db');
const { validarCPF, formatarCPF } = require('../utils/cpfValidator');
const { getHierarchyLevel } = require('../utils/hierarchyHelper');
const HierarchyManager = require('./hierarchyManager');

const hierarchyManager = new HierarchyManager();

// Função para calcular nível hierárquico baseado APENAS no banco de dados
async function calculateHierarchyLevel(user, pool) {
    try {
        // Verificar se é responsável na HIERARQUIA_CC
        const [rows] = await pool.execute(`
            SELECT DEPTO_ATUAL, HIERARQUIA_COMPLETA
            FROM HIERARQUIA_CC 
            WHERE RESPONSAVEL_ATUAL = ? 
            AND (FILIAL = ? OR ? = '' OR FILIAL IS NULL)
        `, [user.Matricula, user.Filial || '', user.Filial || '']);
        
        if (rows.length > 0) {
            const detalhe = rows[0];
            const departments = detalhe.HIERARQUIA_COMPLETA.split('>').map(d => d.trim()).filter(d => d.length > 0);
            const departamentoIndex = departments.indexOf(detalhe.DEPTO_ATUAL);
            
            if (departamentoIndex !== -1) {
                const nivel = departamentoIndex + 1;
                return Math.max(1, Math.min(4, nivel));
            }
        }
        
        return 1;
        
    } catch (error) {
        console.error('Erro ao calcular nível hierárquico:', error);
        return 1; // Funcionário comum em caso de erro
    }
}

/**
 * Lógica de negócio para realizar o login de um usuário.
 */
exports.loginUser = async (cpf, password) => {
    if (!cpf || !password || !validarCPF(cpf)) {
        throw new Error('CPF inválido ou senha não fornecida');
    }

    const cpfSemFormatacao = cpf.replace(/[^\d]/g, '');
    const cpfFormatado = formatarCPF(cpf);

    const pool = await getDatabasePool();

    // 1. Primeiro, busca o usuário no sistema LumiGente para verificar se é externo
    const [userRows] = await pool.execute(
        `SELECT * FROM Users WHERE CPF = ? OR CPF = ?`,
        [cpfFormatado, cpfSemFormatacao]
    );

    let user = userRows[0];

    if (!user) {
        throw new Error('Usuário não encontrado no sistema.');
    }

    // 2. Se for usuário externo, trata de forma diferente
    if (user.IsExternal === 1 || user.IsExternal === true) {
        // Verifica status do usuário externo
        if (!user.IsActive) {
            throw new Error('Usuário inativo. Entre em contato com o administrador.');
        }
        if (!user.PasswordHash) {
            throw new Error('Senha não configurada. Por favor, complete o seu registro.');
        }

        // Compara a senha
        const senhaValida = await bcrypt.compare(password, user.PasswordHash);
        if (!senhaValida) {
            throw new Error('Senha incorreta');
        }

        // Atualiza o último login
        try {
            await pool.execute(`UPDATE Users SET LastLogin = NOW() WHERE Id = ?`, [user.Id]);
        } catch (err) {
            console.warn("Aviso: Coluna 'LastLogin' não encontrada. Continuando...");
        }

            // Retorna dados do usuário externo (sem hierarquia, matrícula, etc.)
            console.log(`[AUTH] Login externo: ${user.NomeCompleto || user.Email || 'Sem nome'}`);

            // Calcular permissões para usuário externo
            const { getAllPermissions } = require('../utils/permissionsHelper');
            const externalUser = {
                userId: user.Id,
                userName: user.UserName || user.Email,
                role: 'Usuário Externo',
                nomeCompleto: user.NomeCompleto || user.Email || 'Usuário Externo',
                nome: (user.NomeCompleto || user.Email || 'Usuário').split(' ')[0],
                departamento: null,
                descricaoDepartamento: null,
                DescricaoDepartamento: null,
                filial: null,
                cpf: cpfFormatado,
                matricula: null,
                hierarchyLevel: 1,
                hierarchyPath: null,
                email: user.Email || null,
                isExternal: true
            };
            const permissions = getAllPermissions(externalUser);

            return {
                ...externalUser,
                _cachedPermissions: permissions
            };
    }

    // 3. Se não for externo, continua com o fluxo normal de funcionário
    // Busca o funcionário mais recente na base de dados externa
    const [funcionarioRows] = await pool.execute(`
        SELECT * FROM (
            SELECT *, ROW_NUMBER() OVER (ORDER BY 
                    CASE WHEN STATUS_GERAL = 'ATIVO' THEN 0 ELSE 1 END,
                    DTA_ADMISSAO DESC, MATRICULA DESC
                ) as rn
            FROM TAB_HIST_SRA WHERE CPF = ?
        ) AS FuncionarioMaisRecente
        WHERE rn = 1
        LIMIT 1
    `, [cpfSemFormatacao]);

    const funcionario = funcionarioRows[0];
    if (!funcionario) {
        throw new Error('CPF não encontrado na base de funcionários');
    }

    // 4. Verifica se é um usuário especial ou se está ativo
    const specialCPFs = process.env.SPECIAL_USERS_CPF ? process.env.SPECIAL_USERS_CPF.split(',').map(c => c.trim()) : [];
    const isSpecialUser = specialCPFs.includes(cpfSemFormatacao);

    if (funcionario.STATUS_GERAL !== 'ATIVO' && !isSpecialUser) {
        throw new Error('Funcionário inativo no sistema');
    }

    // 5. Verifica status do usuário no sistema LumiGente
    if (user.FirstLogin === 1 || user.FirstLogin === true) {
        return { needsRegistration: true, error: 'Você ainda não possui registro. Crie uma conta primeiro.' };
    }
    if (!user.IsActive) {
        throw new Error('Usuário inativo. Entre em contato com o administrador.');
    }
    if (!user.PasswordHash) {
        throw new Error('Senha não configurada. Por favor, complete o seu registro.');
    }

    // 6. Compara a senha
    const senhaValida = await bcrypt.compare(password, user.PasswordHash);
    if (!senhaValida) {
        throw new Error('Senha incorreta');
    }

    // 7. Sincroniza dados do usuário (se necessário)
    const { path: hierarchyPath, departamento: deptoHierarchy } = await hierarchyManager.getHierarchyInfo(funcionario.MATRICULA, funcionario.CPF);
    const departamentoCorreto = deptoHierarchy || funcionario.DEPARTAMENTO;

    if (user.Matricula !== funcionario.MATRICULA || user.Departamento !== departamentoCorreto || user.HierarchyPath !== hierarchyPath || user.Filial !== funcionario.FILIAL) {
        await pool.execute(`
            UPDATE Users SET Matricula = ?, NomeCompleto = ?, Departamento = ?, 
            HierarchyPath = ?, Filial = ?, updated_at = NOW()
            WHERE Id = ?
        `, [funcionario.MATRICULA, funcionario.NOME, departamentoCorreto, hierarchyPath, funcionario.FILIAL, user.Id]);
        
        // Atualiza o objeto user para a sessão
        user.Matricula = funcionario.MATRICULA;
        user.NomeCompleto = funcionario.NOME;
        user.Departamento = departamentoCorreto;
        user.HierarchyPath = hierarchyPath;
        user.Filial = funcionario.FILIAL;
    }

    // 8. Atualiza o último login
    try {
        await pool.execute(`UPDATE Users SET LastLogin = NOW() WHERE Id = ?`, [user.Id]);
    } catch (err) {
        console.warn("Aviso: Coluna 'LastLogin' não encontrada. Continuando...");
    }

    // 9. Monta e retorna o objeto do usuário para a sessão
    const hierarchyLevel = await calculateHierarchyLevel(user, pool);
    
    // Determinar role baseado em ser gestor real
    const { getAllPermissions } = require('../utils/permissionsHelper');
    const tempUser = { ...user, hierarchyLevel, departamento: user.Departamento };
    const permissions = getAllPermissions(tempUser);
    const role = permissions.managerType || 'Funcionário';
    
    console.log(`[AUTH] Login: ${user.NomeCompleto.trim()} | ${role} | Nível ${hierarchyLevel}`);

    return {
        userId: user.Id,
        userName: user.UserName,
        role: role,
        nomeCompleto: user.NomeCompleto,
        nome: user.NomeCompleto.split(' ')[0],
        departamento: user.Departamento,
        descricaoDepartamento: user.DescricaoDepartamento || user.descricaoDepartamento || null,
        DescricaoDepartamento: user.DescricaoDepartamento || user.descricaoDepartamento || null,
        filial: user.Filial,
        cpf: cpfFormatado,
        matricula: user.Matricula,
        hierarchyLevel: hierarchyLevel,
        hierarchyPath: user.HierarchyPath,
        email: user.Email || null,
        _cachedPermissions: permissions // Cache para evitar recalcular
    };
};

/**
 * Lógica de negócio para registrar um novo usuário.
 */
exports.registerUser = async ({ cpf, password, nomeCompleto }) => {
    if (!cpf || !password || !validarCPF(cpf) || password.length < 6) {
        throw new Error('Dados de registro inválidos.');
    }

    const cpfSemFormatacao = cpf.replace(/[^\d]/g, '');
    const cpfFormatado = formatarCPF(cpf);
    const pool = await getDatabasePool();

    const [existingUserRows] = await pool.execute(
        `SELECT Id, FirstLogin, NomeCompleto FROM Users WHERE CPF = ? OR CPF = ?`,
        [cpfFormatado, cpfSemFormatacao]
    );

    if (existingUserRows.length === 0) {
        throw new Error('CPF não encontrado no sistema para registro.');
    }

    const existingUser = existingUserRows[0];
    if (existingUser.FirstLogin === 0 || existingUser.FirstLogin === false) {
        throw new Error('Usuário já possui registro realizado.');
    }

    const senhaHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
    const nomeParaUsar = nomeCompleto || existingUser.NomeCompleto;

    await pool.execute(`
        UPDATE Users SET PasswordHash = ?, FirstLogin = 0, NomeCompleto = ?, 
        nome = ?, IsActive = 1, updated_at = NOW()
        WHERE Id = ?
    `, [senhaHash, nomeParaUsar, nomeParaUsar.split(' ')[0], existingUser.Id]);

    return { success: true, message: 'Registro realizado com sucesso' };
};

/**
 * Lógica de negócio para verificar o status de um CPF.
 */
exports.checkCpfStatus = async (cpf) => {
    if (!cpf || !validarCPF(cpf)) {
        throw new Error('CPF inválido');
    }

    const cpfSemFormatacao = cpf.replace(/[^\d]/g, '');
    const cpfFormatado = formatarCPF(cpf);
    const pool = await getDatabasePool();
    
    // Verifica se o CPF existe na tabela Users
    const [userRows] = await pool.execute(
        `SELECT Id, FirstLogin FROM Users WHERE CPF = ? OR CPF = ?`,
        [cpfFormatado, cpfSemFormatacao]
    );

    if (userRows.length === 0) {
        // CPF não existe na base de usuários
        return { exists: false, message: 'CPF não encontrado na base de funcionários' };
    }
    
    const user = userRows[0];
    
    // Se FirstLogin = 0, usuário já completou o registro
    if (user.FirstLogin === 0 || user.FirstLogin === false) {
        return { exists: true, message: 'CPF já cadastrado no sistema' };
    }
    
    // Se FirstLogin = 1, usuário pode completar o registro
    return { exists: false, message: 'CPF válido para registro' };
};
