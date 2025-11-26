const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const AvaliacoesManager = require('../services/avaliacoesManager');

// =================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO (Helpers)
// =================================================================

/**
 * Verifica se o usuário tem permissão de administrador sobre as avaliações.
 * Acesso concedido para RH, T&D, e administradores do sistema.
 * @param {object} usuario - O objeto do usuário da sessão.
 * @returns {boolean}
 */
function verificarPermissaoAvaliacoesAdmin(usuario) {
    if (!usuario) return false;

    // Usar descricaoDepartamento ou DescricaoDepartamento que contém o texto completo
    const departamento = (usuario.descricaoDepartamento || usuario.DescricaoDepartamento || usuario.departamento || '').toUpperCase().trim();

    const isHR = departamento.includes('SUPERVISAO RH') || 
                 departamento.includes('RH') || 
                 departamento.includes('RECURSOS HUMANOS');
    const isTD = departamento.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
                 departamento.includes('TREINAMENTO') ||
                 departamento.includes('DESENVOLVIMENTO') ||
                 departamento.includes('T&D');
    const isDeptAdm = (departamento.includes('DEPARTAMENTO ADM') && departamento.includes('SESMT')) ||
                      (departamento.startsWith('DEPARTAMENTO ADM/RH'));
    const isAdmin = usuario.role === 'Administrador';

    return isAdmin || isHR || isTD || isDeptAdm;
}


// =================================================================
// CONTROLLERS (Funções exportadas para as rotas)
// =================================================================

/**
 * GET /api/avaliacoes/minhas - Lista as avaliações pendentes e concluídas do usuário logado.
 */
exports.getMinhasAvaliacoes = async (req, res) => {
    try {
        const user = req.session.user;
        const pool = await getDatabasePool();
        const temPermissaoAdmin = verificarPermissaoAvaliacoesAdmin(user);
        
        console.log('🔍 Buscando avaliações para usuário:', user.userId, 'Admin:', temPermissaoAdmin);
        
        const avaliacoes = await AvaliacoesManager.buscarAvaliacoesUsuario(pool, user.userId, temPermissaoAdmin);
        
        console.log('✅ Avaliações encontradas:', avaliacoes.length);
        res.json(avaliacoes);
    } catch (error) {
        console.error('❌ Erro ao buscar minhas avaliações:', error);
        
        // Se for erro de tabela não encontrada, retornar array vazio
        if (error.message && error.message.includes('Invalid object name')) {
            console.log('⚠️ Tabelas de avaliações não encontradas, retornando array vazio');
            return res.json([]);
        }
        
        res.status(500).json({ error: 'Erro ao buscar suas avaliações' });
    }
};

/**
 * GET /api/avaliacoes/todas - Lista todas as avaliações do sistema (Acesso restrito).
 */
exports.getAllAvaliacoes = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const pool = await getDatabasePool();
        const result = await pool.request().query(`
            SELECT 
                a.Id, a.UserId, a.GestorId, a.Matricula, a.DataAdmissao, a.DataCriacao, 
                a.DataLimiteResposta, a.StatusAvaliacao, a.RespostaColaboradorConcluida,
                a.RespostaGestorConcluida, t.Nome as TipoAvaliacao, u.NomeCompleto,
                u.Departamento, g.NomeCompleto as NomeGestor
            FROM Avaliacoes a
            LEFT JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            INNER JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            ORDER BY a.DataCriacao DESC
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar todas as avaliações:', error);
        res.status(500).json({ error: 'Erro ao buscar todas as avaliações' });
    }
};

/**
 * GET /api/avaliacoes/:id - Busca uma avaliação específica pelo ID.
 */
exports.getAvaliacaoById = async (req, res) => {
    try {
        const user = req.session.user;
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('id', sql.Int, parseInt(id))
            .query(`
                SELECT a.*, t.Nome as TipoAvaliacao, u.NomeCompleto, u.Departamento, g.NomeCompleto as NomeGestor
                FROM Avaliacoes a
                LEFT JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
                INNER JOIN Users u ON a.UserId = u.Id
                LEFT JOIN Users g ON a.GestorId = g.Id
                WHERE a.Id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        const avaliacao = result.recordset[0];
        const temPermissao = avaliacao.UserId === user.userId ||
                            avaliacao.GestorId === user.userId ||
                            verificarPermissaoAvaliacoesAdmin(user);

        if (!temPermissao) {
            return res.status(403).json({ error: 'Você não tem permissão para visualizar esta avaliação' });
        }

        res.json(avaliacao);
    } catch (error) {
        console.error('Erro ao buscar avaliação por ID:', error);
        res.status(500).json({ error: 'Erro ao buscar avaliação' });
    }
};

