const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const HierarchyManager = require('../services/hierarchyManager');
const { hasFullAccess } = require('../utils/permissionsHelper');
const emailService = require('../services/emailService');
const { createNotification, ensureNotificationsTableExists } = require('./notificationController');

// =================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO (Helpers)
// =================================================================

/**
 * Garante que as tabelas necessárias para o sistema de objetivos existam no banco de dados.
 * @param {object} pool - A instância do pool de conexão com o banco de dados.
 */
async function ensureObjetivosTablesExist(pool) {
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Objetivos')
            BEGIN
                CREATE TABLE Objetivos (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    titulo NVARCHAR(255) NOT NULL,
                    descricao NTEXT,
                    criado_por INT NOT NULL,
                    data_inicio DATE NOT NULL,
                    data_fim DATE NOT NULL,
                    status NVARCHAR(50) DEFAULT 'Ativo',
                    progresso DECIMAL(5,2) DEFAULT 0,
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME DEFAULT GETDATE()
                );
            END;

            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ObjetivoCheckins')
            BEGIN
                CREATE TABLE ObjetivoCheckins (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    objetivo_id INT NOT NULL,
                    user_id INT NOT NULL,
                    progresso DECIMAL(5,2) NOT NULL,
                    observacoes NTEXT,
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (objetivo_id) REFERENCES Objetivos(Id) ON DELETE CASCADE
                );
            END;

            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ObjetivoResponsaveis')
            BEGIN
                CREATE TABLE ObjetivoResponsaveis (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    objetivo_id INT NOT NULL,
                    responsavel_id INT NOT NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (objetivo_id) REFERENCES Objetivos(Id) ON DELETE CASCADE,
                    UNIQUE (objetivo_id, responsavel_id)
                );
            END;
        `);
    } catch (error) {
        console.error('Erro ao verificar/criar tabelas de objetivos:', error.message);
        throw new Error('Falha ao inicializar as tabelas de objetivos.');
    }
}

async function addPointsToUser(pool, userId, action, points) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const alreadyEarnedResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('action', sql.VarChar, action)
            .input('today', sql.Date, today)
            .query(`SELECT COUNT(*) as count FROM Gamification WHERE UserId = @userId AND Action = @action AND CAST(CreatedAt AS DATE) = @today`);

        if (alreadyEarnedResult.recordset[0].count > 0) {
            return { success: false, points: 0, message: 'Pontos já concedidos hoje.' };
        }
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('action', sql.VarChar, action)
            .input('points', sql.Int, points)
            .query(`INSERT INTO Gamification (UserId, Action, Points) VALUES (@userId, @action, @points)`);

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('points', sql.Int, points)
            .query(`
                IF EXISTS (SELECT 1 FROM UserPoints WHERE UserId = @userId)
                    UPDATE UserPoints SET TotalPoints = TotalPoints + @points WHERE UserId = @userId
                ELSE
                    INSERT INTO UserPoints (UserId, TotalPoints) VALUES (@userId, @points)
            `);
            
        return { success: true, points, message: `+${points} pontos!` };
    } catch (err) {
        console.error(`Erro ao adicionar pontos para '${action}':`, err);
        return { success: false, points: 0, message: 'Erro ao adicionar pontos.' };
    }
}

async function getUserBasicInfo(pool, userId) {
    if (!userId) return null;
    try {
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`SELECT Id, NomeCompleto, Email FROM Users WHERE Id = @userId`);
        return result.recordset[0] || null;
    } catch (error) {
        console.error('⚠️ Erro ao buscar dados básicos do usuário:', error.message);
        return null;
    }
}

async function getObjetivoResponsaveis(pool, objetivoId) {
    try {
        const result = await pool.request()
            .input('objetivoId', sql.Int, objetivoId)
            .query(`
                SELECT DISTINCT orr.responsavel_id AS Id, u.NomeCompleto, u.Email
                FROM ObjetivoResponsaveis orr
                JOIN Users u ON u.Id = orr.responsavel_id
                WHERE orr.objetivo_id = @objetivoId
            `);
        return result.recordset || [];
    } catch (error) {
        console.error('⚠️ Erro ao buscar responsáveis do objetivo:', error.message);
        return [];
    }
}


// =================================================================
// CONTROLLERS (Funções exportadas para as rotas)
// =================================================================

/**
 * POST /api/objetivos - Cria um novo objetivo.
 */
exports.createObjetivo = async (req, res) => {
    try {
        const { titulo, descricao, responsaveis_ids, data_inicio, data_fim } = req.body;
        const criado_por = req.session.user.userId;

        if (!titulo || !responsaveis_ids || responsaveis_ids.length === 0 || !data_inicio || !data_fim) {
            return res.status(400).json({ error: 'Título, responsável(is), data de início e data de fim são obrigatórios.' });
        }

        const pool = await getDatabasePool();
        await ensureObjetivosTablesExist(pool);

        const status = new Date(data_inicio) > new Date() ? 'Agendado' : 'Ativo';

        const objetivoResult = await pool.request()
            .input('titulo', sql.NVarChar, titulo)
            .input('descricao', sql.NText, descricao || '')
            .input('data_inicio', sql.Date, data_inicio)
            .input('data_fim', sql.Date, data_fim)
            .input('criado_por', sql.Int, criado_por)
            .input('status', sql.NVarChar, status)
            .query(`
                INSERT INTO Objetivos (titulo, descricao, data_inicio, data_fim, criado_por, status)
                OUTPUT INSERTED.Id
                VALUES (@titulo, @descricao, @data_inicio, @data_fim, @criado_por, @status)
            `);
        
        const objetivoId = objetivoResult.recordset[0].Id;

        for (const responsavelId of responsaveis_ids) {
            await pool.request()
                .input('objetivoId', sql.Int, objetivoId)
                .input('responsavelId', sql.Int, responsavelId)
                .query(`INSERT INTO ObjetivoResponsaveis (objetivo_id, responsavel_id) VALUES (@objetivoId, @responsavelId)`);
        }

        // Enviar emails de notificação para todos os responsáveis
        try {
            const creatorResult = await pool.request()
                .input('userId', sql.Int, criado_por)
                .query('SELECT NomeCompleto FROM Users WHERE Id = @userId');
            const creatorName = creatorResult.recordset[0]?.NomeCompleto || 'Gestor';

            const dataInicioFormatada = new Date(data_inicio).toLocaleDateString('pt-BR');
            const dataFimFormatada = new Date(data_fim).toLocaleDateString('pt-BR');

            if (responsaveis_ids.length > 0) {
                const responsavelRequest = pool.request();
                const paramPlaceholders = responsaveis_ids.map((_, index) => {
                    const paramName = `responsavelId${index}`;
                    responsavelRequest.input(paramName, sql.Int, responsaveis_ids[index]);
                    return `@${paramName}`;
                });

                const responsaveisQuery = `
                    SELECT Id, NomeCompleto, Email
                    FROM Users
                    WHERE Id IN (${paramPlaceholders.join(', ')})
                `;

                const responsaveisResult = await responsavelRequest.query(responsaveisQuery);
                const responsaveis = (responsaveisResult.recordset || []).filter(resp => resp.Id !== criado_por);

                if (responsaveis.length === 0) {
                    console.log('ℹ️ Nenhum responsável adicional para notificar por email.');
                } else {
                    const responsaveisComEmail = responsaveis.filter(resp => resp.Email);
                    const responsaveisSemEmail = responsaveis.filter(resp => !resp.Email);

                    responsaveisSemEmail.forEach(resp => {
                        console.log(`⚠️ Responsável ID ${resp.Id} sem email cadastrado`);
                    });

                    if (responsaveisComEmail.length > 0) {
                        const emailPromises = responsaveisComEmail.map(resp =>
                            emailService
                                .sendObjetivoNotificationEmail(
                                    resp.Email,
                                    resp.NomeCompleto,
                                    creatorName,
                                    titulo,
                                    dataInicioFormatada,
                                    dataFimFormatada
                                )
                                .catch(err => console.error(`⚠️ Erro ao enviar email para responsável ${resp.NomeCompleto}:`, err.message))
                        );

                        Promise.allSettled(emailPromises)
                            .then(results => {
                                const enviados = results.filter(r => r.status === 'fulfilled').length;
                                if (enviados > 0) {
                                    console.log(`✅ Emails de objetivo enviados para ${enviados} responsável(is).`);
                                }
                            })
                            .catch(err => {
                                console.error('⚠️ Erro ao processar fila de emails de objetivo:', err.message);
                            });
                    }
                }
            }
        } catch (emailError) {
            console.error('⚠️ Falha ao preparar notificações de objetivo (não crítico):', emailError.message);
        }

        res.status(201).json({ success: true, id: objetivoId, message: 'Objetivo criado com sucesso.' });
    } catch (error) {
        console.error('Erro ao criar objetivo:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao criar objetivo.' });
    }
};

/**
 * GET /api/objetivos - Lista os objetivos do usuário e de sua equipe.
 */
exports.getObjetivos = async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        
        console.log('🔍 Buscando objetivos para usuário:', userId);
        
        // Verificar se as tabelas existem antes de tentar usá-las
        try {
            await ensureObjetivosTablesExist(pool);
        } catch (tableError) {
            console.warn('⚠️ Erro ao criar/verificar tabelas de objetivos:', tableError.message);
            // Se não conseguir criar as tabelas, retornar array vazio
            return res.json([]);
        }

        // Verificar se as tabelas realmente existem
        const tableCheck = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME IN ('Objetivos', 'ObjetivoResponsaveis', 'ObjetivoCheckins')
        `);
        
        if (tableCheck.recordset.length < 3) {
            console.warn('⚠️ Tabelas de objetivos não estão completas, retornando array vazio.');
            return res.json([]);
        }

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT o.Id, o.titulo, o.descricao, o.criado_por, o.data_inicio, o.data_fim, o.status, o.progresso, o.created_at, o.updated_at,
                       c.NomeCompleto as criador_nome
                FROM Objetivos o
                LEFT JOIN Users c ON o.criado_por = c.Id
                WHERE o.Id IN (
                    SELECT DISTINCT objetivo_id FROM ObjetivoResponsaveis WHERE responsavel_id = @userId
                    UNION
                    SELECT Id FROM Objetivos WHERE criado_por = @userId
                )
                ORDER BY o.created_at DESC
            `);

        console.log('📋 Objetivos encontrados:', result.recordset.length);

        for (let objetivo of result.recordset) {
            try {
                const responsaveisResult = await pool.request()
                    .input('objetivoId', sql.Int, objetivo.Id)
                    .query(`
                        SELECT u.Id, u.NomeCompleto, u.DescricaoDepartamento, u.Departamento, orr.responsavel_id
                        FROM Users u JOIN ObjetivoResponsaveis orr ON u.Id = orr.responsavel_id
                        WHERE orr.objetivo_id = @objetivoId
                        ORDER BY orr.Id
                    `);
                objetivo.shared_responsaveis = responsaveisResult.recordset.map(r => ({
                    Id: r.Id,
                    NomeCompleto: r.NomeCompleto,
                    nome_responsavel: r.NomeCompleto,
                    DescricaoDepartamento: r.DescricaoDepartamento,
                    Departamento: r.Departamento
                }));
                
                // Adicionar responsavel_nome para compatibilidade com o frontend
                if (responsaveisResult.recordset.length > 0) {
                    objetivo.responsavel_nome = responsaveisResult.recordset[0].NomeCompleto;
                    objetivo.responsavel_descricao_departamento = responsaveisResult.recordset[0].DescricaoDepartamento || responsaveisResult.recordset[0].Departamento || null;
                    objetivo.responsavel_id = responsaveisResult.recordset[0].responsavel_id;
                }
            } catch (error) {
                console.log('⚠️ Erro ao buscar responsáveis do objetivo', objetivo.Id, ':', error.message);
                objetivo.shared_responsaveis = [];
            }
        }

        console.log('✅ Objetivos processados com sucesso');
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Erro ao buscar objetivos:', error);
        
        if (error.message.includes("Invalid object name")) {
            console.warn("⚠️ Tabelas de objetivos não encontradas, retornando array vazio.");
            return res.json([]);
        }
        
        if (error.message.includes("Invalid column name")) {
            console.warn("⚠️ Colunas de objetivos não encontradas, retornando array vazio.");
            return res.json([]);
        }
        
        res.status(500).json({ error: 'Erro interno do servidor ao buscar objetivos.' });
    }
};

/**
 * GET /api/objetivos/:id - Busca um objetivo específico por ID.
 */
exports.getObjetivoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('objetivoId', sql.Int, id)
            .query(`
                SELECT o.*, c.NomeCompleto as criador_nome
                FROM Objetivos o
                LEFT JOIN Users c ON o.criado_por = c.Id
                WHERE o.Id = @objetivoId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Objetivo não encontrado' });
        }
        
        const objetivo = result.recordset[0];

        // Buscar responsáveis compartilhados
        const responsaveisResult = await pool.request()
            .input('objetivoId', sql.Int, objetivo.Id)
            .query(`
                SELECT u.Id, u.NomeCompleto, u.DescricaoDepartamento, u.Departamento
                FROM Users u
                JOIN ObjetivoResponsaveis orr ON u.Id = orr.responsavel_id
                WHERE orr.objetivo_id = @objetivoId
                ORDER BY orr.Id
            `);
        objetivo.shared_responsaveis = responsaveisResult.recordset.map(resp => ({
            Id: resp.Id,
            NomeCompleto: resp.NomeCompleto,
            DescricaoDepartamento: resp.DescricaoDepartamento,
            Departamento: resp.Departamento
        }));
        if (responsaveisResult.recordset.length > 0) {
            objetivo.responsavel_nome = responsaveisResult.recordset[0].NomeCompleto;
            objetivo.responsavel_descricao_departamento = responsaveisResult.recordset[0].DescricaoDepartamento || responsaveisResult.recordset[0].Departamento || null;
            objetivo.responsavel_id = responsaveisResult.recordset[0].Id;
        }

        res.json(objetivo);
    } catch (error) {
        console.error('Erro ao buscar objetivo por ID:', error);
        res.status(500).json({ error: 'Erro ao buscar objetivo' });
    }
};

