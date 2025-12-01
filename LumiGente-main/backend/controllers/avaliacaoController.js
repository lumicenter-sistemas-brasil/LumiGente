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
                COALESCE(u.DescricaoDepartamento, u.Departamento, 'Não informado') as Departamento, 
                g.NomeCompleto as NomeGestor
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

        console.log('📨 Recebendo resposta de avaliação:', { avaliacaoId, tipoRespondente, userId: user.userId, numRespostas: respostas?.length });

        if (!avaliacaoId || !respostas || !Array.isArray(respostas) || !tipoRespondente) {
            return res.status(400).json({ error: 'Dados de resposta inválidos' });
        }
        
        const pool = await getDatabasePool();

        // Validações de permissão e status da avaliação
        const avaliacao = await AvaliacoesManager.validarPermissaoResposta(pool, avaliacaoId, user.userId, tipoRespondente);

        console.log('💾 Salvando', respostas.length, 'respostas...');
        
        // Salvar cada resposta
        for (const resposta of respostas) {
            await AvaliacoesManager.salvarRespostaAvaliacao(pool, {
                avaliacaoId,
                perguntaId: resposta.perguntaId,
                resposta: resposta.resposta,
                respondidoPor: user.userId,
                tipoRespondente
            });
        }
        
        console.log('✅ Respostas salvas. Marcando avaliação como concluída...');

        // Marcar a parte da avaliação como concluída
        await AvaliacoesManager.concluirAvaliacao(pool, avaliacaoId, tipoRespondente);
        
        console.log('✅ Avaliação marcada como concluída');

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
        const avaliacao = await AvaliacoesManager.getAvaliacao(id);

        if (!avaliacao) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        const temPermissao = avaliacao.UserId === user.userId ||
                            avaliacao.GestorId === user.userId ||
                            verificarPermissaoAvaliacoesAdmin(user);

        if (!temPermissao) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const [perguntas, minhasRespostas, respostasOutraParte] = await Promise.all([
            AvaliacoesManager.buscarPerguntasAvaliacao(id),
            AvaliacoesManager.buscarRespostasPorUsuario(id, user.userId),
            AvaliacoesManager.buscarRespostasOutraParte(id, user.userId)
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

        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';
        const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';
        const pool = await getDatabasePool();
        
        const result = await pool.request()
            .query(`
                SELECT q.*, 
                    (SELECT COUNT(*) FROM ${tabelaOpcoes} o WHERE o.PerguntaId = q.Id) as NumOpcoes
                FROM ${tabelaQuestionario} q
                ORDER BY q.Ordem ASC
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
        const { pergunta, tipoPergunta, obrigatoria, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima, opcoes } = req.body;

        console.log('📝 Dados recebidos:', { tipo, pergunta, tipoPergunta, obrigatoria, opcoes });

        if (!pergunta || !tipoPergunta) {
            return res.status(400).json({ error: 'Pergunta e tipo são obrigatórios' });
        }

        const pool = await getDatabasePool();
        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';

        // Buscar a última ordem
        const maxOrdem = await pool.request()
            .query(`SELECT ISNULL(MAX(Ordem), 0) as maxOrdem FROM ${tabelaQuestionario}`);
        
        const novaOrdem = maxOrdem.recordset[0].maxOrdem + 1;
        const result = await pool.request()
            .input('pergunta', sql.NText, pergunta)
            .input('tipoPergunta', sql.VarChar(50), tipoPergunta)
            .input('ordem', sql.Int, novaOrdem)
            .input('obrigatoria', sql.Bit, obrigatoria !== undefined ? obrigatoria : 1)
            .input('escalaMinima', sql.Int, escalaMinima || null)
            .input('escalaMaxima', sql.Int, escalaMaxima || null)
            .input('escalaLabelMinima', sql.NVarChar(255), escalaLabelMinima || null)
            .input('escalaLabelMaxima', sql.NVarChar(255), escalaLabelMaxima || null)
            .query(`
                INSERT INTO ${tabelaQuestionario}
                (Pergunta, TipoPergunta, Ordem, Obrigatoria, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima)
                OUTPUT INSERTED.Id
                VALUES (@pergunta, @tipoPergunta, @ordem, @obrigatoria, @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima)
            `);

        const perguntaId = result.recordset[0].Id;
        console.log('✅ Pergunta criada com ID:', perguntaId);

        // Salvar opções se for múltipla escolha
        if (tipoPergunta === 'multipla_escolha' && opcoes && Array.isArray(opcoes) && opcoes.length > 0) {
            const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';
            console.log('💾 Salvando', opcoes.length, 'opções na tabela', tabelaOpcoes);
            
            for (let i = 0; i < opcoes.length; i++) {
                await pool.request()
                    .input('perguntaId', sql.Int, perguntaId)
                    .input('textoOpcao', sql.NVarChar(500), opcoes[i])
                    .input('ordem', sql.Int, i + 1)
                    .query(`INSERT INTO ${tabelaOpcoes} (PerguntaId, TextoOpcao, Ordem) VALUES (@perguntaId, @textoOpcao, @ordem)`);
                console.log('  ✓ Opção', i + 1, 'salva:', opcoes[i]);
            }
        }

        console.log('✅ Pergunta salva com sucesso!');
        res.json({ success: true, pergunta: result.recordset[0] });
    } catch (error) {
        console.error('❌ Erro ao adicionar pergunta ao template:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Erro ao adicionar pergunta: ' + error.message });
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
        const { pergunta, tipoPergunta, obrigatoria, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima, opcoes } = req.body;

        if (!pergunta || !tipoPergunta) {
            return res.status(400).json({ error: 'Pergunta e tipo são obrigatórios' });
        }

        const pool = await getDatabasePool();
        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('pergunta', sql.NText, pergunta)
            .input('tipoPergunta', sql.VarChar(50), tipoPergunta)
            .input('obrigatoria', sql.Bit, obrigatoria !== undefined ? obrigatoria : 1)
            .input('escalaMinima', sql.Int, escalaMinima || null)
            .input('escalaMaxima', sql.Int, escalaMaxima || null)
            .input('escalaLabelMinima', sql.NVarChar(255), escalaLabelMinima || null)
            .input('escalaLabelMaxima', sql.NVarChar(255), escalaLabelMaxima || null)
            .query(`
                UPDATE ${tabelaQuestionario}
                SET Pergunta = @pergunta, 
                    TipoPergunta = @tipoPergunta, 
                    Obrigatoria = @obrigatoria,
                    EscalaMinima = @escalaMinima,
                    EscalaMaxima = @escalaMaxima,
                    EscalaLabelMinima = @escalaLabelMinima,
                    EscalaLabelMaxima = @escalaLabelMaxima
                WHERE Id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada' });
        }

        // Atualizar opções se for múltipla escolha
        if (tipoPergunta === 'multipla_escolha' && opcoes && Array.isArray(opcoes) && opcoes.length > 0) {
            const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';
            
            await pool.request()
                .input('perguntaId', sql.Int, id)
                .query(`DELETE FROM ${tabelaOpcoes} WHERE PerguntaId = @perguntaId`);
            
            for (let i = 0; i < opcoes.length; i++) {
                await pool.request()
                    .input('perguntaId', sql.Int, id)
                    .input('textoOpcao', sql.NVarChar(500), opcoes[i])
                    .input('ordem', sql.Int, i + 1)
                    .query(`INSERT INTO ${tabelaOpcoes} (PerguntaId, TextoOpcao, Ordem) VALUES (@perguntaId, @textoOpcao, @ordem)`);
            }
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
        console.log('🗑️ Tentando excluir pergunta ID:', id, 'do tipo:', tipo);
        
        const pool = await getDatabasePool();
        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';
        const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';

        // Verificar se existe
        const check = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT Id FROM ${tabelaQuestionario} WHERE Id = @id`);
        
        console.log('Pergunta encontrada:', check.recordset.length > 0);
        
        await pool.request()
            .input('perguntaId', sql.Int, id)
            .query(`DELETE FROM ${tabelaOpcoes} WHERE PerguntaId = @perguntaId`);

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`DELETE FROM ${tabelaQuestionario} WHERE Id = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada' });
        }

        const perguntas = await pool.request()
            .query(`SELECT Id FROM ${tabelaQuestionario} ORDER BY Ordem ASC`);

        for (let i = 0; i < perguntas.recordset.length; i++) {
            await pool.request()
                .input('id', sql.Int, perguntas.recordset[i].Id)
                .input('ordem', sql.Int, i + 1)
                .query(`UPDATE ${tabelaQuestionario} SET Ordem = @ordem WHERE Id = @id`);
        }

        res.json({ success: true, message: 'Pergunta removida com sucesso' });
    } catch (error) {
        console.error('Erro ao remover pergunta do template:', error);
        res.status(500).json({ error: 'Erro ao remover pergunta' });
    }
};

