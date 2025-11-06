const sql = require('mssql');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getDatabasePool } = require('../config/db');
const HierarchyManager = require('../services/hierarchyManager');
const { getAllPermissions } = require('../utils/permissionsHelper');

/**
 * Invalida todas as sessões de um usuário.
 * @param {number} userId - ID do usuário
 * @param {object} req - Objeto de requisição do Express
 * @returns {Promise<void>}
 */
const invalidateUserSessions = async (userId, req) => {
    try {
        const store = req.sessionStore;
        if (!store || typeof store.all !== 'function' || typeof store.destroy !== 'function') {
            console.warn('⚠️ Store de sessão não suporta varredura para invalidar sessões.');
            return;
        }
        await new Promise((resolve) => {
            store.all((err, sessions) => {
                if (err || !sessions) return resolve();
                const entries = Object.entries(sessions);
                for (const [sid, sess] of entries) {
                    const sUserId = sess && sess.user && sess.user.userId;
                    if (sUserId === userId) {
                        try { store.destroy(sid, () => {}); } catch (_) {}
                    }
                }
                resolve();
            });
        });
    } catch (e) {
        console.warn('⚠️ Falha ao invalidar sessões do usuário:', e.message);
    }
};

// Instancia o HierarchyManager para ser usado no controller
const hierarchyManager = new HierarchyManager();


// =================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO
// =================================================================

/**
 * Verifica se um usuário é gestor baseado na tabela HIERARQUIA_CC.
 * @param {object} user - O objeto do usuário da sessão.
 * @returns {Promise<boolean>} - True se for gestor, false caso contrário.
 */
async function isUserManager(user) {
    try {
        const pool = await getDatabasePool();
        console.log(`🔍 Verificando se usuário é gestor: CPF = ${user.CPF}`);

        // Verificar se o usuário aparece como CPF_RESPONSAVEL (gestor direto)
        const directManagerResult = await pool.request()
            .input('cpf', sql.VarChar, user.CPF)
            .query(`SELECT COUNT(*) as count FROM HIERARQUIA_CC WHERE CPF_RESPONSAVEL = @cpf`);
        
        const isDirectManager = directManagerResult.recordset[0].count > 0;

        // Verificar se o usuário está em um nível superior da hierarquia
        const userDeptResult = await pool.request()
            .input('departamento', sql.VarChar, user.Departamento || user.departamento)
            .query(`SELECT DISTINCT HIERARQUIA_COMPLETA FROM HIERARQUIA_CC WHERE DEPTO_ATUAL = @departamento`);

        let isUpperManager = false;
        if (userDeptResult.recordset.length > 0) {
            const userHierarchy = userDeptResult.recordset[0].HIERARQUIA_COMPLETA;
            const subordinatesResult = await pool.request()
                .input('hierarquia', sql.VarChar, `%${userHierarchy}%`)
                .input('departamento', sql.VarChar, user.Departamento || user.departamento)
                .query(`SELECT COUNT(*) as count FROM HIERARQUIA_CC WHERE HIERARQUIA_COMPLETA LIKE @hierarquia AND DEPTO_ATUAL != @departamento`);
            
            if (subordinatesResult.recordset[0].count > 0) {
                isUpperManager = true;
            }
        }

        return isDirectManager || isUpperManager;
    } catch (error) {
        console.error('Erro ao verificar se usuário é gestor:', error);
        return false;
    }
}

/**
 * Obtém informações detalhadas da hierarquia de um gestor.
 * @param {object} user - O objeto do usuário da sessão.
 * @returns {Promise<Array>} - Um array com os departamentos gerenciados.
 */
async function getUserHierarchyInfo(user) {
    try {
        const pool = await getDatabasePool();
        
        // Departamentos onde é responsável direto
        const directResult = await pool.request()
            .input('cpf', sql.VarChar, user.CPF)
            .query(`SELECT *, 'DIRETO' as TIPO_GESTAO FROM HIERARQUIA_CC WHERE CPF_RESPONSAVEL = @cpf`);

        let allManagedDepts = [...directResult.recordset];
        
        // Departamentos subordinados
        const userDept = user.Departamento || user.departamento;
        if (userDept) {
            const subordinatesResult = await pool.request()
                .input('departamento', sql.VarChar, userDept)
                .query(`SELECT *, 'HIERARQUIA' as TIPO_GESTAO FROM HIERARQUIA_CC WHERE HIERARQUIA_COMPLETA LIKE '%' + @departamento + '%' AND DEPTO_ATUAL != @departamento`);
            
            for (const subDept of subordinatesResult.recordset) {
                if (!allManagedDepts.some(d => d.DEPTO_ATUAL === subDept.DEPTO_ATUAL)) {
                    allManagedDepts.push(subDept);
                }
            }
        }

        allManagedDepts.sort((a, b) => b.HIERARQUIA_COMPLETA.length - a.HIERARQUIA_COMPLETA.length);
        return allManagedDepts;
    } catch (error) {
        console.error('Erro ao buscar informações hierárquicas:', error);
        return [];
    }
}

/**
 * Determina as permissões de acesso às abas da interface com base no departamento e hierarquia.
 * Adaptado do server1.js para manter compatibilidade com o sistema de controle de acesso.
 * @param {object} user - O objeto do usuário da sessão.
 * @returns {Promise<object>} - Um objeto com as permissões.
 */
async function getUserTabPermissions(user) {
    // Usar permissões cacheadas se disponíveis
    if (user._cachedPermissions) {
        return user._cachedPermissions;
    }
    return getAllPermissions(user);
}


// =================================================================
// CONTROLLERS (Funções exportadas para as rotas)
// =================================================================

/**
 * GET /api/usuario - Retorna os dados do usuário logado na sessão.
 */
