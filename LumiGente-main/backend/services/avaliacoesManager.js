const sql = require('mssql');
const { getDatabasePool } = require('../config/db'); // Importa a conexão centralizada
const OracleConnectionHelper = require('../utils/oracleConnectionHelper');

/**
 * Classe estática para gerenciar toda a lógica de negócio das Avaliações de Desempenho.
 */
class AvaliacoesManager {

    /**
     * Verifica e cria automaticamente avaliações de 45 e 90 dias para novos colaboradores.
     * Usa o campo created_at do usuário como data de admissão.
     */
    static async verificarECriarAvaliacoes() {
        try {
            const pool = await getDatabasePool();

            // Buscar usuários que devem ter avaliações (ativos e não externos)
            // Usa a data de admissão da TAB_HIST_SRA (funcionários com STATUS_GERAL = 'ATIVO')
            // ALTERAÇÃO: Removido JOIN com HIERARQUIA_CC para evitar erros de conexão Oracle na query principal
            const primaryQuery = `
                SELECT 
                    u.Id, 
                    u.Matricula, 
                    u.NomeCompleto, 
                    s.DTA_ADMISSAO as DataAdmissao,
                    DATEDIFF(DAY, s.DTA_ADMISSAO, GETDATE()) as DiasNaEmpresa,
                    NULL as GestorId
                FROM Users u
                INNER JOIN TAB_HIST_SRA s ON s.CPF = u.CPF AND s.MATRICULA = u.Matricula AND s.STATUS_GERAL = 'ATIVO'
                WHERE 
                    u.IsActive = 1 
                    AND (u.IsExternal IS NULL OR u.IsExternal = 0)
                    AND s.DTA_ADMISSAO IS NOT NULL
                    AND DATEDIFF(DAY, s.DTA_ADMISSAO, GETDATE()) <= 100
            `;

            const fallbackQuery = `
                SELECT 
                    u.Id, 
                    u.Matricula, 
                    u.NomeCompleto, 
                    u.created_at as DataAdmissao,
                    DATEDIFF(DAY, u.created_at, GETDATE()) as DiasNaEmpresa,
                    NULL as GestorId
                FROM Users u
                WHERE 
                    u.IsActive = 1 
                    AND (u.IsExternal IS NULL OR u.IsExternal = 0)
                    AND u.created_at IS NOT NULL
                    AND DATEDIFF(DAY, u.created_at, GETDATE()) <= 100
            `;

            const novosFuncionarios = await OracleConnectionHelper.executeWithFallback(
                pool,
                primaryQuery,
                fallbackQuery,
                2 // máximo 2 tentativas
            );

            let criadas45 = 0;
            let criadas90 = 0;

            for (const func of novosFuncionarios.recordset) {
                const diasNaEmpresa = func.DiasNaEmpresa;

                // Tentar buscar gestor atualizado (pois removemos o JOIN da query principal)
                try {
                    const gestorId = await this.buscarGestor(pool, func.Matricula);
                    if (gestorId) {
                        func.GestorId = gestorId;
                    }
                } catch (err) {
                    console.warn(`⚠️ Não foi possível buscar gestor para ${func.NomeCompleto}: ${err.message}`);
                }

                // Verificar se deve criar avaliação de 45 dias
                // Cria quando estiver entre 35 dias (10 antes) e 45 dias
                if (diasNaEmpresa >= 35 && diasNaEmpresa <= 50) {
                    const avaliacao45existente = await pool.request()
                        .input('userId', sql.Int, func.Id)
                        .input('tipoId', sql.Int, 1)
                        .query('SELECT Id FROM Avaliacoes WHERE UserId = @userId AND TipoAvaliacaoId = @tipoId');

                    if (avaliacao45existente.recordset.length === 0) {
                        await this.criarAvaliacao(func, 1);
                        criadas45++;
                    }
                }

                // Verificar se deve criar avaliação de 90 dias
                // Cria quando estiver entre 80 dias (10 antes) e 90 dias
                if (diasNaEmpresa >= 80 && diasNaEmpresa <= 100) {
                    const avaliacao90existente = await pool.request()
                        .input('userId', sql.Int, func.Id)
                        .input('tipoId', sql.Int, 2)
                        .query('SELECT Id FROM Avaliacoes WHERE UserId = @userId AND TipoAvaliacaoId = @tipoId');

                    if (avaliacao90existente.recordset.length === 0) {
                        await this.criarAvaliacao(func, 2);
                        criadas90++;
                    }
                }
            }

            return {
                message: "Verificação concluída.",
                criadas45dias: criadas45,
                criadas90dias: criadas90
            };
        } catch (error) {
            console.error('❌ Erro no job de verificar e criar avaliações:', error);
            throw error;
        }
    }