/**
 * GET /api/avaliacoes/questionario/:tipo/perguntas/:id/opcoes - Busca opções de uma pergunta (Acesso público).
 */
exports.getOpcoesPerguntaPublico = async (req, res) => {
    try {
        const { tipo, id } = req.params;
        const pool = await getDatabasePool();
        const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';

        const result = await pool.request()
            .input('perguntaId', sql.Int, id)
            .query(`SELECT * FROM ${tabelaOpcoes} WHERE PerguntaId = @perguntaId ORDER BY Ordem ASC`);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar opções da pergunta:', error);
        res.status(500).json({ error: 'Erro ao buscar opções' });
    }
};

/**
 * GET /api/avaliacoes/templates/:tipo/perguntas/:id/opcoes - Busca opções de uma pergunta (Acesso restrito).
 */
exports.getOpcoesPergunta = async (req, res) => {
    try {
        const user = req.session.user;
        if (!verificarPermissaoAvaliacoesAdmin(user)) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { tipo, id } = req.params;
        const pool = await getDatabasePool();
        const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';

        const result = await pool.request()
            .input('perguntaId', sql.Int, id)
            .query(`SELECT * FROM ${tabelaOpcoes} WHERE PerguntaId = @perguntaId ORDER BY Ordem ASC`);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar opções da pergunta:', error);
        res.status(500).json({ error: 'Erro ao buscar opções' });
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
        const { perguntasIds } = req.body;

        if (!Array.isArray(perguntasIds) || perguntasIds.length === 0) {
            return res.status(400).json({ error: 'Array de IDs inválido' });
        }

        const pool = await getDatabasePool();
        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';

        for (let i = 0; i < perguntasIds.length; i++) {
            await pool.request()
                .input('id', sql.Int, perguntasIds[i])
                .input('ordem', sql.Int, i + 1)
                .query(`UPDATE ${tabelaQuestionario} SET Ordem = @ordem WHERE Id = @id`);
        }

        res.json({ success: true, message: 'Perguntas reordenadas com sucesso' });
    } catch (error) {
        console.error('Erro ao reordenar perguntas do template:', error);
        res.status(500).json({ error: 'Erro ao reordenar perguntas' });
    }
};