/**
 * PUT /api/objetivos/:id - Atualiza um objetivo existente.
 */
exports.updateObjetivo = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descricao, data_inicio, data_fim, responsaveis_ids } = req.body;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        await ensureObjetivosTablesExist(pool);

        const objetivoCheck = await pool.request().input('id', sql.Int, id).query(`SELECT criado_por, status FROM Objetivos WHERE Id = @id`);
        if (objetivoCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Objetivo não encontrado' });
        }
        if (objetivoCheck.recordset[0].criado_por !== userId && !hasFullAccess(req.session.user)) {
            return res.status(403).json({ error: 'Apenas o criador ou usuários com acesso total podem editar o objetivo.' });
        }

        // Recalcular status baseado nas novas datas
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataInicioDate = new Date(data_inicio);
        const dataFimDate = new Date(data_fim);
        
        let novoStatus;
        const statusAtual = objetivoCheck.recordset[0].status;
        
        // Manter status Concluído se já estiver concluído
        if (statusAtual === 'Concluído' || statusAtual === 'Aguardando Aprovação') {
            novoStatus = statusAtual;
        } else if (dataInicioDate > hoje) {
            novoStatus = 'Agendado';
        } else if (dataFimDate < hoje) {
            novoStatus = 'Expirado';
        } else {
            novoStatus = 'Ativo';
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('titulo', sql.NVarChar, titulo)
            .input('descricao', sql.NText, descricao)
            .input('data_inicio', sql.Date, data_inicio)
            .input('data_fim', sql.Date, data_fim)
            .input('status', sql.NVarChar, novoStatus)
            .query(`
                UPDATE Objetivos SET 
                titulo = @titulo, descricao = @descricao, data_inicio = @data_inicio,
                data_fim = @data_fim, status = @status, updated_at = GETDATE()
                WHERE Id = @id
            `);

        if (Array.isArray(responsaveis_ids)) {
            const normalizedIds = Array.from(
                new Set(
                    responsaveis_ids
                        .map(idValue => Number(idValue))
                        .filter(num => Number.isInteger(num) && num > 0)
                )
            );

            if (normalizedIds.length === 0) {
                return res.status(400).json({ error: 'Informe ao menos um responsável válido.' });
            }

            await pool.request()
                .input('objetivoId', sql.Int, id)
                .query(`DELETE FROM ObjetivoResponsaveis WHERE objetivo_id = @objetivoId`);

            for (const responsavelId of normalizedIds) {
                await pool.request()
                    .input('objetivoId', sql.Int, id)
                    .input('responsavelId', sql.Int, responsavelId)
                    .query(`INSERT INTO ObjetivoResponsaveis (objetivo_id, responsavel_id) VALUES (@objetivoId, @responsavelId)`);
            }
        }

        res.json({ success: true, message: 'Objetivo atualizado com sucesso', status: novoStatus });
    } catch (error) {
        console.error('Erro ao atualizar objetivo:', error);
        res.status(500).json({ error: 'Erro ao atualizar objetivo' });
    }
};