exports.getCurrentUser = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Sincroniza email da sessão com o banco para refletir reversões realizadas via link externo
        try {
            const pool = await getDatabasePool();
            const result = await pool.request()
                .input('userId', sql.Int, req.session.user.userId)
                .query('SELECT Email FROM Users WHERE Id = @userId');

            if (result.recordset.length > 0) {
                const currentEmail = result.recordset[0].Email;
                if (currentEmail && currentEmail !== req.session.user.email) {
                    req.session.user.email = currentEmail;
                }
            }
        } catch (syncErr) {
            console.warn('⚠️ Não foi possível sincronizar email da sessão:', syncErr.message);
        }

        return res.json(req.session.user);
    } catch (e) {
        console.error('Erro em getCurrentUser:', e);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/usuario/permissions - Retorna as permissões de abas e hierarquia do usuário.
 */
exports.getUserPermissions = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        
        const permissions = await getUserTabPermissions(user);
        const hierarchyInfo = permissions.isManager ? await getUserHierarchyInfo(user) : [];
        const hierarchyLevel = user.hierarchyLevel || 1;

        res.json({
            success: true,
            user: {
                nome: user.nome || user.nomeCompleto || user.userName || 'Usuário',
                departamento: user.departamento || 'N/A',
                hierarchyLevel: hierarchyLevel,
                role: user.role || 'Funcionário',
                matricula: user.matricula || 'N/A'
            },
            permissions,
            hierarchy: {
                ...permissions,
                hierarchyLevel: hierarchyLevel,
                managedDepartments: hierarchyInfo.map(h => h.DEPTO_ATUAL),
                hierarchyPaths: hierarchyInfo.map(h => h.HIERARQUIA_COMPLETA)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar permissões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/usuario/debug/hierarchy - Debug do cálculo de hierarquia
 */
exports.debugHierarchy = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        
        const { getHierarchyLevel } = require('../utils/hierarchyHelper');
        
        // Calcular nível hierárquico
        const hierarchyLevel = getHierarchyLevel(user.HierarchyPath, user.Matricula, user.Departamento);
        
        // Determinar role
        let role = 'Funcionário';
        if (hierarchyLevel >= 4) role = 'Diretor';
        else if (hierarchyLevel >= 3) role = 'Gerente';
        else if (hierarchyLevel >= 2) role = 'Coordenador';
        
        // Verificar se é RH ou T&D
        const { isHR, isTD } = require('../utils/permissionsHelper').checkHRTDPermissions(user);
        
        const response = {
            success: true,
            debug: {
                user: {
                    nome: user.nomeCompleto || user.nome || 'Usuário',
                    matricula: user.Matricula || user.matricula,
                    departamento: user.Departamento || user.departamento,
                    hierarchyPath: user.HierarchyPath || user.hierarchyPath,
                    hierarchyLevel: hierarchyLevel,
                    role: role
                },
                calculation: {
                    pathLength: user.HierarchyPath ? user.HierarchyPath.split('>').length : 0,
                    departments: user.HierarchyPath ? user.HierarchyPath.split('>').map(d => d.trim()) : [],
                    isHR: isHR,
                    isTD: isTD,
                    isManager: hierarchyLevel >= 3,
                    isDirector: hierarchyLevel >= 4
                },
                permissions: {
                    analytics: hierarchyLevel >= 3 || isHR || isTD,
                    pesquisas: isHR || isTD,
                    avaliacoes: hierarchyLevel >= 3,
                    historico: hierarchyLevel >= 3 || isHR || isTD,
                    team: hierarchyLevel >= 3
                }
            }
        };
        
        console.log('🔍 Debug de hierarquia:', response.debug);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erro no debug de hierarquia:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/users - Lista usuários com base na hierarquia e filtros.
 */
exports.getUsers = async (req, res) => {
    try {
        const currentUser = req.session.user;
        const { search, department, hierarchyLevel } = req.query;

        console.log('🔍 Buscando usuários acessíveis para:', currentUser.nomeCompleto);
        console.log('📋 Parâmetros:', { search, department, hierarchyLevel });

        const accessibleUsers = await hierarchyManager.getAccessibleUsers(currentUser, {
            search,
            department,
            hierarchyLevel: hierarchyLevel ? parseInt(hierarchyLevel) : null
        });

        console.log('✅ Usuários encontrados:', accessibleUsers.length);
        res.json(accessibleUsers);
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        
        // Fallback: retornar apenas o usuário atual se houver erro
        const currentUser = req.session.user;
        if (currentUser) {
            console.log('🔄 Usando fallback: retornando apenas usuário atual');
            res.json([{
                userId: currentUser.userId,
                nomeCompleto: currentUser.nomeCompleto,
                departamento: currentUser.departamento,
                hierarchyLevel: currentUser.hierarchyLevel || 0,
                Matricula: currentUser.matricula
            }]);
        } else {
            res.status(500).json({ error: 'Erro ao buscar usuários' });
        }
    }
};

/**
 * GET /api/users/feedback - Lista todos os usuários ativos para seleção em feedbacks, sem restrição de hierarquia.
 */
exports.getUsersForFeedback = async (req, res) => {
    try {
        const users = await hierarchyManager.getUsersForFeedback();
        res.json(users);
    } catch (error) {
        console.error('Erro ao buscar usuários para feedback:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/subordinates - Lista os subordinados diretos do gestor logado.
 */
exports.getSubordinates = async (req, res) => {
    try {
        const currentUser = req.session.user;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('matricula', sql.VarChar, currentUser.matricula)
            .input('cpf', sql.VarChar, currentUser.cpf)
            .query(`
                SELECT u.Id, u.NomeCompleto, u.Departamento, u.HierarchyPath, u.Matricula, u.CPF, u.LastLogin
                FROM Users u
                JOIN HIERARQUIA_CC h ON u.Matricula = h.RESPONSAVEL_ATUAL AND u.CPF = h.CPF_RESPONSAVEL
                WHERE h.RESPONSAVEL_ATUAL = @matricula AND h.CPF_RESPONSAVEL = @cpf AND u.IsActive = 1
                ORDER BY u.NomeCompleto
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar subordinados:', error);
        res.status(500).json({ error: 'Erro ao buscar subordinados' });
    }
};

/**
 * PUT /api/usuario/profile - Atualiza o perfil do usuário logado.
 */
exports.updateProfile = async (req, res) => {
    try {
        const { nomeCompleto, nome, departamento } = req.body;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('nomeCompleto', sql.VarChar, nomeCompleto)
            .input('nome', sql.VarChar, nome)
            .input('departamento', sql.VarChar, departamento)
            .query(`
                UPDATE Users SET NomeCompleto = @nomeCompleto, nome = @nome, Departamento = @departamento, updated_at = GETDATE()
                WHERE Id = @userId
            `);
        
        // Atualizar sessão
        req.session.user.nomeCompleto = nomeCompleto;
        req.session.user.nome = nome;
        req.session.user.departamento = departamento;

        res.json({ success: true, message: 'Perfil atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
};

/**
 * PUT /api/usuario/password - Inicia o processo de alteração de senha com verificação e reversão
 */
exports.initiatePasswordChange = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.user.userId;

        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Dados inválidos para alteração de senha.' });
        }

        const pool = await getDatabasePool();
        console.log('🔍 Buscando informações do usuário para troca de senha...');
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    PasswordHash,
                    Email,
                    PreviousEmail,
                    NomeCompleto,
                    LastLogin,
                    LastPasswordChange
                FROM Users 
                WHERE Id = @userId
            `);
        
        console.log('📧 Emails do usuário:', {
            Email: userResult.recordset[0]?.Email,
            PreviousEmail: userResult.recordset[0]?.PreviousEmail
        });
        
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        const user = userResult.recordset[0];

        // Verificar se há um processo de alteração em andamento
        if (user.PendingPasswordHash) {
            return res.status(400).json({ error: 'Já existe uma alteração de senha pendente. Aguarde ou cancele a alteração anterior.' });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.PasswordHash);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Senha atual incorreta' });
        }

        // Verifica se há pelo menos um email cadastrado (atual ou anterior)
        if (!user.Email && !user.PreviousEmail) {
            return res.status(400).json({ error: 'É necessário ter pelo menos um email cadastrado para alterar a senha' });
        }

        // Gerar token de verificação e hash da nova senha
        const token = crypto.randomInt(100000, 999999).toString();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const newPasswordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
        
        // Token JWT para verificação
        const jwt = require('jsonwebtoken');
        const verifyExpiresIn = process.env.JWT_PASSWORD_CHANGE_EXPIRES_IN || '2m';
        const verifyExpiresInMs = verifyExpiresIn.endsWith('m') ? parseInt(verifyExpiresIn) * 60 * 1000 : parseInt(verifyExpiresIn) * 1000;
        const verifyToken = jwt.sign({ userId, tokenHash }, process.env.JWT_SECRET, { expiresIn: verifyExpiresIn });

        // Token de cancelamento
        const cancelTokenRaw = crypto.randomBytes(24).toString('hex');
        const cancelExpiresIn = process.env.JWT_PASSWORD_CHANGE_CANCEL_EXPIRES_IN || '1d';
        const cancelExpiresInMs = (() => {
            const v = parseInt(cancelExpiresIn);
            if (Number.isNaN(v)) return 24 * 60 * 60 * 1000; // fallback 1d
            if (cancelExpiresIn.endsWith('d')) return v * 24 * 60 * 60 * 1000;
            if (cancelExpiresIn.endsWith('h')) return v * 60 * 60 * 1000;
            if (cancelExpiresIn.endsWith('m')) return v * 60 * 1000;
            return v * 1000; // assume segundos
        })();
        const cancelJwt = jwt.sign({ userId, token: cancelTokenRaw }, process.env.JWT_SECRET, { expiresIn: cancelExpiresIn });

        // Salvar as informações no banco
        console.log('🔄 Salvando informações de alteração de senha para o usuário:', {
            userId,
            hasNewHash: !!newPasswordHash,
            hasVerifyToken: !!verifyToken,
            hasCancelToken: !!cancelJwt,
            expiresIn: verifyExpiresIn,
            cancelExpiresIn
        });

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('pendingHash', sql.VarChar, newPasswordHash)
            .input('token', sql.VarChar, verifyToken)
            .input('expiresAt', sql.DateTime, new Date(Date.now() + verifyExpiresInMs))
            .input('cancelToken', sql.VarChar, cancelJwt)
            .input('cancelExpires', sql.DateTime, new Date(Date.now() + cancelExpiresInMs))
            .query(`
                UPDATE Users 
                SET PendingPasswordHash = @pendingHash,
                    PasswordChangeToken = @token,
                    PasswordChangeExpires = @expiresAt,
                    PasswordChangeCancelToken = @cancelToken,
                    PasswordChangeCancelExpires = @cancelExpires,
                    updated_at = GETDATE()
                WHERE Id = @userId
            `);
            
        console.log('✅ Informações de alteração de senha salvas com sucesso');

        // Enviar emails para todos os endereços associados ao usuário
        const emailService = require('../services/emailService');
        try {
            console.log('📧 Iniciando envio de emails para:', {
                userId: userId,
                emailAtual: user.Email,
                emailAnterior: user.PreviousEmail
            });

            // 1. Email atual recebe APENAS o token de verificação
            await emailService.sendPasswordResetEmail(user.Email, token, user.NomeCompleto);
            console.log(`✉️ Token de verificação enviado para: ${user.Email}`);

            // 2. Email anterior recebe APENAS o alerta de cancelamento
            if (user.PreviousEmail) {
                console.log('📧 Tentando enviar alerta para email anterior:', {
                    previousEmail: user.PreviousEmail,
                    hasToken: !!cancelJwt,
                    tokenLength: cancelJwt ? cancelJwt.length : 0,
                    userName: user.NomeCompleto,
                    APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3057'
                });

                try {
                    // Forçar 1 segundo de espera para garantir que o email anterior seja enviado após o principal
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    await emailService.sendPasswordChangeAlert(user.PreviousEmail, cancelJwt, user.NomeCompleto);
                    console.log(`✅ Alerta de cancelamento enviado com sucesso para: ${user.PreviousEmail}`);
                } catch (alertError) {
                    console.error('❌ Erro ao enviar alerta para email anterior:', {
                        error: alertError.message,
                        stack: alertError.stack,
                        previousEmail: user.PreviousEmail,
                        smtpConfig: {
                            host: process.env.SMTP_HOST,
                            port: process.env.SMTP_PORT,
                            user: process.env.EMAIL_USER?.substring(0, 5) + '...'
                        }
                    });
                    throw alertError;
                }
            } else {
                console.log('⚠️ Usuário não possui email anterior cadastrado');
            }

            res.json({ 
                success: true, 
                message: 'Emails enviados com sucesso.' 
            });
        } catch (error) {
            console.error('❌ Erro no envio de emails:', error);
            res.status(500).json({ error: 'Erro ao enviar email. Tente novamente.' });
        }
    } catch (error) {
        console.error('Erro ao iniciar alteração de senha:', error);
        res.status(500).json({ error: 'Erro ao iniciar alteração de senha' });
    }
};

/**
 * POST /api/usuario/verify-password-change - Verifica token e confirma alteração de senha
 */
exports.verifyPasswordChange = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        
        // Buscar informações do usuário
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT PendingPasswordHash, PasswordChangeToken, PasswordChangeExpires, PasswordHash, 
                       Email, PreviousEmail, NomeCompleto
                FROM Users WHERE Id = @userId
            `);
        
        if (result.recordset.length === 0 || !result.recordset[0].PasswordChangeToken) {
            return res.status(400).json({ error: 'Token inválido' });
        }
        
        const user = result.recordset[0];
        if (new Date() > new Date(user.PasswordChangeExpires)) {
            return res.status(400).json({ error: 'Token expirado' });
        }
        
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(user.PasswordChangeToken, process.env.JWT_SECRET);
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            if (decoded.tokenHash === tokenHash) {
                // Gerar token de reversão (válido por 7 dias)
                const revertTokenRaw = crypto.randomBytes(32).toString('hex');
                const revertExpiresIn = process.env.JWT_PASSWORD_REVERT_EXPIRES_IN || '7d';
                const revertExpiresInMs = (() => {
                    const v = parseInt(revertExpiresIn);
                    if (Number.isNaN(v)) return 7 * 24 * 60 * 60 * 1000; // fallback 7d
                    if (revertExpiresIn.endsWith('d')) return v * 24 * 60 * 60 * 1000;
                    if (revertExpiresIn.endsWith('h')) return v * 60 * 60 * 1000;
                    if (revertExpiresIn.endsWith('m')) return v * 60 * 1000;
                    return v * 1000; // assume segundos
                })();
                const revertJwt = jwt.sign({ userId, token: revertTokenRaw }, process.env.JWT_SECRET, { expiresIn: revertExpiresIn });

                console.log('🔄 Confirmando alteração de senha e gerando token de reversão:', {
                    userId,
                    hasRevertToken: !!revertJwt,
                    revertExpiresIn
                });

                // Mover senha atual para histórico e aplicar nova senha
                // Armazenar token de reversão em PasswordRevertToken
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('oldHash', sql.VarChar, user.PasswordHash)
                    .input('newHash', sql.VarChar, user.PendingPasswordHash)
                    .input('revertToken', sql.VarChar, revertJwt)
                    .input('revertExpires', sql.DateTime, new Date(Date.now() + revertExpiresInMs))
                    .query(`
                        UPDATE Users 
                        SET PreviousPasswordHash = PasswordHash,
                            PasswordHash = PendingPasswordHash,
                            PendingPasswordHash = NULL,
                            PasswordChangeToken = NULL,
                            PasswordChangeExpires = NULL,
                            PasswordChangeCancelToken = NULL,
                            PasswordChangeCancelExpires = NULL,
                            PasswordRevertToken = @revertToken,
                            PasswordRevertExpires = @revertExpires,
                            LastPasswordChange = GETDATE(),
                            updated_at = GETDATE()
                        WHERE Id = @userId
                    `);

                console.log('✅ Senha alterada com sucesso. Enviando emails de confirmação...');

                // Enviar email de confirmação para AMBOS os emails (atual e anterior)
                const emailService = require('../services/emailService');
                const emailPromises = [];

                // Email atual
                if (user.Email) {
                    console.log(`📧 Preparando envio para email atual: ${user.Email}`);
                    emailPromises.push(
                        emailService.sendPasswordChangeConfirmationAlert(user.Email, revertJwt, user.NomeCompleto)
                            .then(() => console.log(`✅ Email de confirmação enviado para email atual: ${user.Email}`))
                            .catch(err => {
                                console.error(`❌ Erro ao enviar para email atual: ${user.Email}`, err);
                                return { success: false, email: user.Email, error: err.message };
                            })
                    );
                } else {
                    console.log('⚠️ Email atual não está cadastrado');
                }

                // Email anterior (do campo PreviousEmail)
                if (user.PreviousEmail && user.PreviousEmail !== user.Email) {
                    console.log(`📧 Preparando envio para email anterior: ${user.PreviousEmail}`);
                    emailPromises.push(
                        emailService.sendPasswordChangeConfirmationAlert(user.PreviousEmail, revertJwt, user.NomeCompleto)
                            .then(() => console.log(`✅ Email de confirmação enviado para email anterior: ${user.PreviousEmail}`))
                            .catch(err => {
                                console.error(`❌ Erro ao enviar para email anterior: ${user.PreviousEmail}`, err);
                                return { success: false, email: user.PreviousEmail, error: err.message };
                            })
                    );
                } else if (!user.PreviousEmail) {
                    console.log('⚠️ PreviousEmail não está cadastrado (campo vazio/null)');
                } else if (user.PreviousEmail === user.Email) {
                    console.log('⚠️ PreviousEmail é igual ao Email atual (não enviar duplicado)');
                }

                // AGUARDAR o envio dos emails antes de continuar
                try {
                    const results = await Promise.allSettled(emailPromises);
                    console.log('📊 Resultado do envio de emails:', {
                        total: results.length,
                        enviados: results.filter(r => r.status === 'fulfilled').length,
                        falhas: results.filter(r => r.status === 'rejected').length
                    });
                } catch (err) {
                    console.error('⚠️ Erro ao aguardar envio de emails:', err);
                }

                // Invalidar todas as sessões do usuário
                await invalidateUserSessions(userId, req);

                return res.json({ 
                    success: true, 
                    message: 'Senha alterada com sucesso. Por segurança, você será desconectado e precisará fazer login novamente.'
                });
            } else {
                return res.status(400).json({ error: 'Token inválido' });
            }
        } catch (err) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }
    } catch (error) {
        console.error('Erro ao verificar token de alteração de senha:', error);
        res.status(500).json({ error: 'Erro ao verificar token' });
    }
};

/**
 * POST/GET /api/usuario/revert-password-change - Reverte a senha para a anterior (após já ter sido alterada)
 */
exports.revertPasswordChange = async (req, res) => {
    try {
        const htmlResponse = (title, description, isSuccess = true) => {
            if (req.method !== 'GET') return null;
            const brand = '#0d556d';
            const error = '#ef4444';
            const color = isSuccess ? brand : error;
            const subtle = isSuccess ? '#e6f4f7' : '#fee2e2';
            const icon = isSuccess ? '✔' : '⚠';
            const logoUrl = `${process.env.APP_BASE_URL || ''}/assets/images/logo.png`;
            return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body{margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827}
    .card{width:min(640px,calc(100% - 32px));margin:clamp(24px,8vh,64px) auto;background:#fff;border-radius:12px;box-shadow:0 10px 20px rgba(0,0,0,.08);overflow:hidden}
    .header{padding:clamp(16px,4vw,28px) clamp(16px,4vw,24px);text-align:center;border-bottom:1px solid #e5e7eb}
    .logo{width:clamp(140px,40vw,200px);height:auto;margin:4px 0}
    .content{padding:clamp(18px,4.5vw,28px) clamp(16px,4vw,24px);text-align:center}
    .badge{display:inline-block;padding:6px 12px;border-radius:9999px;background:${subtle};color:${color};font-weight:700;margin-bottom:12px;font-size:clamp(12px,2.8vw,14px)}
    h1{font-size:clamp(18px,4.8vw,22px);margin:6px 0 10px;color:#1f2937}
    p{color:#4b5563;line-height:1.7;margin:0;font-size:clamp(14px,3.8vw,16px)}
    .footer{padding:clamp(14px,3.5vw,18px) clamp(16px,4vw,24px);background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;text-align:center;font-size:clamp(12px,3.2vw,13px)}
    a.btn{display:inline-block;margin-top:22px;background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700}
    a.btn:hover{filter:brightness(0.95)}
    @media (max-width:480px){
      a.btn{width:88%;max-width:320px}
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img class="logo" src="${logoUrl}" alt="LumiGente" />
    </div>
    <div class="content">
      <div class="badge">${icon} ${isSuccess ? 'Operação concluída' : 'Não foi possível concluir'}</div>
      <h1>${title}</h1>
      <p>${description}</p>
      <a class="btn" href="${process.env.APP_BASE_URL || '/'}">Ir para o sistema</a>
    </div>
    <div class="footer">Você pode fechar esta janela com segurança.</div>
  </div>
</body>
</html>`;
        };

        const token = req.method === 'GET' ? (req.query.token || '') : (req.body.token || '');
        if (!token) {
            const html = htmlResponse('Token ausente', 'O link está incompleto. Se necessário, entre em contato com o suporte.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token ausente' });
        }

        const pool = await getDatabasePool();
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            const html = htmlResponse('Link inválido ou expirado', 'O link de reversão não é válido ou já expirou.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        const userResult = await pool.request()
            .input('userId', sql.Int, decoded.userId)
            .query(`
                SELECT Id, PreviousPasswordHash, PasswordRevertToken, PasswordRevertExpires, NomeCompleto
                FROM Users 
                WHERE Id = @userId
            `);

        if (userResult.recordset.length === 0) {
            const html = htmlResponse('Usuário não encontrado', 'Não foi possível encontrar o usuário.', false);
            return html ? res.status(404).send(html) : res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const user = userResult.recordset[0];

        if (!user.PasswordRevertToken || new Date() > new Date(user.PasswordRevertExpires)) {
            const html = htmlResponse('Link expirado', 'O prazo para reverter a senha terminou. Por segurança, o link de reversão expira após 7 dias.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token de reversão inválido ou expirado' });
        }

        if (token !== user.PasswordRevertToken) {
            const html = htmlResponse('Token inválido', 'O token informado não corresponde ao link de reversão válido.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token inválido' });
        }

        if (!user.PreviousPasswordHash) {
            const html = htmlResponse('Sem senha anterior', 'Não há senha anterior armazenada para reverter.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Não há senha anterior para reverter' });
        }

        // Reverter para a senha anterior
        await pool.request()
            .input('userId', sql.Int, user.Id)
            .input('previousHash', sql.VarChar, user.PreviousPasswordHash)
            .query(`
                UPDATE Users 
                SET PasswordHash = @previousHash,
                    PreviousPasswordHash = NULL,
                    PasswordRevertToken = NULL,
                    PasswordRevertExpires = NULL,
                    LastPasswordChange = GETDATE(),
                    updated_at = GETDATE()
                WHERE Id = @userId
            `);

        // Invalidar todas as sessões do usuário
        await invalidateUserSessions(user.Id, req);

        // Log de segurança
        console.log('🔄 Senha revertida para versão anterior. Usuário:', user.Id, user.NomeCompleto);

        const html = htmlResponse(
            'Senha restaurada com sucesso', 
            'Sua senha foi restaurada para a versão anterior. Por segurança, todas as suas sessões foram encerradas. Faça login novamente com sua senha anterior.'
        );
        return html ? res.send(html) : res.json({ 
            success: true, 
            message: 'Senha restaurada com sucesso. Faça login com sua senha anterior.' 
        });
    } catch (error) {
        console.error('❌ Erro ao reverter senha:', error);
        const html = req.method === 'GET' ? `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Erro</title></head><body><pre>Não foi possível concluir sua solicitação no momento.</pre></body></html>` : null;
        return html ? res.status(500).send(html) : res.status(500).json({ error: 'Erro ao reverter senha' });
    }
};

/**
 * POST/GET /api/usuario/cancel-password-change - Cancela a alteração de senha (ANTES de ser confirmada)
 */
exports.cancelPasswordChange = async (req, res) => {
    try {
        const htmlResponse = (title, description, isSuccess = true) => {
            if (req.method !== 'GET') return null;
            const brand = '#0d556d';
            const error = '#ef4444';
            const color = isSuccess ? brand : error;
            const subtle = isSuccess ? '#e6f4f7' : '#fee2e2';
            const icon = isSuccess ? '✔' : '⚠';
            const logoUrl = `${process.env.APP_BASE_URL || ''}/assets/images/logo.png`;
            return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body{margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827}
    .card{width:min(640px,calc(100% - 32px));margin:clamp(24px,8vh,64px) auto;background:#fff;border-radius:12px;box-shadow:0 10px 20px rgba(0,0,0,.08);overflow:hidden}
    .header{padding:clamp(16px,4vw,28px) clamp(16px,4vw,24px);text-align:center;border-bottom:1px solid #e5e7eb}
    .logo{width:clamp(140px,40vw,200px);height:auto;margin:4px 0}
    .content{padding:clamp(18px,4.5vw,28px) clamp(16px,4vw,24px);text-align:center}
    .badge{display:inline-block;padding:6px 12px;border-radius:9999px;background:${subtle};color:${color};font-weight:700;margin-bottom:12px;font-size:clamp(12px,2.8vw,14px)}
    h1{font-size:clamp(18px,4.8vw,22px);margin:6px 0 10px;color:#1f2937}
    p{color:#4b5563;line-height:1.7;margin:0;font-size:clamp(14px,3.8vw,16px)}
    .footer{padding:clamp(14px,3.5vw,18px) clamp(16px,4vw,24px);background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;text-align:center;font-size:clamp(12px,3.2vw,13px)}
    a.btn{display:inline-block;margin-top:22px;background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700}
    a.btn:hover{filter:brightness(0.95)}
    @media (max-width:480px){
      a.btn{width:88%;max-width:320px}
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img class="logo" src="${logoUrl}" alt="LumiGente" />
    </div>
    <div class="content">
      <div class="badge">${icon} ${isSuccess ? 'Operação concluída' : 'Não foi possível concluir'}</div>
      <h1>${title}</h1>
      <p>${description}</p>
      <a class="btn" href="${process.env.APP_BASE_URL || '/'}">Ir para o sistema</a>
    </div>
    <div class="footer">Você pode fechar esta janela com segurança.</div>
  </div>
</body>
</html>`;
        };

        const token = req.method === 'GET' ? (req.query.token || '') : (req.body.token || '');
        if (!token) {
            const html = htmlResponse('Token ausente', 'O link está incompleto. Se necessário, tente alterar sua senha novamente.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token ausente' });
        }

        const pool = await getDatabasePool();
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            const html = htmlResponse('Link inválido ou expirado', 'O link de cancelamento não é válido ou já expirou. Se necessário, tente alterar sua senha novamente.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        const userResult = await pool.request()
            .input('userId', sql.Int, decoded.userId)
            .query(`
                SELECT Id, PendingPasswordHash, PreviousPasswordHash, 
                       PasswordChangeCancelToken, PasswordChangeCancelExpires 
                FROM Users 
                WHERE Id = @userId
            `);

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const user = userResult.recordset[0];

        if (!user.PasswordChangeCancelToken || new Date() > new Date(user.PasswordChangeCancelExpires)) {
            const html = htmlResponse('Token expirado', 'O prazo do link de cancelamento terminou. Se necessário, tente alterar sua senha novamente.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token de cancelamento inválido ou expirado' });
        }

        if (token !== user.PasswordChangeCancelToken) {
            const html = htmlResponse('Token inválido', 'O token informado não corresponde ao seu link de cancelamento.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token inválido' });
        }

        if (!user.PendingPasswordHash) {
            const html = htmlResponse('Nada a cancelar', 'Não há nenhuma alteração de senha pendente para cancelar.', true);
            return html ? res.send(html) : res.json({ success: true, message: 'Nada a cancelar.' });
        }

        // Cancelar alteração ANTES da confirmação (PendingPasswordHash ainda existe)
        await pool.request()
            .input('userId', sql.Int, user.Id)
            .input('invalidToken', sql.VarChar, crypto.randomBytes(32).toString('hex')) // Token aleatório inválido
            .query(`
                UPDATE Users 
                SET PendingPasswordHash = NULL,
                    PasswordChangeToken = @invalidToken, -- Invalida o token imediatamente
                    PasswordChangeExpires = DATEADD(minute, -5, GETDATE()), -- Expira o token
                    PasswordChangeCancelToken = NULL,
                    PasswordChangeCancelExpires = NULL,
                    updated_at = GETDATE()
                WHERE Id = @userId
            `);
            
        // Log de segurança
        console.log('🔒 Alteração de senha cancelada antes da confirmação. Usuário:', user.Id);
        
        const html = htmlResponse('Solicitação cancelada', 'A alteração de senha pendente foi cancelada e os tokens foram invalidados. Sua senha atual permanece a mesma.');
        return html ? res.send(html) : res.json({ 
            success: true, 
            message: 'Solicitação de alteração de senha cancelada com sucesso.' 
        });
    } catch (error) {
        console.error('Erro ao cancelar alteração de senha:', error);
        const html = req.method === 'GET' ? `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Erro</title></head><body><pre>Não foi possível concluir sua solicitação no momento.</pre></body></html>` : null;
        return html ? res.status(500).send(html) : res.status(500).json({ error: 'Erro ao cancelar alteração de senha' });
    }
};

/**
 * PUT /api/usuario/notifications - Salva as preferências de notificação (simulado).
 */
exports.updateNotificationPreferences = async (req, res) => {
    const { feedback, recognition, objectives, surveys } = req.body;
    console.log(`Preferências de notificação salvas para usuário ${req.session.user.userId}:`, { feedback, recognition, objectives, surveys });
    res.json({ success: true, message: 'Preferências salvas com sucesso (simulado)' });
};

/**
 * PUT /api/usuario/privacy - Salva as configurações de privacidade (simulado).
 */
exports.updatePrivacySettings = async (req, res) => {
    const { profileVisible, showDepartment, showPosition } = req.body;
    console.log(`Configurações de privacidade salvas para usuário ${req.session.user.userId}:`, { profileVisible, showDepartment, showPosition });
    res.json({ success: true, message: 'Configurações de privacidade salvas com sucesso (simulado)' });
};

/**
 * POST /api/usuario/request-email-verification - Solicita token para verificação de email.
 */
exports.requestEmailVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user.userId;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        const pool = await getDatabasePool();
        
        // Verificar se o email já está cadastrado para outro usuário
        const emailCheck = await pool.request()
            .input('email', sql.VarChar, email)
            .input('userId', sql.Int, userId)
            .query('SELECT Id FROM Users WHERE Email = @email AND Id != @userId');
        
        if (emailCheck.recordset.length > 0) {
            return res.status(400).json({ error: 'Este email já está vinculado a outro usuário' });
        }
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT NomeCompleto, Email FROM Users WHERE Id = @userId');
        
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        const user = userResult.recordset[0];

        // Não permitir solicitar token para o mesmo email já cadastrado no usuário
        if (user.Email && user.Email.toLowerCase() === email.toLowerCase()) {
            return res.status(400).json({ error: 'Este já é o seu email atual' });
        }
        const jwt = require('jsonwebtoken');
        
        // Gerar token seguro de 6 dígitos usando crypto
        const token = crypto.randomInt(100000, 999999).toString();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const expiresIn = process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN || '2m';
        const expiresInMs = expiresIn.endsWith('m') ? parseInt(expiresIn) * 60 * 1000 : parseInt(expiresIn) * 1000;
        const jwtToken = jwt.sign({ userId, email, tokenHash }, process.env.JWT_SECRET, { expiresIn });

        // Token de cancelamento para o email atual (1 dia por padrão)
        const cancelTokenRaw = crypto.randomBytes(24).toString('hex');
        const cancelExpiresIn = process.env.JWT_EMAIL_CHANGE_CANCEL_EXPIRES_IN || '1d';
        // Converte formato simples (d, h, m, s) para ms
        const cancelExpiresInMs = (() => {
            const v = parseInt(cancelExpiresIn);
            if (Number.isNaN(v)) return 24 * 60 * 60 * 1000; // fallback 1d
            if (cancelExpiresIn.endsWith('d')) return v * 24 * 60 * 60 * 1000;
            if (cancelExpiresIn.endsWith('h')) return v * 60 * 60 * 1000;
            if (cancelExpiresIn.endsWith('m')) return v * 60 * 1000;
            return v * 1000; // assume segundos
        })();
        const cancelJwt = jwt.sign({ userId, token: cancelTokenRaw }, process.env.JWT_SECRET, { expiresIn: cancelExpiresIn });

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('token', sql.VarChar, jwtToken)
            .input('email', sql.VarChar, email)
            .input('expiresAt', sql.DateTime, new Date(Date.now() + expiresInMs))
            .input('cancelToken', sql.VarChar, cancelJwt)
            .input('cancelExpires', sql.DateTime, new Date(Date.now() + cancelExpiresInMs))
            .query('UPDATE Users SET EmailVerificationToken = @token, EmailVerificationExpires = @expiresAt, PendingEmail = @email, EmailChangeCancelToken = @cancelToken, EmailChangeCancelExpires = @cancelExpires WHERE Id = @userId');
        
        try {
            const emailService = require('../services/emailService');
            await emailService.sendEmailVerification(email, token, user.NomeCompleto);
            if (user.Email) {
                // Enviar o JWT de cancelamento (o endpoint espera um token assinado)
                await emailService.sendEmailChangeAlert(user.Email, cancelJwt, user.NomeCompleto, email);
            }
            res.json({ success: true, message: 'Token enviado. Verifique o novo email.' });
        } catch (emailError) {
            console.error('Erro ao enviar emails de verificação/alerta', emailError);
            res.status(500).json({ error: 'Erro ao enviar email. Tente novamente.' });
        }
    } catch (error) {
        console.error('Erro ao solicitar verificação de email:', error);
        res.status(500).json({ error: 'Erro ao solicitar verificação de email' });
    }
};

/**
 * POST /api/usuario/verify-email-token - Verifica token e confirma email.
 */
exports.verifyEmailToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT EmailVerificationToken, EmailVerificationExpires, PendingEmail FROM Users WHERE Id = @userId');
        
        if (result.recordset.length === 0 || !result.recordset[0].EmailVerificationToken) {
            return res.status(400).json({ error: 'Token inválido' });
        }
        
        const user = result.recordset[0];
        if (new Date() > new Date(user.EmailVerificationExpires)) {
            return res.status(400).json({ error: 'Token expirado' });
        }
        
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(user.EmailVerificationToken, process.env.JWT_SECRET);
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            if (decoded.tokenHash === tokenHash) {
                // Mover email atual para PreviousEmail e aplicar PendingEmail como novo Email
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .query('UPDATE Users SET PreviousEmail = Email WHERE Id = @userId');
                await pool.request()
                    .input('userId', sql.Int, userId)
                    .input('email', sql.VarChar, user.PendingEmail)
                    .query('UPDATE Users SET Email = @email, EmailVerified = 1, EmailVerificationToken = NULL, EmailVerificationExpires = NULL, PendingEmail = NULL, updated_at = GETDATE() WHERE Id = @userId');

                req.session.user.email = user.PendingEmail;
                return res.json({ success: true, message: 'Email alterado com sucesso.' });
            } else {
                return res.status(400).json({ error: 'Token inválido' });
            }
        } catch (err) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }
    } catch (error) {
        console.error('Erro ao verificar token de email:', error);
        res.status(500).json({ error: 'Erro ao verificar token de email' });
    }
};

/**
 * POST/GET /api/usuario/cancel-email-change - Cancela ou reverte a alteração de email via token do email antigo.
 */
exports.cancelEmailChange = async (req, res) => {
    try {
        // Função utilitária para derrubar todas as sessões do usuário (MemoryStore ou stores compatíveis)
        const invalidateUserSessions = async (userId) => {
            try {
                const store = req.sessionStore;
                if (!store || typeof store.all !== 'function' || typeof store.destroy !== 'function') {
                    console.warn('⚠️ Store de sessão não suporta varredura para invalidar sessões.');
                    return;
                }
                await new Promise((resolve) => {
                    store.all((err, sessions) => {
                        if (err || !sessions) return resolve();
                        const entries = Object.entries(sessions);
                        for (const [sid, sess] of entries) {
                            const sUserId = sess && sess.user && sess.user.userId;
                            if (sUserId === userId) {
                                try { store.destroy(sid, () => {}); } catch (_) {}
                            }
                        }
                        resolve();
                    });
                });
            } catch (e) {
                console.warn('⚠️ Falha ao invalidar sessões do usuário:', e.message);
            }
        };
        const htmlResponse = (title, description, isSuccess = true) => {
            if (req.method !== 'GET') return null;
            // Paleta alinhada ao projeto (frontend/styles/variables.css)
            const brand = '#0d556d';
            const error = '#ef4444';
            const color = isSuccess ? brand : error;
            const subtle = isSuccess ? '#e6f4f7' : '#fee2e2';
            const icon = isSuccess ? '✔' : '⚠';
            const logoUrl = `${process.env.APP_BASE_URL || ''}/assets/images/logo.png`;
            return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body{margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827}
    .card{width:min(640px,calc(100% - 32px));margin:clamp(24px,8vh,64px) auto;background:#fff;border-radius:12px;box-shadow:0 10px 20px rgba(0,0,0,.08);overflow:hidden}
    .header{padding:clamp(16px,4vw,28px) clamp(16px,4vw,24px);text-align:center;border-bottom:1px solid #e5e7eb}
    .logo{width:clamp(140px,40vw,200px);height:auto;margin:4px 0}
    .content{padding:clamp(18px,4.5vw,28px) clamp(16px,4vw,24px);text-align:center}
    .badge{display:inline-block;padding:6px 12px;border-radius:9999px;background:${subtle};color:${color};font-weight:700;margin-bottom:12px;font-size:clamp(12px,2.8vw,14px)}
    h1{font-size:clamp(18px,4.8vw,22px);margin:6px 0 10px;color:#1f2937}
    p{color:#4b5563;line-height:1.7;margin:0;font-size:clamp(14px,3.8vw,16px)}
    .footer{padding:clamp(14px,3.5vw,18px) clamp(16px,4vw,24px);background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;text-align:center;font-size:clamp(12px,3.2vw,13px)}
    a.btn{display:inline-block;margin-top:22px;background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700}
    a.btn:hover{filter:brightness(0.95)}
    @media (max-width:480px){
      a.btn{width:88%;max-width:320px}
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img class="logo" src="${logoUrl}" alt="LumiGente" />
    </div>
    <div class="content">
      <div class="badge">${icon} ${isSuccess ? 'Operação concluída' : 'Não foi possível concluir'}</div>
      <h1>${title}</h1>
      <p>${description}</p>
      <a class="btn" href="${process.env.APP_BASE_URL || '/'}">Ir para o sistema</a>
    </div>
    <div class="footer">Você pode fechar esta janela com segurança.</div>
  </div>
</body>
</html>`;
        };
        const token = req.method === 'GET' ? (req.query.token || '') : (req.body.token || '');
        if (!token) {
            const html = htmlResponse('Token ausente', 'O link está incompleto. Solicite novamente a alteração de email.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token ausente' });
        }

        const pool = await getDatabasePool();
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            const html = htmlResponse('Link inválido ou expirado', 'O link de cancelamento não é válido ou já expirou. Se necessário, solicite uma nova alteração de email.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        const userResult = await pool.request()
            .input('userId', sql.Int, decoded.userId)
            .query('SELECT Id, Email, PreviousEmail, PendingEmail, EmailChangeCancelToken, EmailChangeCancelExpires FROM Users WHERE Id = @userId');

        if (userResult.recordset.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        const user = userResult.recordset[0];

        if (!user.EmailChangeCancelToken || new Date() > new Date(user.EmailChangeCancelExpires)) {
            const html = htmlResponse('Token expirado', 'O prazo do link de cancelamento terminou. Caso precise, solicite uma nova alteração de email.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token de cancelamento inválido ou expirado' });
        }

        // Garante que o token recebido é exatamente o mesmo salvo para este usuário
        if (token !== user.EmailChangeCancelToken) {
            const html = htmlResponse('Token inválido', 'O token informado não corresponde ao seu link de cancelamento.', false);
            return html ? res.status(400).send(html) : res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        if (user.PendingEmail) {
            // Cancelar alteração antes de aplicar
            await pool.request()
                .input('userId', sql.Int, user.Id)
                .query('UPDATE Users SET PendingEmail = NULL, EmailVerificationToken = NULL, EmailVerificationExpires = NULL, EmailChangeCancelToken = NULL, EmailChangeCancelExpires = NULL, updated_at = GETDATE() WHERE Id = @userId');
            await invalidateUserSessions(user.Id);
            const html = htmlResponse('Solicitação cancelada', 'A alteração de email pendente foi cancelada e nenhuma mudança foi aplicada.');
            return html ? res.send(html) : res.json({ success: true, message: 'Solicitação de alteração de email cancelada.' });
        }

        if (user.PreviousEmail) {
            // Reverter após a mudança
            await pool.request()
                .input('userId', sql.Int, user.Id)
                .input('email', sql.VarChar, user.PreviousEmail)
                .query('UPDATE Users SET Email = @email, PreviousEmail = NULL, EmailChangeCancelToken = NULL, EmailChangeCancelExpires = NULL, updated_at = GETDATE() WHERE Id = @userId');
            await invalidateUserSessions(user.Id);
            const html = htmlResponse('Alteração revertida', 'Seu email foi restaurado para o endereço anterior com sucesso.');
            return html ? res.send(html) : res.json({ success: true, message: 'Alteração revertida. O email antigo foi restaurado.' });
        }

        {
            const html = htmlResponse('Nada a cancelar', 'Não havia nenhuma alteração pendente ou anterior para reverter.', true);
            return html ? res.send(html) : res.json({ success: true, message: 'Nada a cancelar.' });
        };
    } catch (error) {
        console.error('Erro ao cancelar alteração de email:', error);
        const html = req.method === 'GET' ? `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Erro</title></head><body><pre>Não foi possível concluir sua solicitação no momento.</pre></body></html>` : null;
        return html ? res.status(500).send(html) : res.status(500).json({ error: 'Erro ao cancelar alteração de email' });
    }
};

/**
 * PUT /api/usuario/email - Salva o email do usuário (mantido para compatibilidade).
 */
exports.updateEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user.userId;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        const pool = await getDatabasePool();
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('email', sql.VarChar, email)
            .query('UPDATE Users SET Email = @email, updated_at = GETDATE() WHERE Id = @userId');
        
        req.session.user.email = email;
        res.json({ success: true, message: 'Email cadastrado com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar email:', error);
        res.status(500).json({ error: 'Erro ao salvar email' });
    }
};

/**
 * POST /api/forgot-password - Solicita recuperação de senha (SEM necessidade de login)
 * Envia token para Email E PreviousEmail se existirem
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { cpf } = req.body;
        
        if (!cpf) {
            return res.status(400).json({ error: 'CPF é obrigatório' });
        }

        // Limpar CPF
        const cpfLimpo = cpf.replace(/[^\d]/g, '');
        
        const pool = await getDatabasePool();
        
        console.log('🔍 Buscan usuário para recuperação de senha:', cpfLimpo);
        
        // Buscar usuário por CPF
        const userResult = await pool.request()
            .input('cpf', sql.VarChar, cpfLimpo)
            .query(`
                SELECT Id, NomeCompleto, Email, PreviousEmail, CPF
                FROM Users 
                WHERE REPLACE(REPLACE(REPLACE(CPF, '.', ''), '-', ''), ' ', '') = @cpf
                AND IsActive = 1
            `);
        
        // Por segurança, sempre retornar sucesso (mesmo se CPF não existir)
        if (userResult.recordset.length === 0) {
            console.log('⚠️ CPF não encontrado, mas retornando sucesso por segurança');
            return res.json({ 
                success: true, 
                message: 'Se o CPF estiver cadastrado, um token será enviado para o(s) email(s) registrado(s).',
                hasSupportContact: true
            });
        }
        
        const user = userResult.recordset[0];
        
        // Verificar se tem pelo menos um email
        if (!user.Email && !user.PreviousEmail) {
            console.log('⚠️ Usuário sem emails cadastrados');
            return res.json({ 
                success: true, 
                message: 'Nenhum email encontrado. Entre em contato com TI para recuperar sua senha.',
                needsSupport: true,
                hasSupportContact: true
            });
        }

        const jwt = require('jsonwebtoken');
        
        // Gerar token seguro de 6 dígitos
        const token = crypto.randomInt(100000, 999999).toString();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const expiresIn = process.env.JWT_FORGOT_PASSWORD_EXPIRES_IN || '15m';
        const expiresInMs = expiresIn.endsWith('m') ? parseInt(expiresIn) * 60 * 1000 : parseInt(expiresIn) * 1000;
        const jwtToken = jwt.sign({ userId: user.Id, tokenHash }, process.env.JWT_SECRET, { expiresIn });
        
        // Salvar token no banco
        await pool.request()
            .input('userId', sql.Int, user.Id)
            .input('token', sql.VarChar, jwtToken)
            .input('expiresAt', sql.DateTime, new Date(Date.now() + expiresInMs))
            .query('UPDATE Users SET PasswordResetToken = @token, PasswordResetExpires = @expiresAt WHERE Id = @userId');
        
        console.log('✅ Token gerado e salvo no banco');
        
        // Enviar emails
        const emailService = require('../services/emailService');
        const emailPromises = [];
        let emailsSent = 0;

        // Enviar para Email atual
        if (user.Email) {
            console.log(`📧 Enviando token para email atual: ${user.Email}`);
            emailPromises.push(
                emailService.sendForgotPasswordEmail(user.Email, token, user.NomeCompleto)
                    .then(() => {
                        console.log(`✅ Token enviado para: ${user.Email}`);
                        emailsSent++;
                    })
                    .catch(err => console.error(`❌ Erro ao enviar para ${user.Email}:`, err.message))
            );
        }

        // Enviar para Email anterior (se diferente)
        if (user.PreviousEmail && user.PreviousEmail !== user.Email) {
            console.log(`📧 Enviando token para email anterior: ${user.PreviousEmail}`);
            emailPromises.push(
                emailService.sendForgotPasswordEmail(user.PreviousEmail, token, user.NomeCompleto)
                    .then(() => {
                        console.log(`✅ Token enviado para: ${user.PreviousEmail}`);
                        emailsSent++;
                    })
                    .catch(err => console.error(`❌ Erro ao enviar para ${user.PreviousEmail}:`, err.message))
            );
        }

        // Aguardar envio
        await Promise.allSettled(emailPromises);
        
        console.log(`📊 Total de emails enviados: ${emailsSent}`);
        
        res.json({ 
            success: true, 
            message: 'Token enviado para o(s) email(s) cadastrado(s). Verifique sua caixa de entrada.',
            emailsSent: emailsSent,
            hasSupportContact: true
        });
        
    } catch (error) {
        console.error('❌ Erro ao processar recuperação de senha:', error);
        res.status(500).json({ 
            error: 'Erro ao processar solicitação',
            hasSupportContact: true
        });
    }
};

/**
 * POST /api/verify-forgot-password - Verifica token e redefine senha (SEM necessidade de login)
 */
exports.verifyForgotPassword = async (req, res) => {
    try {
        const { cpf, token, newPassword } = req.body;
        
        if (!cpf || !token || !newPassword) {
            return res.status(400).json({ error: 'CPF, token e nova senha são obrigatórios' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
        }

        const cpfLimpo = cpf.replace(/[^\d]/g, '');
        const pool = await getDatabasePool();
        
        // Buscar usuário
        const userResult = await pool.request()
            .input('cpf', sql.VarChar, cpfLimpo)
            .query(`
                SELECT Id, PasswordResetToken, PasswordResetExpires, NomeCompleto
                FROM Users 
                WHERE REPLACE(REPLACE(REPLACE(CPF, '.', ''), '-', ''), ' ', '') = @cpf
                AND IsActive = 1
            `);
        
        if (userResult.recordset.length === 0) {
            return res.status(400).json({ error: 'CPF não encontrado' });
        }
        
        const user = userResult.recordset[0];
        
        if (!user.PasswordResetToken) {
            return res.status(400).json({ error: 'Token inválido. Solicite um novo token.' });
        }
        
        if (new Date() > new Date(user.PasswordResetExpires)) {
            return res.status(400).json({ error: 'Token expirado. Solicite um novo token.' });
        }
        
        // Verificar token
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(user.PasswordResetToken, process.env.JWT_SECRET);
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            if (decoded.tokenHash !== tokenHash) {
                return res.status(400).json({ error: 'Token inválido' });
            }
        } catch (err) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }
        
        // Alterar senha
        const newPasswordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
        await pool.request()
            .input('userId', sql.Int, user.Id)
            .input('passwordHash', sql.VarChar, newPasswordHash)
            .query(`
                UPDATE Users 
                SET PasswordHash = @passwordHash, 
                    PasswordResetToken = NULL, 
                    PasswordResetExpires = NULL,
                    LastPasswordChange = GETDATE(),
                    updated_at = GETDATE() 
                WHERE Id = @userId
            `);
        
        console.log('✅ Senha redefinida com sucesso para usuário:', user.NomeCompleto);
        
        res.json({ success: true, message: 'Senha alterada com sucesso! Você já pode fazer login.' });
        
    } catch (error) {
        console.error('❌ Erro ao verificar token:', error);
        res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
};

/**
 * POST /api/usuario/request-password-reset - Solicita token para redefinição de senha (LOGADO).
 */
exports.requestPasswordReset = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Email, NomeCompleto FROM Users WHERE Id = @userId');
        
        if (userResult.recordset.length === 0 || !userResult.recordset[0].Email) {
            return res.status(400).json({ error: 'Email não cadastrado. Por favor, cadastre um email primeiro.' });
        }
        
        const user = userResult.recordset[0];
        const jwt = require('jsonwebtoken');
        
        // Gerar token seguro de 6 dígitos usando crypto
        const token = crypto.randomInt(100000, 999999).toString();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const expiresIn = process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '2m';
        const expiresInMs = expiresIn.endsWith('m') ? parseInt(expiresIn) * 60 * 1000 : parseInt(expiresIn) * 1000;
        const jwtToken = jwt.sign({ userId, tokenHash }, process.env.JWT_SECRET, { expiresIn });
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('token', sql.VarChar, jwtToken)
            .input('expiresAt', sql.DateTime, new Date(Date.now() + expiresInMs))
            .query('UPDATE Users SET PasswordResetToken = @token, PasswordResetExpires = @expiresAt WHERE Id = @userId');
        
        try {
            const emailService = require('../services/emailService');
            await emailService.sendPasswordResetEmail(user.Email, token, user.NomeCompleto);
            res.json({ success: true, message: 'Token enviado para seu email' });
        } catch (emailError) {
            console.error('Erro ao enviar email de redefinição de senha');
            res.status(500).json({ error: 'Erro ao enviar email. Tente novamente.' });
        }
    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha:', error);
        res.status(500).json({ error: 'Erro ao solicitar redefinição de senha: ' + error.message });
    }
};

/**
 * POST /api/usuario/verify-reset-token - Verifica token de redefinição.
 */
exports.verifyResetToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT PasswordResetToken, PasswordResetExpires FROM Users WHERE Id = @userId');
        
        if (result.recordset.length === 0 || !result.recordset[0].PasswordResetToken) {
            return res.status(400).json({ error: 'Token inválido' });
        }
        
        const user = result.recordset[0];
        if (new Date() > new Date(user.PasswordResetExpires)) {
            return res.status(400).json({ error: 'Token expirado' });
        }
        
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(user.PasswordResetToken, process.env.JWT_SECRET);
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            if (decoded.tokenHash === tokenHash) {
                return res.json({ success: true, message: 'Token válido' });
            } else {
                return res.status(400).json({ error: 'Token inválido' });
            }
        } catch (err) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        res.status(500).json({ error: 'Erro ao verificar token' });
    }
};

/**
 * POST /api/usuario/reset-password - Redefine a senha com token válido.
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const userId = req.session.user.userId;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
        }
        
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT PasswordResetToken, PasswordResetExpires FROM Users WHERE Id = @userId');
        
        if (result.recordset.length === 0 || !result.recordset[0].PasswordResetToken) {
            return res.status(400).json({ error: 'Token inválido' });
        }
        
        const user = result.recordset[0];
        if (new Date() > new Date(user.PasswordResetExpires)) {
            return res.status(400).json({ error: 'Token expirado' });
        }
        
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(user.PasswordResetToken, process.env.JWT_SECRET);
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            
            if (decoded.tokenHash !== tokenHash) {
                return res.status(400).json({ error: 'Token inválido' });
            }
        } catch (err) {
            return res.status(400).json({ error: 'Token inválido' });
        }
        
        const newPasswordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('passwordHash', sql.VarChar, newPasswordHash)
            .query('UPDATE Users SET PasswordHash = @passwordHash, PasswordResetToken = NULL, PasswordResetExpires = NULL, updated_at = GETDATE() WHERE Id = @userId');
        
        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
};

/**
 * GET /api/usuario/debug/permissions - Debug das permissões do usuário atual.
 */
exports.debugUserPermissions = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        
        console.log('🔍 Debug de permissões para:', user.nomeCompleto);
        
        const hierarchyLevel = user.hierarchyLevel || 0;
        const role = user.role || 'Funcionário';
        
        // Verificar se é RH ou T&D
        const { isHR, isTD } = require('../utils/permissionsHelper').checkHRTDPermissions(user);
        
        const permissions = await getUserTabPermissions(user);
        
        const debugInfo = {
            user: {
                userId: user.userId,
                nomeCompleto: user.nomeCompleto,
                departamento: user.departamento,
                hierarchyLevel: hierarchyLevel,
                role: role,
                HierarchyPath: user.HierarchyPath,
                Matricula: user.Matricula
            },
            analysis: {
                isHR: isHR,
                isTD: isTD,
                isAdministrator: role === 'Administrador',
                isManager: hierarchyLevel >= 3,
                isSupervisor: hierarchyLevel >= 2,
                isEmployee: hierarchyLevel < 2
            },
            permissions: permissions,
            expectedAccess: {
                shouldHaveTeamAccess: isHR || isTD || hierarchyLevel >= 3,
                shouldHaveAnalyticsAccess: isHR || isTD || hierarchyLevel >= 3,
                shouldHaveHistoricoAccess: isHR || isTD || hierarchyLevel >= 3,
                shouldHaveAvaliacoesAccess: isHR || isTD || hierarchyLevel >= 3,
                shouldHavePesquisasAccess: true, // Todos podem responder
                canCreatePesquisas: isHR || isTD,
                canCreateAvaliacoes: isHR || isTD || hierarchyLevel >= 3
            }
        };
        
        res.json(debugInfo);
    } catch (error) {
        console.error('❌ Erro no debug de permissões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};