/**
 * POST /api/avaliacoes/responder - Salva as respostas de uma avaliação.
 */
exports.responderAvaliacao = async (req, res) => {
    try {
        const user = req.session.user;
        const { avaliacaoId, respostas, tipoRespondente } = req.body;

        if (!avaliacaoId || !respostas || !Array.isArray(respostas) || !tipoRespondente) {
            return res.status(400).json({ error: 'Dados de resposta inválidos' });
        }
        
        const pool = await getDatabasePool();

        // Validações de permissão e status da avaliação
        const avaliacao = await AvaliacoesManager.validarPermissaoResposta(pool, avaliacaoId, user.userId, tipoRespondente);

        // Salvar cada resposta
        for (const resposta of respostas) {
            await AvaliacoesManager.salvarRespostaAvaliacao(pool, {
                avaliacaoId,
                perguntaId: resposta.perguntaId,
                resposta: resposta.resposta,
                respondidoPor: user.userId,
                tipoRespondente,
                //... outros campos de resposta
            });
        }

        // Marcar a parte da avaliação como concluída
        await AvaliacoesManager.concluirAvaliacao(pool, avaliacaoId, tipoRespondente);

        res.json({ success: true, message: 'Respostas salvas com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar respostas da avaliação:', error);
        // Retorna o erro específico pego pelo Manager (ex: 'Avaliação expirada')
        res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao salvar respostas' });
    }
};

/**
 * GET /api/avaliacoes/:id/respostas - Busca as perguntas e respostas de uma avaliação.
 */
exports.getRespostasAvaliacao = async (req, res) => {
    try {
        const user = req.session.user;
        const { id } = req.params;
        const pool = await getDatabasePool();
        const avaliacao = await AvaliacoesManager.getAvaliacao(pool, id);

        if (!avaliacao) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        // Verificar permissão
        const temPermissao = avaliacao.UserId === user.userId ||
                            avaliacao.GestorId === user.userId ||
                            verificarPermissaoAvaliacoesAdmin(user);

        if (!temPermissao) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const [perguntas, minhasRespostas, respostasOutraParte] = await Promise.all([
            AvaliacoesManager.buscarPerguntasAvaliacao(pool, id),
            AvaliacoesManager.buscarRespostasPorUsuario(pool, id, user.userId),
            AvaliacoesManager.buscarRespostasOutraParte(pool, id, user.userId)
        ]);
        
        res.json({ perguntas, minhasRespostas, respostasOutraParte });

    } catch (error) {
        console.error('Erro ao buscar respostas da avaliação:', error);
        res.status(500).json({ error: 'Erro ao buscar respostas' });
    }
};

/**
 * GET /api/avaliacoes/questionario/:tipo - Busca o modelo de questionário padrão.
 */
exports.getQuestionarioPadrao = async (req, res) => {
    try {
        const { tipo } = req.params; // '45' ou '90'
        if (tipo !== '45' && tipo !== '90') {
            return res.status(400).json({ error: 'Tipo de questionário inválido' });
        }
        
        const pool = await getDatabasePool();
        const questionario = await AvaliacoesManager.buscarQuestionarioPadrao(pool, tipo);
        
        res.json(questionario);
    } catch (error) {
        console.error('Erro ao buscar questionário padrão:', error);
        res.status(500).json({ error: 'Erro ao buscar questionário' });
    }
};

/**
 * PUT /api/avaliacoes/questionario/:tipo - Atualiza o questionário padrão (Acesso restrito).
 */
exports.updateQuestionarioPadrao = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo } = req.params;
        const { perguntas } = req.body;
        
        if ((tipo !== '45' && tipo !== '90') || !Array.isArray(perguntas)) {
            return res.status(400).json({ error: 'Dados inválidos' });
        }

        const pool = await getDatabasePool();
        await AvaliacoesManager.atualizarQuestionarioPadrao(pool, tipo, perguntas);

        res.json({ success: true, message: 'Questionário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar questionário:', error);
        res.status(500).json({ error: 'Erro ao atualizar questionário' });
    }
};