/**
 * DELETE /api/objetivos/:id - Exclui um objetivo.
 */
exports.deleteObjetivo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user.userId;
        const pool = await getDatabasePool();
        await ensureObjetivosTablesExist(pool);

        const objetivoCheck = await pool.request().input('id', sql.Int, id).query(`SELECT criado_por FROM Objetivos WHERE Id = @id`);
        if (objetivoCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Objetivo não encontrado' });
        }
        const isCreator = objetivoCheck.recordset[0].criado_por === userId;
        const canOverride = hasFullAccess(req.session.user);
        if (!isCreator && !canOverride) {
            return res.status(403).json({ error: 'Sem permissão para excluir: apenas o criador ou RH/T&D/Admin.' });
        }
        
        // A constraint ON DELETE CASCADE cuidará de excluir os check-ins e responsáveis
        await pool.request().input('id', sql.Int, id).query('DELETE FROM Objetivos WHERE Id = @id');
        
        res.json({ success: true, message: 'Objetivo excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar objetivo:', error);
        res.status(500).json({ error: 'Erro ao deletar objetivo' });
    }
};

/**
 * POST /api/objetivos/:id/checkin - Registra o progresso (check-in) de um objetivo.
 */
exports.createCheckin = async (req, res) => {
    try {
        const { id } = req.params;
        const { progresso, observacoes } = req.body;
        const userId = req.session.user.userId;
        
        const objetivoId = parseInt(id);
        if (isNaN(objetivoId)) return res.status(400).json({ error: 'ID do objetivo inválido' });
        if (progresso === undefined || progresso < 0 || progresso > 100) return res.status(400).json({ error: 'Progresso deve ser entre 0 e 100' });
        
        const pool = await getDatabasePool();
        
        // Verificar quem criou o objetivo
        const objetivoResult = await pool.request()
            .input('objetivoId', sql.Int, objetivoId)
            .query(`SELECT criado_por, titulo FROM Objetivos WHERE Id = @objetivoId`);
        
        if (objetivoResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Objetivo não encontrado' });
        }
        
        const criadoPor = objetivoResult.recordset[0].criado_por;
        const objetivoTitulo = objetivoResult.recordset[0].titulo || 'Objetivo';
        
        // Registrar check-in
        await pool.request()
            .input('objetivoId', sql.Int, objetivoId)
            .input('userId', sql.Int, userId)
            .input('progresso', sql.Decimal(5, 2), progresso)
            .input('observacoes', sql.NText, observacoes || '')
            .query(`INSERT INTO ObjetivoCheckins (objetivo_id, user_id, progresso, observacoes) VALUES (@objetivoId, @userId, @progresso, @observacoes)`);

        let statusUpdateMessage = '';
        let needsApproval = false;
        
        // Lógica de aprovação conforme especificação
        if (progresso >= 100) {
            if (userId === criadoPor) {
                // Se ele mesmo criou o objetivo, pode finalizar 100%
                await pool.request()
                    .input('objetivoId', sql.Int, objetivoId)
                    .input('progresso', sql.Decimal(5, 2), progresso)
                    .query(`UPDATE Objetivos SET status = 'Concluído', progresso = @progresso, updated_at = GETDATE() WHERE Id = @objetivoId`);
                statusUpdateMessage = 'Objetivo concluído!';
            } else {
                // Se não foi ele que criou, precisa de aprovação do gestor
                await pool.request()
                    .input('objetivoId', sql.Int, objetivoId)
                    .input('progresso', sql.Decimal(5, 2), progresso)
                    .query(`UPDATE Objetivos SET status = 'Aguardando Aprovação', progresso = @progresso, updated_at = GETDATE() WHERE Id = @objetivoId`);
                statusUpdateMessage = 'Objetivo aguardando aprovação do gestor';
                needsApproval = true;

                const pendingMessage = '[SISTEMA] Check-in de 100% enviado para aprovação do gestor.';
                await pool.request()
                    .input('objetivoId', sql.Int, objetivoId)
                    .input('userId', sql.Int, userId)
                    .input('progresso', sql.Decimal(5, 2), progresso)
                    .input('observacoes', sql.NText, pendingMessage)
                    .query(`
                        INSERT INTO ObjetivoCheckins (objetivo_id, user_id, progresso, observacoes)
                        VALUES (@objetivoId, @userId, @progresso, @observacoes)
                    `);
            }
        } else {
            // Atualizar progresso normalmente
            await pool.request()
                .input('objetivoId', sql.Int, objetivoId)
                .input('progresso', sql.Decimal(5, 2), progresso)
                .query(`UPDATE Objetivos SET progresso = @progresso, updated_at = GETDATE() WHERE Id = @objetivoId`);
        }

        const pointsResult = await addPointsToUser(pool, userId, 'checkin_objetivo', 5);

        // Notificações e emails relacionados ao check-in
        try {
            await ensureNotificationsTableExists();

            const [actorInfo, creatorInfo, responsaveisInfo] = await Promise.all([
                getUserBasicInfo(pool, userId),
                getUserBasicInfo(pool, criadoPor),
                getObjetivoResponsaveis(pool, objetivoId)
            ]);

            const actorName = (actorInfo && actorInfo.NomeCompleto) || req.session.user?.nomeCompleto || req.session.user?.NomeCompleto || req.session.user?.nome || 'Um responsável';

            const recipientsMap = new Map();
            (responsaveisInfo || []).forEach(resp => {
                if (resp && resp.Id) {
                    recipientsMap.set(resp.Id, resp);
                }
            });
            if (creatorInfo && creatorInfo.Id) {
                recipientsMap.set(creatorInfo.Id, creatorInfo);
            }
            recipientsMap.delete(userId);

            const isCompletionAttempt = needsApproval;
            const checkinMessage = isCompletionAttempt
                ? `${actorName} registrou 100% no objetivo "${objetivoTitulo}" e solicitou aprovação de conclusão.`
                : `${actorName} registrou um check-in de ${progresso}% no objetivo "${objetivoTitulo}".`;

            const notificationPromises = [];
            for (const [targetId] of recipientsMap.entries()) {
                notificationPromises.push(
                    createNotification(targetId, 'objetivo_checkin', checkinMessage, objetivoId)
                );
            }
            if (notificationPromises.length > 0) {
                await Promise.all(notificationPromises);
            }

            if (needsApproval && creatorInfo && creatorInfo.Id !== userId && creatorInfo.Email) {
                (async () => {
                    await emailService.sendObjetivoApprovalRequestEmail(
                        creatorInfo.Email,
                        creatorInfo.NomeCompleto || 'Gestor',
                        actorName,
                        objetivoTitulo
                    );
                })().catch(err => console.error('⚠️ Erro ao enviar email de solicitação de aprovação:', err.message));
            }
        } catch (notifyError) {
            console.error('⚠️ Erro ao processar notificações de objetivo:', notifyError.message || notifyError);
        }

        res.json({ 
            success: true, 
            message: 'Check-in registrado com sucesso',
            statusUpdate: statusUpdateMessage,
            needsApproval: needsApproval,
            ...pointsResult
        });
    } catch (error) {
        console.error('Erro ao registrar check-in:', error);
        res.status(500).json({ error: 'Erro ao registrar check-in' });
    }
};