    /**
     * Cria uma nova entrada de avaliação para um funcionário.
     * Abre 10 dias antes e fecha no dia exato (45 ou 90 dias).
     */
    static async criarAvaliacao(funcionario, tipoAvaliacaoId) {
        const pool = await getDatabasePool();
        const diasPrazo = tipoAvaliacaoId === 1 ? 45 : 90;
        const diasAntecipacao = 10;

        // Data de abertura: 10 dias antes do prazo
        const dataAbertura = new Date(funcionario.DataAdmissao);
        dataAbertura.setDate(dataAbertura.getDate() + diasPrazo - diasAntecipacao);

        // Data limite: no dia exato do prazo
        const dataLimite = new Date(funcionario.DataAdmissao);
        dataLimite.setDate(dataLimite.getDate() + diasPrazo);

        // Criar a avaliação
        const insertResult = await pool.request()
            .input('userId', sql.Int, funcionario.Id)
            .input('gestorId', sql.Int, funcionario.GestorId || null)
            .input('matricula', sql.VarChar, funcionario.Matricula || '')
            .input('dataAdmissao', sql.Date, funcionario.DataAdmissao)
            .input('tipoId', sql.Int, tipoAvaliacaoId)
            .input('dataLimite', sql.Date, dataLimite)
            .query(`
                INSERT INTO Avaliacoes (UserId, GestorId, Matricula, DataAdmissao, TipoAvaliacaoId, DataLimiteResposta, StatusAvaliacao, DataCriacao)
                OUTPUT INSERTED.Id
                VALUES (@userId, @gestorId, @matricula, @dataAdmissao, @tipoId, @dataLimite, 'Agendada', GETDATE())
            `);

        const avaliacaoId = insertResult.recordset[0].Id;

        // Copiar as perguntas do template padrão para a avaliação (snapshot)
        const perguntas = await pool.request()
            .input('tipoId', sql.Int, tipoAvaliacaoId)
            .query(`
                SELECT * FROM TemplatesPerguntasAvaliacao 
                WHERE TipoAvaliacaoId = @tipoId AND Ativa = 1
                ORDER BY Ordem
            `);

        for (const pergunta of perguntas.recordset) {
            await pool.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .input('pergunta', sql.NText, pergunta.Pergunta)
                .input('tipoPergunta', sql.VarChar, pergunta.TipoPergunta)
                .input('ordem', sql.Int, pergunta.Ordem)
                .input('obrigatoria', sql.Bit, pergunta.Obrigatoria)
                .input('escalaMinima', sql.Int, pergunta.EscalaMinima)
                .input('escalaMaxima', sql.Int, pergunta.EscalaMaxima)
                .input('escalaLabelMinima', sql.NVarChar, pergunta.EscalaLabelMinima)
                .input('escalaLabelMaxima', sql.NVarChar, pergunta.EscalaLabelMaxima)
                .query(`
                    INSERT INTO PerguntasAvaliacao 
                    (AvaliacaoId, Pergunta, TipoPergunta, Ordem, Obrigatoria, 
                     EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima, CriadoEm)
                    VALUES (@avaliacaoId, @pergunta, @tipoPergunta, @ordem, @obrigatoria,
                            @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima, GETDATE())
                `);
        }

        console.log(`-> Avaliação de ${diasPrazo} dias criada para: ${funcionario.NomeCompleto} (Fecha em: ${dataLimite.toLocaleDateString('pt-BR')})`);
    }

    /**
     * Busca as avaliações associadas a um usuário (como avaliado ou avaliador).
     */
    static async buscarAvaliacoesUsuario(pool, userId, temPermissaoAdmin) {
        let query = `
            SELECT a.*, t.Nome as TipoAvaliacao, u.NomeCompleto, g.NomeCompleto as NomeGestor
            FROM Avaliacoes a
            JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
        `;
        if (!temPermissaoAdmin) {
            query += ` WHERE a.UserId = @userId OR a.GestorId = @userId`;
        }
        query += ` ORDER BY 
            CASE a.StatusAvaliacao 
                WHEN 'Pendente' THEN 1 
                WHEN 'Agendada' THEN 2 
                WHEN 'Concluída' THEN 3 
                WHEN 'Expirada' THEN 4 
                ELSE 5 
            END, 
            a.DataLimiteResposta ASC`;

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(query);

        return result.recordset;
    }