/**
 * POST /api/avaliacoes/:id/reabrir - Reabre uma avaliação expirada (Acesso restrito).
 */
exports.reabrirAvaliacao = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }
        
        const { id } = req.params;
        const { novaDataLimite } = req.body;

        if (!novaDataLimite) {
            return res.status(400).json({ error: 'Nova data limite é obrigatória' });
        }
        
        const pool = await getDatabasePool();
        await AvaliacoesManager.reabrirAvaliacao(pool, id, novaDataLimite);

        res.json({ success: true, message: 'Avaliação reaberta com sucesso' });
    } catch (error) {
        console.error('Erro ao reabrir avaliação:', error);
        res.status(500).json({ error: 'Erro ao reabrir avaliação' });
    }
};

/**
 * POST /api/avaliacoes/verificar - Aciona manualmente a verificação e criação de novas avaliações (Acesso restrito).
 */
exports.verificarAvaliacoes = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }
        
        const pool = await getDatabasePool();
        const resultado = await AvaliacoesManager.verificarECriarAvaliacoes(pool);

        res.json({ 
            success: true, 
            message: 'Verificação concluída',
            ...resultado
        });
    } catch (error) {
        console.error('Erro ao verificar avaliações:', error);
        res.status(500).json({ error: 'Erro ao verificar avaliações' });
    }
};

/**
 * GET /api/avaliacoes/templates/:tipo/perguntas - Busca todas as perguntas de um template (Acesso restrito).
 */
exports.getTemplatePerguntas = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo } = req.params; // '45' ou '90'
        if (tipo !== '45' && tipo !== '90') {
            return res.status(400).json({ error: 'Tipo de template inválido' });
        }

        const tipoId = tipo === '45' ? 1 : 2;
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .input('tipoId', sql.Int, tipoId)
            .query(`
                SELECT * FROM TemplatesPerguntasAvaliacao 
                WHERE TipoAvaliacaoId = @tipoId 
                ORDER BY Ordem ASC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar perguntas do template:', error);
        res.status(500).json({ error: 'Erro ao buscar perguntas do template' });
    }
};

/**
 * POST /api/avaliacoes/templates/:tipo/perguntas - Adiciona uma nova pergunta ao template (Acesso restrito).
 */
exports.addTemplatePergunta = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo } = req.params;
        const { pergunta, tipoPergunta, obrigatoria, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima } = req.body;

        if (!pergunta || !tipoPergunta) {
            return res.status(400).json({ error: 'Pergunta e tipo são obrigatórios' });
        }

        const tipoId = tipo === '45' ? 1 : 2;
        const pool = await getDatabasePool();

        // Buscar a última ordem
        const maxOrdem = await pool.request()
            .input('tipoId', sql.Int, tipoId)
            .query('SELECT ISNULL(MAX(Ordem), 0) as maxOrdem FROM TemplatesPerguntasAvaliacao WHERE TipoAvaliacaoId = @tipoId');
        
        const novaOrdem = maxOrdem.recordset[0].maxOrdem + 1;

        const result = await pool.request()
            .input('tipoId', sql.Int, tipoId)
            .input('pergunta', sql.NText, pergunta)
            .input('tipoPergunta', sql.VarChar, tipoPergunta)
            .input('ordem', sql.Int, novaOrdem)
            .input('obrigatoria', sql.Bit, obrigatoria !== undefined ? obrigatoria : 1)
            .input('escalaMinima', sql.Int, escalaMinima || null)
            .input('escalaMaxima', sql.Int, escalaMaxima || null)
            .input('escalaLabelMinima', sql.NVarChar, escalaLabelMinima || null)
            .input('escalaLabelMaxima', sql.NVarChar, escalaLabelMaxima || null)
            .query(`
                INSERT INTO TemplatesPerguntasAvaliacao 
                (TipoAvaliacaoId, Pergunta, TipoPergunta, Ordem, Obrigatoria,
                 EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima, Ativa, CriadoEm)
                OUTPUT INSERTED.*
                VALUES (@tipoId, @pergunta, @tipoPergunta, @ordem, @obrigatoria,
                        @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima, 1, GETDATE())
            `);

        res.json({ success: true, pergunta: result.recordset[0] });
    } catch (error) {
        console.error('Erro ao adicionar pergunta ao template:', error);
        res.status(500).json({ error: 'Erro ao adicionar pergunta' });
    }
};

/**
 * PUT /api/avaliacoes/templates/:tipo/perguntas/:id - Atualiza uma pergunta específica do template (Acesso restrito).
 */
exports.updateTemplatePergunta = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo, id } = req.params;
        const { pergunta, tipoPergunta, obrigatoria, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima, ativa } = req.body;

        if (!pergunta || !tipoPergunta) {
            return res.status(400).json({ error: 'Pergunta e tipo são obrigatórios' });
        }

        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('pergunta', sql.NText, pergunta)
            .input('tipoPergunta', sql.VarChar, tipoPergunta)
            .input('obrigatoria', sql.Bit, obrigatoria !== undefined ? obrigatoria : 1)
            .input('escalaMinima', sql.Int, escalaMinima || null)
            .input('escalaMaxima', sql.Int, escalaMaxima || null)
            .input('escalaLabelMinima', sql.NVarChar, escalaLabelMinima || null)
            .input('escalaLabelMaxima', sql.NVarChar, escalaLabelMaxima || null)
            .input('ativa', sql.Bit, ativa !== undefined ? ativa : 1)
            .query(`
                UPDATE TemplatesPerguntasAvaliacao 
                SET Pergunta = @pergunta, 
                    TipoPergunta = @tipoPergunta, 
                    Obrigatoria = @obrigatoria,
                    EscalaMinima = @escalaMinima,
                    EscalaMaxima = @escalaMaxima,
                    EscalaLabelMinima = @escalaLabelMinima,
                    EscalaLabelMaxima = @escalaLabelMaxima,
                    Ativa = @ativa
                WHERE Id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada' });
        }

        res.json({ success: true, message: 'Pergunta atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar pergunta do template:', error);
        res.status(500).json({ error: 'Erro ao atualizar pergunta' });
    }
};