/**
 * GET /api/objetivos/:id/checkins - Lista todos os check-ins de um objetivo.
 */
exports.getCheckins = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('objetivoId', sql.Int, id)
            .query(`
                SELECT oc.*, u.NomeCompleto as user_name
                FROM ObjetivoCheckins oc
                JOIN Users u ON oc.user_id = u.Id
                WHERE oc.objetivo_id = @objetivoId
                ORDER BY oc.created_at DESC
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar check-ins:', error);
        res.status(500).json({ error: 'Erro ao buscar check-ins' });
    }
};

const hierarchyManager = new HierarchyManager();

/**
 * GET /api/objetivos/filtros - Retorna filtros disponíveis (status, responsáveis).
 */
exports.getFiltros = async (req, res) => {
    try {
        const user = req.session.user;
        const pool = await getDatabasePool();

        const statusResult = await pool.request().query(`SELECT DISTINCT status FROM Objetivos WHERE status IS NOT NULL`);
        
        const responsePayload = {
            status: statusResult.recordset.map(r => r.status),
            responsaveis: []
        };

        if (!user) {
            return res.json(responsePayload);
        }

        const userIsGestor = Number(user.hierarchyLevel || 0) >= 3;

        if (userIsGestor) {
            const accessibleUsers = await hierarchyManager.getAccessibleUsers(user, { directReportsOnly: true });
            const directReports = accessibleUsers
                .filter(report => Number(report.userId) !== Number(user.userId))
                .map(report => ({
                    Id: report.userId,
                    NomeCompleto: report.nomeCompleto || report.NomeCompleto || report.nome || report.Nome || 'Colaborador',
                    Matricula: report.Matricula || report.matricula || null,
                    HierarchyPath: report.hierarchyPath || report.HierarchyPath || null,
                    Departamento: report.departamento || report.Departamento || '',
                    DescricaoDepartamento: report.descricaoDepartamento || report.DescricaoDepartamento || ''
                }));

            // inclui o próprio gestor para permitir atribuição a si mesmo
            const selfEntry = {
                Id: user.userId,
                NomeCompleto: user.nomeCompleto || user.NomeCompleto || user.UserName || 'Você',
                Matricula: user.Matricula || null,
                HierarchyPath: user.hierarchyPath || user.HierarchyPath || null,
                Departamento: user.departamento || user.Departamento || '',
                DescricaoDepartamento: user.descricaoDepartamento || user.DescricaoDepartamento || ''
            };

            const allResponsaveis = [selfEntry, ...directReports];

            // remover duplicados por Id
            const uniqueMap = new Map();
            allResponsaveis.forEach(resp => {
                if (!uniqueMap.has(resp.Id)) {
                    uniqueMap.set(resp.Id, resp);
                }
            });

            responsePayload.responsaveis = Array.from(uniqueMap.values()).sort((a, b) =>
                (a.NomeCompleto || '').localeCompare(b.NomeCompleto || '', 'pt-BR')
            );
        } else {
            responsePayload.responsaveis = [{
                Id: user.userId,
                NomeCompleto: user.nomeCompleto || user.NomeCompleto || user.UserName || 'Você',
                Matricula: user.Matricula || null,
                HierarchyPath: user.hierarchyPath || user.HierarchyPath || null,
                Departamento: user.departamento || user.Departamento || '',
                DescricaoDepartamento: user.descricaoDepartamento || user.DescricaoDepartamento || ''
            }];
        }

        res.json(responsePayload);
    } catch (error) {
        console.error('❌ Erro ao buscar filtros:', error);
        res.status(500).json({ error: 'Erro ao buscar filtros' });
    }
};

/**
 * GET /api/objetivos/debug - Debug do sistema de objetivos.
 */
exports.debugObjetivos = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        
        const pool = await getDatabasePool();
        
        // Verificar se as tabelas existem
        const tablesCheck = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME IN ('Objetivos', 'ObjetivoResponsaveis', 'ObjetivoCheckins')
        `);
        
        // Verificar hierarquia do usuário
        const hierarchyLevel = user.hierarchyLevel || 0;
        
        // Buscar equipe se for gestor
        let equipe = [];
        let hierarquiaInfo = null;
        
        if (hierarchyLevel >= 3) {
            // Primeiro, verificar HIERARQUIA_CC
            try {
                const hierarquiaResult = await pool.request()
                    .input('userMatricula', sql.NVarChar, user.Matricula || '')
                    .query(`
                        SELECT DISTINCT MATRICULA_SUBORDINADO, MATRICULA_GESTOR
                        FROM HIERARQUIA_CC 
                        WHERE MATRICULA_GESTOR = @userMatricula
                    `);
                
                console.log('🔍 Debug - Subordinados na HIERARQUIA_CC:', hierarquiaResult.recordset.length);
                hierarquiaInfo = {
                    gestor: user.Matricula,
                    subordinados: hierarquiaResult.recordset.map(r => r.MATRICULA_SUBORDINADO)
                };
                
                if (hierarquiaResult.recordset.length > 0) {
                    const subordinadosMatriculas = hierarquiaResult.recordset.map(r => r.MATRICULA_SUBORDINADO);
                    
                    // Buscar usuários pelas matrículas dos subordinados
                    const placeholders = subordinadosMatriculas.map((_, index) => `@matricula${index}`).join(',');
                    const equipeQuery = `
                        SELECT DISTINCT u.Id, u.NomeCompleto, u.Matricula, u.HierarchyPath
                        FROM Users u 
                        WHERE u.IsActive = 1 
                        AND (
                            u.Id = @userId 
                            OR u.Matricula IN (${placeholders})
                        )
                        ORDER BY u.NomeCompleto
                    `;
                    
                    const request = pool.request().input('userId', sql.Int, user.userId);
                    subordinadosMatriculas.forEach((matricula, index) => {
                        request.input(`matricula${index}`, sql.NVarChar, matricula);
                    });
                    
                    const equipeResult = await request.query(equipeQuery);
                    equipe = equipeResult.recordset;
                }
            } catch (error) {
                console.log('⚠️ Debug - Erro ao buscar via HIERARQUIA_CC:', error.message);
            }
        }
        
        const response = {
            success: true,
            debug: {
                user: {
                    id: user.userId,
                    nome: user.nomeCompleto || user.nome,
                    matricula: user.Matricula || user.matricula,
                    departamento: user.Departamento || user.departamento,
                    hierarchyLevel: hierarchyLevel,
                    hierarchyPath: user.HierarchyPath || user.hierarchyPath
                },
                tables: {
                    existem: tablesCheck.recordset.map(t => t.TABLE_NAME),
                    faltam: ['Objetivos', 'ObjetivoResponsaveis', 'ObjetivoCheckins'].filter(
                        table => !tablesCheck.recordset.some(t => t.TABLE_NAME === table)
                    )
                },
                equipe: {
                    isManager: hierarchyLevel >= 3,
                    totalMembros: equipe.length,
                    membros: equipe
                },
                hierarquia: {
                    info: hierarquiaInfo,
                    gestorMatricula: user.Matricula,
                    userHierarchyPath: user.HierarchyPath
                }
            }
        };
        
        console.log('🔍 Debug de objetivos:', response.debug);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erro no debug de objetivos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/objetivos/debug/hierarquia - Debug da tabela HIERARQUIA_CC.
 */