    /**
     * Busca uma avaliação específica pelo ID.
     */
    static async getAvaliacao(avaliacaoId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('id', sql.Int, avaliacaoId)
            .query('SELECT * FROM Avaliacoes WHERE Id = @id');
        return result.recordset[0];
    }

    /**
     * Valida se um usuário pode responder a uma avaliação e retorna os dados da avaliação.
     */
    static async validarPermissaoResposta(avaliacaoId, userId, tipoRespondente) {
        const avaliacao = await this.getAvaliacao(avaliacaoId);

        if (!avaliacao) {
            const err = new Error('Avaliação não encontrada');
            err.statusCode = 404;
            throw err;
        }
        if (avaliacao.StatusAvaliacao !== 'Pendente') {
            const err = new Error(`Esta avaliação está com status "${avaliacao.StatusAvaliacao}" e não pode ser respondida.`);
            err.statusCode = 400;
            throw err;
        }
        if (new Date() > new Date(avaliacao.DataLimiteResposta)) {
            const err = new Error('O prazo para responder esta avaliação expirou.');
            err.statusCode = 400;
            throw err;
        }

        if (tipoRespondente === 'Colaborador' && avaliacao.UserId !== userId) {
            throw new Error('Permissão negada para responder como colaborador.');
        }
        if (tipoRespondente === 'Gestor' && avaliacao.GestorId !== userId) {
            throw new Error('Permissão negada para responder como gestor.');
        }
        if (tipoRespondente === 'Colaborador' && avaliacao.RespostaColaboradorConcluida) {
            throw new Error('Você já concluiu esta avaliação.');
        }
        if (tipoRespondente === 'Gestor' && avaliacao.RespostaGestorConcluida) {
            throw new Error('Você já concluiu esta avaliação como gestor.');
        }

        return avaliacao;
    }

    /**
     * Busca as perguntas que foram salvas para uma avaliação específica no momento da sua criação.
     */
    static async buscarPerguntasAvaliacao(avaliacaoId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query('SELECT * FROM PerguntasSalvasAvaliacao WHERE AvaliacaoId = @avaliacaoId ORDER BY Ordem');
        return result.recordset;
    }

    /**
     * Busca as respostas que um determinado usuário deu para uma avaliação.
     */
    static async buscarRespostasPorUsuario(avaliacaoId, userId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM RespostasAvaliacoes WHERE AvaliacaoId = @avaliacaoId AND RespondidoPor = @userId ORDER BY PerguntaId');
        return result.recordset;
    }

    /**
     * Busca as respostas da "outra parte" em uma avaliação (a do gestor se quem pede é o colaborador, e vice-versa).
     */
    static async buscarRespostasOutraParte(avaliacaoId, userId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM RespostasAvaliacoes WHERE AvaliacaoId = @avaliacaoId AND RespondidoPor != @userId ORDER BY PerguntaId');
        return result.recordset;
    }

    /**
     * Salva uma resposta individual de uma avaliação no banco de dados.
     */
    static async salvarRespostaAvaliacao(respostaData) {
        const pool = await getDatabasePool();
        const { avaliacaoId, perguntaId, resposta, respondidoPor, tipoRespondente } = respostaData;

        await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .input('perguntaId', sql.Int, perguntaId)
            .input('resposta', sql.NText, resposta)
            .input('respondidoPor', sql.Int, respondidoPor)
            .input('tipoRespondente', sql.NVarChar, tipoRespondente)
            .query(`
                INSERT INTO RespostasAvaliacoes (AvaliacaoId, PerguntaId, Resposta, RespondidoPor, TipoRespondente)
                VALUES (@avaliacaoId, @perguntaId, @resposta, @respondidoPor, @tipoRespondente)
            `);
    }

    /**
     * Marca a parte de uma avaliação (do colaborador ou do gestor) como concluída.
     */
    static async concluirAvaliacao(avaliacaoId, tipoRespondente) {
        const pool = await getDatabasePool();
        let campoData = tipoRespondente === 'Colaborador' ? 'DataRespostaColaborador' : 'DataRespostaGestor';
        let campoConcluida = tipoRespondente === 'Colaborador' ? 'RespostaColaboradorConcluida' : 'RespostaGestorConcluida';

        await pool.request()
            .input('id', sql.Int, avaliacaoId)
            .query(`
                UPDATE Avaliacoes 
                SET ${campoConcluida} = 1, ${campoData} = GETDATE()
                WHERE Id = @id
            `);

        const checkCompletion = await pool.request().input('id', sql.Int, avaliacaoId).query('SELECT RespostaColaboradorConcluida, RespostaGestorConcluida FROM Avaliacoes WHERE Id = @id');
        if (checkCompletion.recordset[0].RespostaColaboradorConcluida && checkCompletion.recordset[0].RespostaGestorConcluida) {
            await pool.request().input('id', sql.Int, avaliacaoId).query(`UPDATE Avaliacoes SET StatusAvaliacao = 'Concluída' WHERE Id = @id`);
        }
    }