/**
 * DELETE /api/avaliacoes/templates/:tipo/perguntas/:id - Remove uma pergunta do template (Acesso restrito).
 */
exports.deleteTemplatePergunta = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo, id } = req.params;
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM TemplatesPerguntasAvaliacao WHERE Id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada' });
        }

        // Reordenar as perguntas restantes
        const tipoId = tipo === '45' ? 1 : 2;
        const perguntas = await pool.request()
            .input('tipoId', sql.Int, tipoId)
            .query('SELECT Id FROM TemplatesPerguntasAvaliacao WHERE TipoAvaliacaoId = @tipoId ORDER BY Ordem ASC');

        for (let i = 0; i < perguntas.recordset.length; i++) {
            await pool.request()
                .input('id', sql.Int, perguntas.recordset[i].Id)
                .input('ordem', sql.Int, i + 1)
                .query('UPDATE TemplatesPerguntasAvaliacao SET Ordem = @ordem WHERE Id = @id');
        }

        res.json({ success: true, message: 'Pergunta removida com sucesso' });
    } catch (error) {
        console.error('Erro ao remover pergunta do template:', error);
        res.status(500).json({ error: 'Erro ao remover pergunta' });
    }
};

/**
 * PUT /api/avaliacoes/templates/:tipo/perguntas/reordenar - Reordena as perguntas do template (Acesso restrito).
 */
exports.reordenarTemplatePerguntas = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo } = req.params;
        const { perguntasIds } = req.body; // Array de IDs na nova ordem

        if (!Array.isArray(perguntasIds) || perguntasIds.length === 0) {
            return res.status(400).json({ error: 'Array de IDs inválido' });
        }

        const pool = await getDatabasePool();

        for (let i = 0; i < perguntasIds.length; i++) {
            await pool.request()
                .input('id', sql.Int, perguntasIds[i])
                .input('ordem', sql.Int, i + 1)
                .query('UPDATE TemplatesPerguntasAvaliacao SET Ordem = @ordem WHERE Id = @id');
        }

        res.json({ success: true, message: 'Perguntas reordenadas com sucesso' });
    } catch (error) {
        console.error('Erro ao reordenar perguntas do template:', error);
        res.status(500).json({ error: 'Erro ao reordenar perguntas' });
    }
};