exports.debugHierarquia = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        
        const pool = await getDatabasePool();
        
        console.log('🔍 Debug da HIERARQUIA_CC para usuário:', user.Matricula);
        
        // Verificar se a tabela HIERARQUIA_CC existe
        const tableCheck = await pool.request().query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'HIERARQUIA_CC'
        `);
        
        if (tableCheck.recordset[0].count === 0) {
            return res.json({
                success: false,
                error: 'Tabela HIERARQUIA_CC não encontrada',
                debug: {
                    user: {
                        matricula: user.Matricula,
                        nome: user.nomeCompleto || user.nome
                    }
                }
            });
        }
        
        // Buscar dados da HIERARQUIA_CC para o usuário atual
        const hierarquiaResult = await pool.request()
            .input('userMatricula', sql.NVarChar, user.Matricula || '')
            .query(`
                SELECT TOP 10 MATRICULA_GESTOR, MATRICULA_SUBORDINADO, DEPTO_ATUAL, DESCRICAO_ATUAL
                FROM HIERARQUIA_CC 
                WHERE MATRICULA_GESTOR = @userMatricula
                ORDER BY MATRICULA_SUBORDINADO
            `);
        
        // Buscar dados gerais da HIERARQUIA_CC
        const geralResult = await pool.request().query(`
            SELECT TOP 10 MATRICULA_GESTOR, MATRICULA_SUBORDINADO, DEPTO_ATUAL, DESCRICAO_ATUAL
            FROM HIERARQUIA_CC 
            ORDER BY MATRICULA_GESTOR, MATRICULA_SUBORDINADO
        `);
        
        // Buscar usuários com matrículas similares
        const similarResult = await pool.request()
            .input('userMatricula', sql.NVarChar, user.Matricula || '')
            .query(`
                SELECT TOP 10 Id, NomeCompleto, Matricula, HierarchyPath
                FROM Users 
                WHERE Matricula LIKE '%' + @userMatricula + '%'
                OR @userMatricula LIKE '%' + Matricula + '%'
                ORDER BY Matricula
            `);
        
        const response = {
            success: true,
            debug: {
                user: {
                    matricula: user.Matricula,
                    nome: user.nomeCompleto || user.nome,
                    hierarchyLevel: user.hierarchyLevel || 0
                },
                table: {
                    exists: true,
                    totalRecords: hierarquiaResult.recordset.length
                },
                hierarquia: {
                    subordinados: hierarquiaResult.recordset,
                    totalSubordinados: hierarquiaResult.recordset.length
                },
                geral: {
                    sample: geralResult.recordset
                },
                similar: {
                    usuarios: similarResult.recordset
                }
            }
        };
        
        console.log('🔍 Debug da hierarquia:', response.debug);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erro no debug da hierarquia:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/objetivos/debug/hierarquia/estrutura - Análise completa da estrutura HIERARQUIA_CC.
 */
exports.debugEstruturaHierarquia = async (req, res) => {
    try {
        const user = req.session.user;
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }
        
        const pool = await getDatabasePool();
        
        console.log('🔍 Análise completa da HIERARQUIA_CC para usuário:', user.Matricula);
        
        // Verificar estrutura da tabela HIERARQUIA_CC
        const columnsResult = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'HIERARQUIA_CC'
            ORDER BY ORDINAL_POSITION
        `);
        
        // Buscar dados específicos do usuário atual
        const userHierarquiaResult = await pool.request()
            .input('userMatricula', sql.NVarChar, user.Matricula || '')
            .query(`
                SELECT TOP 20 *
                FROM HIERARQUIA_CC 
                WHERE MATRICULA_GESTOR = @userMatricula
                ORDER BY MATRICULA_SUBORDINADO
            `);
        
        // Buscar dados onde o usuário é subordinado
        const userSubordinadoResult = await pool.request()
            .input('userMatricula', sql.NVarChar, user.Matricula || '')
            .query(`
                SELECT TOP 10 *
                FROM HIERARQUIA_CC 
                WHERE MATRICULA_SUBORDINADO = @userMatricula
                ORDER BY MATRICULA_GESTOR
            `);
        
        // Buscar dados gerais da tabela para entender a estrutura
        const geralResult = await pool.request().query(`
            SELECT TOP 20 *
            FROM HIERARQUIA_CC 
            ORDER BY MATRICULA_GESTOR, MATRICULA_SUBORDINADO
        `);
        
        // Buscar estatísticas da tabela
        const statsResult = await pool.request().query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT MATRICULA_GESTOR) as total_gestores,
                COUNT(DISTINCT MATRICULA_SUBORDINADO) as total_subordinados
            FROM HIERARQUIA_CC
        `);
        
        // Buscar usuários do mesmo departamento
        const mesmoDepartamentoResult = await pool.request()
            .input('userDepartamento', sql.NVarChar, user.Departamento || '')
            .query(`
                SELECT TOP 10 Id, NomeCompleto, Matricula, HierarchyPath, Departamento
                FROM Users 
                WHERE Departamento = @userDepartamento AND IsActive = 1
                ORDER BY NomeCompleto
            `);
        
        const response = {
            success: true,
            debug: {
                user: {
                    matricula: user.Matricula,
                    nome: user.nomeCompleto || user.nome,
                    departamento: user.Departamento,
                    hierarchyLevel: user.hierarchyLevel || 0
                },
                table: {
                    columns: columnsResult.recordset,
                    stats: statsResult.recordset[0]
                },
                hierarquia: {
                    comoGestor: {
                        records: userHierarquiaResult.recordset,
                        total: userHierarquiaResult.recordset.length
                    },
                    comoSubordinado: {
                        records: userSubordinadoResult.recordset,
                        total: userSubordinadoResult.recordset.length
                    }
                },
                geral: {
                    sample: geralResult.recordset
                },
                departamento: {
                    colegas: mesmoDepartamentoResult.recordset
                }
            }
        };
        
        console.log('🔍 Análise completa da hierarquia:', response.debug);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erro na análise da hierarquia:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * POST /api/objetivos/:id/approve - Aprova a conclusão de um objetivo (acesso gestor).
 */
exports.approveObjetivo = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getDatabasePool();
        
        const userId = req.session.user.userId;

        const objetivoInfoResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT titulo, criado_por FROM Objetivos WHERE Id = @id`);

        if (objetivoInfoResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Objetivo não encontrado' });
        }

        const objetivoTitulo = objetivoInfoResult.recordset[0].titulo || 'Objetivo';
        const criadorId = objetivoInfoResult.recordset[0].criado_por;

        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE Objetivos SET status = 'Concluído', progresso = 100, updated_at = GETDATE() WHERE Id = @id`);

        await pool.request()
            .input('objetivoId', sql.Int, id)
            .input('userId', sql.Int, userId)
            .input('progresso', sql.Decimal(5, 2), 100)
            .input('observacoes', sql.NText, '[SISTEMA] Conclusão aprovada pelo gestor.')
            .query(`
                INSERT INTO ObjetivoCheckins (objetivo_id, user_id, progresso, observacoes)
                VALUES (@objetivoId, @userId, @progresso, @observacoes)
            `);

        try {
            await ensureNotificationsTableExists();

            const [approverInfo, creatorInfo, responsaveisInfo] = await Promise.all([
                getUserBasicInfo(pool, userId),
                getUserBasicInfo(pool, criadorId),
                getObjetivoResponsaveis(pool, id)
            ]);

            const approverName = (approverInfo && approverInfo.NomeCompleto) || req.session.user?.nomeCompleto || req.session.user?.NomeCompleto || req.session.user?.nome || 'Gestor';

            const recipientsMap = new Map();
            (responsaveisInfo || []).forEach(resp => {
                if (resp && resp.Id) {
                    recipientsMap.set(resp.Id, resp);
                }
            });
            if (creatorInfo && creatorInfo.Id) {
                recipientsMap.set(creatorInfo.Id, creatorInfo);
            }
            recipientsMap.delete(userId);

            const approvalMessage = `${approverName} aprovou a conclusão do objetivo "${objetivoTitulo}".`;
            const notificationPromises = [];
            for (const [targetId] of recipientsMap.entries()) {
                notificationPromises.push(
                    createNotification(targetId, 'objetivo_aprovado', approvalMessage, Number(id))
                );
            }
            if (notificationPromises.length > 0) {
                await Promise.all(notificationPromises);
            }

            const emailPromises = (responsaveisInfo || [])
                .filter(resp => resp && resp.Id !== criadorId && resp.Id !== userId && resp.Email)
                .map(resp =>
                    (async () => {
                        await emailService.sendObjetivoConclusionApprovedEmail(
                            resp.Email,
                            resp.NomeCompleto,
                            approverName,
                            objetivoTitulo
                        );
                    })().catch(err => console.error('⚠️ Erro ao enviar email de aprovação de objetivo:', err.message))
                );

            if (emailPromises.length > 0) {
                Promise.allSettled(emailPromises).catch(err => console.error('⚠️ Erro ao processar emails de aprovação:', err.message));
            }
        } catch (notifyError) {
            console.error('⚠️ Erro ao processar notificações/emails de aprovação:', notifyError.message || notifyError);
        }
        
        res.json({ success: true, message: 'Objetivo aprovado e concluído com sucesso' });
    } catch (error) {
        console.error('Erro ao aprovar objetivo:', error);
        res.status(500).json({ error: 'Erro ao aprovar objetivo' });
    }
};

/**
 * POST /api/objetivos/:id/reject - Rejeita a conclusão de um objetivo (acesso gestor).
 */
exports.rejectObjetivo = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const userId = req.session.user.userId;
        const motivoLimpo = (motivo || '').trim();

        if (!motivoLimpo) {
            return res.status(400).json({ error: 'Informe o motivo da rejeição.' });
        }

        const pool = await getDatabasePool();

        const objetivoInfoResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT titulo, criado_por FROM Objetivos WHERE Id = @id`);

        if (objetivoInfoResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Objetivo não encontrado' });
        }

        const objetivoTitulo = objetivoInfoResult.recordset[0].titulo || 'Objetivo';
        const criadorId = objetivoInfoResult.recordset[0].criado_por;
        
        // Buscar a última porcentagem <> 100 (mais recente)
        const ultimoCheckinResult = await pool.request()
            .input('objetivoId', sql.Int, id)
            .query(`
                SELECT TOP 1 progresso 
                FROM ObjetivoCheckins 
                WHERE objetivo_id = @objetivoId 
                  AND progresso < 100 
                ORDER BY created_at DESC
            `);
        
        let progressoAnterior = 0;
        if (ultimoCheckinResult.recordset.length > 0) {
            progressoAnterior = ultimoCheckinResult.recordset[0].progresso;
        }
        
        // Reverter para a última porcentagem <> 100
        await pool.request()
            .input('id', sql.Int, id)
            .input('progresso', sql.Decimal(5, 2), progressoAnterior)
            .query(`UPDATE Objetivos SET status = 'Ativo', progresso = @progresso, updated_at = GETDATE() WHERE Id = @id`);

        const rejectionMessage = `[SISTEMA] Conclusão rejeitada pelo gestor. Motivo: ${motivoLimpo}.`;
        await pool.request()
            .input('objetivoId', sql.Int, id)
            .input('userId', sql.Int, userId)
            .input('progresso', sql.Decimal(5, 2), progressoAnterior)
            .input('observacoes', sql.NText, rejectionMessage)
            .query(`
                INSERT INTO ObjetivoCheckins (objetivo_id, user_id, progresso, observacoes)
                VALUES (@objetivoId, @userId, @progresso, @observacoes)
            `);

        try {
            await ensureNotificationsTableExists();

            const [approverInfo, creatorInfo, responsaveisInfo] = await Promise.all([
                getUserBasicInfo(pool, userId),
                getUserBasicInfo(pool, criadorId),
                getObjetivoResponsaveis(pool, id)
            ]);

            const approverName = (approverInfo && approverInfo.NomeCompleto) || req.session.user?.nomeCompleto || req.session.user?.NomeCompleto || req.session.user?.nome || 'Gestor';
            const motivoLimitado = motivoLimpo.length > 250 ? `${motivoLimpo.slice(0, 247)}...` : motivoLimpo;

            const recipientsMap = new Map();
            (responsaveisInfo || []).forEach(resp => {
                if (resp && resp.Id) {
                    recipientsMap.set(resp.Id, resp);
                }
            });
            if (creatorInfo && creatorInfo.Id) {
                recipientsMap.set(creatorInfo.Id, creatorInfo);
            }
            recipientsMap.delete(userId);

            const rejectionNotification = `${approverName} rejeitou a conclusão do objetivo "${objetivoTitulo}". Motivo: ${motivoLimitado}`;
            const notificationPromises = [];
            for (const [targetId] of recipientsMap.entries()) {
                notificationPromises.push(
                    createNotification(targetId, 'objetivo_rejeitado', rejectionNotification, Number(id))
                );
            }
            if (notificationPromises.length > 0) {
                await Promise.all(notificationPromises);
            }

            const emailPromises = (responsaveisInfo || [])
                .filter(resp => resp && resp.Id !== criadorId && resp.Id !== userId && resp.Email)
                .map(resp =>
                    (async () => {
                        await emailService.sendObjetivoConclusionRejectedEmail(
                            resp.Email,
                            resp.NomeCompleto,
                            approverName,
                            objetivoTitulo,
                            motivoLimpo,
                            progressoAnterior
                        );
                    })().catch(err => console.error('⚠️ Erro ao enviar email de rejeição de objetivo:', err.message))
                );

            if (emailPromises.length > 0) {
                Promise.allSettled(emailPromises).catch(err => console.error('⚠️ Erro ao processar emails de rejeição:', err.message));
            }
        } catch (notifyError) {
            console.error('⚠️ Erro ao processar notificações/emails de rejeição:', notifyError.message || notifyError);
        }
        
        res.json({ 
            success: true, 
            message: `Objetivo rejeitado e revertido para ${progressoAnterior}%`, 
            motivo: motivoLimpo,
            progressoAnterior 
        });
    } catch (error) {
        console.error('Erro ao rejeitar objetivo:', error);
        res.status(500).json({ error: 'Erro ao rejeitar objetivo' });
    }
};