    /**
     * Busca o questionário template padrão (45 ou 90 dias) para exibição.
     */
    static async buscarQuestionarioPadrao(tipo) { // tipo '45' ou '90'
        const pool = await getDatabasePool();
        const tipoId = tipo === '45' ? 1 : 2;

        const result = await pool.request()
            .input('tipoId', sql.Int, tipoId)
            .query(`
                SELECT * FROM TemplatesPerguntasAvaliacao 
                WHERE TipoAvaliacaoId = @tipoId AND Ativa = 1
                ORDER BY Ordem
            `);
        return result.recordset;
    }

    /**
     * Atualiza as perguntas de um questionário template padrão.
     */
    static async atualizarQuestionarioPadrao(tipo, perguntas) {
        const pool = await getDatabasePool();
        const tipoId = tipo === '45' ? 1 : 2;

        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // Remove perguntas antigas do template
            await new sql.Request(transaction)
                .input('tipoId', sql.Int, tipoId)
                .query('DELETE FROM TemplatesPerguntasAvaliacao WHERE TipoAvaliacaoId = @tipoId');

            // Insere novas perguntas
            for (let i = 0; i < perguntas.length; i++) {
                const p = perguntas[i];
                await new sql.Request(transaction)
                    .input('tipoId', sql.Int, tipoId)
                    .input('pergunta', sql.NText, p.Pergunta)
                    .input('tipoPergunta', sql.VarChar, p.TipoPergunta || 'texto')
                    .input('ordem', sql.Int, i + 1)
                    .input('obrigatoria', sql.Bit, p.Obrigatoria !== undefined ? p.Obrigatoria : 1)
                    .input('escalaMinima', sql.Int, p.EscalaMinima || null)
                    .input('escalaMaxima', sql.Int, p.EscalaMaxima || null)
                    .input('escalaLabelMinima', sql.NVarChar, p.EscalaLabelMinima || null)
                    .input('escalaLabelMaxima', sql.NVarChar, p.EscalaLabelMaxima || null)
                    .query(`
                        INSERT INTO TemplatesPerguntasAvaliacao 
                        (TipoAvaliacaoId, Pergunta, TipoPergunta, Ordem, Obrigatoria,
                         EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima, Ativa)
                        VALUES (@tipoId, @pergunta, @tipoPergunta, @ordem, @obrigatoria,
                                @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima, 1)
                    `);
            }

            await transaction.commit();
            console.log(`✅ Template de questionário ${tipo} dias atualizado com sucesso`);
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao atualizar questionário template:', error);
            throw error;
        }
    }

    /**
     * Reabre uma avaliação que foi expirada.
     */
    static async reabrirAvaliacao(avaliacaoId, novaDataLimite) {
        const pool = await getDatabasePool();
        await pool.request()
            .input('id', sql.Int, avaliacaoId)
            .input('novaData', sql.DateTime, novaDataLimite)
            .query(`
                UPDATE Avaliacoes
                SET DataLimiteResposta = @novaData, StatusAvaliacao = 'Pendente', AtualizadoEm = GETDATE()
                WHERE Id = @id AND StatusAvaliacao = 'Expirada'
            `);
    }

    /**
     * Busca o ID do gestor para uma matrícula específica.
     * Tenta acessar a view HIERARQUIA_CC (Oracle). Se falhar, retorna null.
     */
    static async buscarGestor(pool, matricula) {
        try {
            const result = await pool.request()
                .input('matricula', sql.VarChar, matricula)
                .query(`
                    SELECT TOP 1 u.Id 
                    FROM HIERARQUIA_CC h
                    JOIN Users u ON u.CPF = h.CPF_RESPONSAVEL AND u.IsActive = 1
                    WHERE h.RESPONSAVEL_ATUAL = @matricula
                `);

            if (result.recordset.length > 0) {
                return result.recordset[0].Id;
            }
            return null;
        } catch (error) {
            // Silencia erro de conexão Oracle aqui para não quebrar o fluxo principal
            return null;
        }
    }
}

module.exports = AvaliacoesManager;