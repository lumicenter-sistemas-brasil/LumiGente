const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { getDatabasePool } = require('../config/db');
const { validarCPF, formatarCPF } = require('../utils/cpfValidator');
const emailService = require('../services/emailService');
const { getRoleIdByName } = require('../services/rolesSetup');

/**
 * GET /api/external-users - Lista todos os usuários externos
 */
exports.getExternalUsers = async (req, res) => {
    try {
        const pool = await getDatabasePool();
        const { status } = req.query; // 'active', 'inactive', ou undefined (todos)
        
        let whereClause = 'WHERE IsExternal = 1';
        if (status === 'active') {
            whereClause += ' AND IsActive = 1';
        } else if (status === 'inactive') {
            whereClause += ' AND IsActive = 0';
        }
        // Se status não for especificado ou for 'all', retorna todos
        
        const [result] = await pool.query(`
            SELECT 
                Id,
                CPF,
                Email,
                NomeCompleto,
                IsActive,
                created_at,
                updated_at
            FROM Users
            ${whereClause}
            ORDER BY IsActive DESC, created_at DESC
        `);
        
        const users = result.map(user => ({
            id: user.Id,
            cpf: formatarCPF(user.CPF),
            email: user.Email || '',
            nomeCompleto: user.NomeCompleto || '',
            isActive: user.IsActive === 1 || user.IsActive === true,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        }));
        
        res.json(users);
    } catch (error) {
        console.error('❌ Erro ao buscar usuários externos:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários externos' });
    }
};

/**
 * GET /api/external-users/:id - Busca um usuário externo específico
 */
exports.getExternalUser = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        const [result] = await pool.query(`
            SELECT 
                Id,
                CPF,
                Email,
                NomeCompleto,
                IsActive,
                created_at,
                updated_at
            FROM Users
            WHERE Id = ? AND IsExternal = 1
        `, [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Usuário externo não encontrado' });
        }
        
        const user = result[0];
        res.json({
            id: user.Id,
            cpf: formatarCPF(user.CPF),
            email: user.Email || '',
            nomeCompleto: user.NomeCompleto || '',
            isActive: user.IsActive === 1 || user.IsActive === true,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        });
    } catch (error) {
        console.error('❌ Erro ao buscar usuário externo:', error);
        res.status(500).json({ error: 'Erro ao buscar usuário externo' });
    }
};

/**
 * POST /api/external-users - Cria um novo usuário externo
 */
exports.createExternalUser = async (req, res) => {
    try {
        const { cpf, nomeCompleto, email, senha, isActive } = req.body;
        
        // Validações
        if (!cpf || !nomeCompleto || !email || !senha) {
            return res.status(400).json({ error: 'CPF, nome completo, email e senha são obrigatórios' });
        }
        
        // Validar CPF
        const cpfLimpo = cpf.replace(/[^\d]/g, '');
        if (!validarCPF(cpfLimpo)) {
            return res.status(400).json({ error: 'CPF inválido' });
        }
        
        // Validar nome completo
        const nomeCompletoTrimmed = nomeCompleto.trim();
        if (nomeCompletoTrimmed.length < 3) {
            return res.status(400).json({ error: 'Nome completo deve ter no mínimo 3 caracteres' });
        }
        
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        
        // Validar senha
        if (senha.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
        }
        
        const pool = await getDatabasePool();
        
        // Verificar se CPF já existe
        const [cpfCheck] = await pool.query(
            'SELECT Id FROM Users WHERE CPF = ?',
            [cpfLimpo]
        );
        
        if (cpfCheck.length > 0) {
            return res.status(400).json({ error: 'CPF já cadastrado' });
        }
        
        // Verificar se email já existe
        const [emailCheck] = await pool.query(
            'SELECT Id FROM Users WHERE Email = ?',
            [email.toLowerCase().trim()]
        );
        
        if (emailCheck.length > 0) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }
        
        // Hash da senha
        const passwordHash = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
        
        // UserName é obrigatório - usar email ou CPF como fallback
        const userName = email.toLowerCase().trim() || cpfLimpo;
        // nome é obrigatório - usar primeiro nome do nomeCompleto
        const primeiroNome = nomeCompletoTrimmed.split(' ')[0] || nomeCompletoTrimmed;
        
        // Buscar RoleId dinamicamente pelo nome 'public'
        const publicRoleId = await getRoleIdByName('public');
        if (!publicRoleId) {
            return res.status(500).json({ error: 'Role "public" não encontrado no sistema' });
        }
        
        const [insertResult] = await pool.query(`
            INSERT INTO Users (CPF, nome, NomeCompleto, Email, PasswordHash, UserName, IsActive, IsExternal, Departamento, DescricaoDepartamento, Filial, RoleId, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'Usuarios Externos', 'USUARIOS EXTERNOS', 'SEM FILIAL', ?, NOW(), NOW())
        `, [cpfLimpo, primeiroNome, nomeCompletoTrimmed, email.toLowerCase().trim(), passwordHash, userName, isActive !== false ? 1 : 0, publicRoleId]);
        
        const newUserId = insertResult.insertId;
        
        // Buscar usuário inserido
        const [newUserResult] = await pool.query(`
            SELECT Id, CPF, Email, NomeCompleto, IsActive FROM Users WHERE Id = ?
        `, [newUserId]);
        
        const newUser = newUserResult[0];
        
        // Enviar email de confirmação
        try {
            await emailService.sendExternalUserConfirmationEmail(
                newUser.Email,
                newUser.CPF,
                newUser.Email.split('@')[0] || 'Usuário'
            );
        } catch (emailError) {
            console.error('⚠️ Erro ao enviar email de confirmação:', emailError);
            // Não falhar o cadastro se o email falhar
        }
        
        res.status(201).json({
            success: true,
            message: 'Usuário externo cadastrado com sucesso',
            user: {
                id: newUser.Id,
                cpf: formatarCPF(newUser.CPF),
                email: newUser.Email,
                nomeCompleto: newUser.NomeCompleto || '',
                isActive: newUser.IsActive === 1 || newUser.IsActive === true
            }
        });
    } catch (error) {
        console.error('❌ Erro ao criar usuário externo:', error);
        console.error('Detalhes do erro:', error.message);
        console.error('Código do erro SQL:', error.code);
        
        // Verificar se é erro de constraint única
        if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate')) {
            return res.status(400).json({ error: 'CPF ou email já cadastrado' });
        }
        
        res.status(500).json({ 
            error: 'Erro ao criar usuário externo',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/external-users/:id - Atualiza um usuário externo
 */
exports.updateExternalUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { nomeCompleto, email, senha, isActive } = req.body;
        
        // Validações
        if (email !== undefined && email !== null && email !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Email inválido' });
            }
        }
        
        if (senha !== undefined && senha !== null && senha !== '') {
            if (senha.length < 6) {
                return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
            }
        }
        
        const pool = await getDatabasePool();
        
        // Verificar se usuário existe e é externo
        const [userCheck] = await pool.query(
            'SELECT Id, Email FROM Users WHERE Id = ? AND IsExternal = 1',
            [id]
        );
        
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'Usuário externo não encontrado' });
        }
        
        const currentUser = userCheck[0];
        
        // Verificar se email já existe (se foi alterado)
        if (email && email.toLowerCase().trim() !== currentUser.Email?.toLowerCase().trim()) {
            const [emailCheck] = await pool.query(
                'SELECT Id FROM Users WHERE Email = ? AND Id != ?',
                [email.toLowerCase().trim(), id]
            );
            
            if (emailCheck.length > 0) {
                return res.status(400).json({ error: 'Email já cadastrado para outro usuário' });
            }
        }
        
        // Construir query de atualização dinamicamente
        const updates = [];
        const params = [];
        
        if (nomeCompleto !== undefined && nomeCompleto !== null && nomeCompleto.trim() !== '') {
            updates.push('NomeCompleto = ?');
            params.push(nomeCompleto.trim());
        }
        
        if (email !== undefined && email !== null && email !== '') {
            updates.push('Email = ?');
            params.push(email.toLowerCase().trim());
        }
        
        if (senha !== undefined && senha !== null && senha !== '') {
            const passwordHash = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
            updates.push('PasswordHash = ?');
            params.push(passwordHash);
        }
        
        if (isActive !== undefined) {
            updates.push('IsActive = ?');
            params.push(isActive !== false ? 1 : 0);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }
        
        updates.push('updated_at = NOW()');
        params.push(id);
        
        await pool.query(`
            UPDATE Users
            SET ${updates.join(', ')}
            WHERE Id = ? AND IsExternal = 1
        `, params);
        
        // Buscar usuário atualizado
        const [updatedResult] = await pool.query(`
            SELECT Id, CPF, Email, NomeCompleto, IsActive
            FROM Users
            WHERE Id = ? AND IsExternal = 1
        `, [id]);
        
        res.json({
            success: true,
            message: 'Usuário externo atualizado com sucesso',
            user: {
                id: updatedResult[0].Id,
                cpf: formatarCPF(updatedResult[0].CPF),
                email: updatedResult[0].Email,
                nomeCompleto: updatedResult[0].NomeCompleto || '',
                isActive: updatedResult[0].IsActive === 1 || updatedResult[0].IsActive === true
            }
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar usuário externo:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário externo' });
    }
};

/**
 * DELETE /api/external-users/:id - Desativa um usuário externo (exclusão lógica)
 */
exports.deleteExternalUser = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        // Verificar se usuário existe e é externo
        const [userCheck] = await pool.query(
            'SELECT Id, CPF, Email, NomeCompleto, IsActive FROM Users WHERE Id = ? AND IsExternal = 1',
            [id]
        );
        
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'Usuário externo não encontrado' });
        }
        
        const user = userCheck[0];
        
        // Verificar se já está inativo
        if (user.IsActive === 0 || user.IsActive === false) {
            return res.status(400).json({ error: 'Usuário externo já está inativo' });
        }
        
        // Fazer exclusão lógica (desativar o usuário)
        await pool.query(`
            UPDATE Users 
            SET IsActive = 0, updated_at = NOW() 
            WHERE Id = ? AND IsExternal = 1
        `, [id]);
        
        res.json({
            success: true,
            message: 'Usuário externo desativado com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao desativar usuário externo:', error);
        res.status(500).json({ 
            error: 'Erro ao desativar usuário externo',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/external-users/:id/activate - Reativa um usuário externo
 */
exports.activateExternalUser = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        // Verificar se usuário existe e é externo
        const [userCheck] = await pool.query(
            'SELECT Id, CPF, Email, NomeCompleto, IsActive FROM Users WHERE Id = ? AND IsExternal = 1',
            [id]
        );
        
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'Usuário externo não encontrado' });
        }
        
        const user = userCheck[0];
        
        // Verificar se já está ativo
        if (user.IsActive === 1 || user.IsActive === true) {
            return res.status(400).json({ error: 'Usuário externo já está ativo' });
        }
        
        // Reativar o usuário
        await pool.query(`
            UPDATE Users 
            SET IsActive = 1, updated_at = NOW() 
            WHERE Id = ? AND IsExternal = 1
        `, [id]);
        
        res.json({
            success: true,
            message: 'Usuário externo reativado com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao reativar usuário externo:', error);
        res.status(500).json({ 
            error: 'Erro ao reativar usuário externo',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
