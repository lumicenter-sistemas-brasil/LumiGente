const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const AvaliacoesManager = require('./avaliacoesManager');

class AvaliacoesDesempenhoManager {

    static async criarAvaliacao(dados) {
        const pool = await getDatabasePool();
        const { userIds, titulo, dataLimite, criadoPor, perguntas } = dados;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const avaliacoesCriadas = [];

            for (const userId of userIds) {
                let gestorId = null;
                try {
                    gestorId = await AvaliacoesManager.buscarGestor(transaction, userId);
                } catch (err) {
                    console.warn(`⚠️ Não foi possível buscar gestor para userId ${userId}: ${err.message}`);
                }

                const result = await transaction.request()
                    .input('userId', sql.Int, userId)
                    .input('gestorId', sql.Int, gestorId)
                    .input('titulo', sql.NVarChar, titulo)
                    .input('dataLimite', sql.DateTime, dataLimite)
                    .input('criadoPor', sql.Int, criadoPor)
                    .query(`
                        INSERT INTO AvaliacoesDesempenho 
                        (UserId, GestorId, Titulo, DataLimiteAutoAvaliacao, DataLimiteGestor, CriadoPor, Status)
                        OUTPUT INSERTED.Id
                        VALUES (@userId, @gestorId, @titulo, @dataLimite, @dataLimite, @criadoPor, 'Pendente')
                    `);

                const avaliacaoId = result.recordset[0].Id;
                avaliacoesCriadas.push(avaliacaoId);

                if (perguntas && Array.isArray(perguntas) && perguntas.length > 0) {
                    console.log(`📝 Criando ${perguntas.length} perguntas personalizadas para avaliação ${avaliacaoId}`);

                    for (const pergunta of perguntas) {
                        const perguntaResult = await transaction.request()
                            .input('avaliacaoId', sql.Int, avaliacaoId)
                            .input('texto', sql.NText, pergunta.texto)
                            .input('tipo', sql.NVarChar, pergunta.tipo)
                            .input('obrigatoria', sql.Bit, pergunta.obrigatoria)
                            .input('ordem', sql.Int, pergunta.ordem)
                            .input('escalaMinima', sql.Int, pergunta.escalaMinima || null)
                            .input('escalaMaxima', sql.Int, pergunta.escalaMaxima || null)
                            .input('escalaLabelMinima', sql.NVarChar, pergunta.escalaLabelMinima || null)
                            .input('escalaLabelMaxima', sql.NVarChar, pergunta.escalaLabelMaxima || null)
                            .query(`
                                INSERT INTO PerguntasAvaliacaoDesempenho 
                                (AvaliacaoId, Texto, Tipo, Obrigatoria, Ordem, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima)
                                OUTPUT INSERTED.Id
                                VALUES (@avaliacaoId, @texto, @tipo, @obrigatoria, @ordem, @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima)
                            `);

                        const perguntaId = perguntaResult.recordset[0].Id;

                        if (pergunta.tipo === 'multipla_escolha' && pergunta.opcoes && Array.isArray(pergunta.opcoes)) {
                            for (let i = 0; i < pergunta.opcoes.length; i++) {
                                await transaction.request()
                                    .input('perguntaId', sql.Int, perguntaId)
                                    .input('textoOpcao', sql.NVarChar, pergunta.opcoes[i])
                                    .input('ordem', sql.Int, i + 1)
                                    .query(`
                                        INSERT INTO OpcoesPerguntasAvaliacaoDesempenho 
                                        (PerguntaId, TextoOpcao, Ordem)
                                        VALUES (@perguntaId, @textoOpcao, @ordem)
                                    `);
                            }
                        }
                    }
                    console.log(`✅ Perguntas personalizadas criadas para avaliação ${avaliacaoId}`);
                } else {
                    // Buscar perguntas do questionário padrão
                    console.log('ℹ️ Nenhuma pergunta personalizada fornecida. Buscando questionário padrão...');

                    const perguntasPadraoResult = await transaction.request()
                        .query('SELECT * FROM PerguntasDesempenho WHERE Ativo = 1 ORDER BY Ordem');

                    const perguntasPadrao = perguntasPadraoResult.recordset;

                    if (perguntasPadrao.length === 0) {
                        throw new Error('Nenhuma pergunta foi adicionada e não há questionário padrão definido.');
                    }

                    console.log(`📝 Usando ${perguntasPadrao.length} perguntas do questionário padrão para avaliação ${avaliacaoId}`);

                    for (const p of perguntasPadrao) {
                        const perguntaResult = await transaction.request()
                            .input('avaliacaoId', sql.Int, avaliacaoId)
                            .input('texto', sql.NText, p.Texto)
                            .input('tipo', sql.NVarChar, p.Tipo)
                            .input('obrigatoria', sql.Bit, p.Obrigatoria)
                            .input('ordem', sql.Int, p.Ordem)
                            .input('escalaMinima', sql.Int, p.EscalaMinima || null)
                            .input('escalaMaxima', sql.Int, p.EscalaMaxima || null)
                            .input('escalaLabelMinima', sql.NVarChar, p.EscalaLabelMinima || null)
                            .input('escalaLabelMaxima', sql.NVarChar, p.EscalaLabelMaxima || null)
                            .query(`
                                INSERT INTO PerguntasAvaliacaoDesempenho 
                                (AvaliacaoId, Texto, Tipo, Obrigatoria, Ordem, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima)
                                OUTPUT INSERTED.Id
                                VALUES (@avaliacaoId, @texto, @tipo, @obrigatoria, @ordem, @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima)
                            `);

                        const perguntaId = perguntaResult.recordset[0].Id;

                        // Processar opções se houver (JSON string no banco)
                        if (p.Tipo === 'multipla_escolha' && p.Opcoes) {
                            let opcoes = [];
                            try {
                                opcoes = typeof p.Opcoes === 'string' ? JSON.parse(p.Opcoes) : p.Opcoes;
                            } catch (e) {
                                console.warn(`⚠️ Erro ao parsear opções da pergunta padrão ${p.Id}:`, e);
                                opcoes = [];
                            }

                            if (Array.isArray(opcoes)) {
                                for (let i = 0; i < opcoes.length; i++) {
                                    await transaction.request()
                                        .input('perguntaId', sql.Int, perguntaId)
                                        .input('textoOpcao', sql.NVarChar, opcoes[i])
                                        .input('ordem', sql.Int, i + 1)
                                        .query(`
                                            INSERT INTO OpcoesPerguntasAvaliacaoDesempenho 
                                            (PerguntaId, TextoOpcao, Ordem)
                                            VALUES (@perguntaId, @textoOpcao, @ordem)
                                        `);
                                }
                            }
                        }
                    }
                }
            }

            await transaction.commit();
            console.log(`✅ ${avaliacoesCriadas.length} avaliações criadas com sucesso`);
            return avaliacoesCriadas;
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao criar avaliação:', error);
            throw error;
        }
    }

    static async listarAvaliacoes(filtros = {}) {
        const pool = await getDatabasePool();
        let query = `
            SELECT a.*, u.NomeCompleto, u.NomeCompleto as NomeColaborador, g.NomeCompleto as NomeGestor, 
                   ISNULL(u.DescricaoDepartamento, u.Departamento) as Departamento,
                   (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaColaborador IS NOT NULL) as RespostasColaboradorCount,
                   (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaGestor IS NOT NULL) as RespostasGestorCount,
                   (SELECT COUNT(*) FROM PerguntasAvaliacaoDesempenho p WHERE p.AvaliacaoId = a.Id) as PerguntasEspecificasCount
            FROM AvaliacoesDesempenho a
            INNER JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE 1=1
        `;

        const request = pool.request();

        if (filtros.userId) {
            query += ' AND a.UserId = @userId';
            request.input('userId', sql.Int, filtros.userId);
        }

        if (filtros.gestorId) {
            query += ' AND a.GestorId = @gestorId';
            request.input('gestorId', sql.Int, filtros.gestorId);
        }

        if (filtros.status) {
            query += ' AND a.Status = @status';
            request.input('status', sql.NVarChar, filtros.status);
        }

        query += ' ORDER BY a.DataCriacao DESC';

        const result = await request.query(query);
        const avaliacoes = result.recordset;

        return avaliacoes.map(av => {
            const total = av.PerguntasEspecificasCount || 1;

            av.RespostaColaboradorConcluida = av.RespostasColaboradorCount >= total;
            av.RespostaGestorConcluida = av.RespostasGestorCount >= total;

            // Ajustar status baseado em quem está visualizando
            if (filtros.userId && av.UserId === filtros.userId) {
                // Colaborador visualizando
                const statusProcessamento = ['Calibragem', 'Aguardando Feedback', 'Aguardando PDI'];
                if (statusProcessamento.includes(av.Status)) {
                    av.StatusAvaliacao = 'Em Andamento';
                } else if (av.Status === 'Aguardando Colaborador') {
                    av.StatusAvaliacao = 'Pendente';
                } else {
                    av.StatusAvaliacao = av.Status;
                }
            } else if (filtros.gestorId && av.GestorId === filtros.gestorId) {
                // Gestor visualizando
                if (av.Status === 'Aguardando Gestor' && !av.RespostaGestorConcluida) {
                    av.StatusAvaliacao = 'Pendente';
                } else {
                    av.StatusAvaliacao = av.Status;
                }
            } else {
                av.StatusAvaliacao = av.Status;
            }

            return av;
        });
    }

    static async getAvaliacao(id, userId = null) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT a.*, u.NomeCompleto, u.NomeCompleto as NomeColaborador, g.NomeCompleto as NomeGestor,
                       ISNULL(u.DescricaoDepartamento, u.Departamento) as Departamento,
                       (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaColaborador IS NOT NULL) as RespostasColaboradorCount,
                       (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaGestor IS NOT NULL) as RespostasGestorCount,
                       (SELECT COUNT(*) FROM PerguntasAvaliacaoDesempenho p WHERE p.AvaliacaoId = a.Id) as PerguntasEspecificasCount
                FROM AvaliacoesDesempenho a
                INNER JOIN Users u ON a.UserId = u.Id
                LEFT JOIN Users g ON a.GestorId = g.Id
                WHERE a.Id = @id
            `);

        const av = result.recordset[0];
        if (!av) return null;

        const total = av.PerguntasEspecificasCount || 1;

        av.RespostaColaboradorConcluida = av.RespostasColaboradorCount >= total;
        av.RespostaGestorConcluida = av.RespostasGestorCount >= total;

        // Ajustar status baseado em quem está visualizando
        if (userId && av.UserId === userId) {
            // Colaborador visualizando
            const statusProcessamento = ['Calibragem', 'Aguardando Feedback', 'Aguardando PDI'];
            if (statusProcessamento.includes(av.Status)) {
                av.StatusAvaliacao = 'Em Andamento';
            } else if (av.Status === 'Aguardando Colaborador') {
                av.StatusAvaliacao = 'Pendente';
            } else {
                av.StatusAvaliacao = av.Status;
            }
        } else if (userId && av.GestorId === userId) {
            // Gestor visualizando
            if (av.Status === 'Aguardando Gestor' && !av.RespostaGestorConcluida) {
                av.StatusAvaliacao = 'Pendente';
            } else {
                av.StatusAvaliacao = av.Status;
            }
        } else {
            av.StatusAvaliacao = av.Status;
        }

        return av;
    }

    static async salvarRespostas(avaliacaoId, respostas, tipoRespondente) {
        const pool = await getDatabasePool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const campoResposta = tipoRespondente === 'colaborador' ? 'RespostaColaborador' : 'RespostaGestor';
            const campoData = tipoRespondente === 'colaborador' ? 'DataRespostaColaborador' : 'DataRespostaGestor';

            // Verificar se a avaliação tem perguntas específicas
            const perguntasEspecificasResult = await transaction.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .query('SELECT COUNT(*) as Total FROM PerguntasAvaliacaoDesempenho WHERE AvaliacaoId = @avaliacaoId');

            const temPerguntasEspecificas = perguntasEspecificasResult.recordset[0].Total > 0;

            for (const resp of respostas) {
                const check = await transaction.request()
                    .input('avaliacaoId', sql.Int, avaliacaoId)
                    .input('perguntaId', sql.Int, resp.perguntaId)
                    .query('SELECT Id FROM RespostasDesempenho WHERE AvaliacaoId = @avaliacaoId AND PerguntaId = @perguntaId');

                if (check.recordset.length > 0) {
                    await transaction.request()
                        .input('id', sql.Int, check.recordset[0].Id)
                        .input('resposta', sql.NVarChar, resp.resposta)
                        .query(`UPDATE RespostasDesempenho SET ${campoResposta} = @resposta, ${campoData} = GETDATE() WHERE Id = @id`);
                } else {
                    await transaction.request()
                        .input('avaliacaoId', sql.Int, avaliacaoId)
                        .input('perguntaId', sql.Int, resp.perguntaId)
                        .input('resposta', sql.NVarChar, resp.resposta)
                        .query(`INSERT INTO RespostasDesempenho (AvaliacaoId, PerguntaId, ${campoResposta}, ${campoData}) VALUES (@avaliacaoId, @perguntaId, @resposta, GETDATE())`);
                }
            }

            const totalPerguntasResult = await transaction.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .query('SELECT COUNT(*) as Total FROM PerguntasAvaliacaoDesempenho WHERE AvaliacaoId = @avaliacaoId');
            const totalPerguntas = totalPerguntasResult.recordset[0].Total;

            const respostasColabResult = await transaction.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .query('SELECT COUNT(*) as Total FROM RespostasDesempenho WHERE AvaliacaoId = @avaliacaoId AND RespostaColaborador IS NOT NULL');
            const respostasColab = respostasColabResult.recordset[0].Total;

            const respostasGestorResult = await transaction.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .query('SELECT COUNT(*) as Total FROM RespostasDesempenho WHERE AvaliacaoId = @avaliacaoId AND RespostaGestor IS NOT NULL');
            const respostasGestor = respostasGestorResult.recordset[0].Total;

            const colabConcluiu = respostasColab >= totalPerguntas;
            const gestorConcluiu = respostasGestor >= totalPerguntas;

            let novoStatus;
            if (colabConcluiu && gestorConcluiu) {
                novoStatus = 'Calibragem';
            } else if (colabConcluiu && !gestorConcluiu) {
                novoStatus = 'Aguardando Gestor';
            } else if (!colabConcluiu && gestorConcluiu) {
                novoStatus = 'Aguardando Colaborador';
            } else {
                novoStatus = 'Pendente';
            }

            await transaction.request()
                .input('id', sql.Int, avaliacaoId)
                .input('status', sql.NVarChar, novoStatus)
                .query('UPDATE AvaliacoesDesempenho SET Status = @status WHERE Id = @id');


            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async salvarCalibragem(avaliacaoId, dadosCalibragem, criadoPor) {
        const pool = await getDatabasePool();
        const { respostas, consideracoesFinais } = dadosCalibragem;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Salvar respostas calibradas
            for (const resp of respostas) {
                await transaction.request()
                    .input('avaliacaoId', sql.Int, avaliacaoId)
                    .input('perguntaId', sql.Int, resp.perguntaId)
                    .input('resposta', sql.NVarChar, resp.resposta)
                    .input('justificativa', sql.NVarChar, resp.justificativa || null)
                    .query(`
                        UPDATE RespostasDesempenho 
                        SET RespostaCalibrada = @resposta, JustificativaCalibrada = @justificativa, DataRespostaCalibrada = GETDATE() 
                        WHERE AvaliacaoId = @avaliacaoId AND PerguntaId = @perguntaId
                    `);
            }

            // Salvar considerações finais
            if (consideracoesFinais) {
                const check = await transaction.request()
                    .input('avaliacaoId', sql.Int, avaliacaoId)
                    .query('SELECT Id FROM CalibragemConsideracoes WHERE AvaliacaoId = @avaliacaoId');

                if (check.recordset.length > 0) {
                    await transaction.request()
                        .input('avaliacaoId', sql.Int, avaliacaoId)
                        .input('consideracoes', sql.NVarChar, consideracoesFinais)
                        .query('UPDATE CalibragemConsideracoes SET ConsideracoesFinais = @consideracoes, DataAtualizacao = GETDATE() WHERE AvaliacaoId = @avaliacaoId');
                } else {
                    await transaction.request()
                        .input('avaliacaoId', sql.Int, avaliacaoId)
                        .input('consideracoes', sql.NVarChar, consideracoesFinais)
                        .input('criadoPor', sql.Int, criadoPor)
                        .query('INSERT INTO CalibragemConsideracoes (AvaliacaoId, ConsideracoesFinais, CriadoPor) VALUES (@avaliacaoId, @consideracoes, @criadoPor)');
                }
            }

            await transaction.request()
                .input('id', sql.Int, avaliacaoId)
                .query(`UPDATE AvaliacoesDesempenho SET Status = 'Aguardando Feedback' WHERE Id = @id`);

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async salvarFeedback(avaliacaoId, feedback, gestorId) {
        const pool = await getDatabasePool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .input('feedback', sql.NVarChar, feedback)
                .input('gestorId', sql.Int, gestorId)
                .query(`INSERT INTO FeedbacksAvaliacaoDesempenho (AvaliacaoId, FeedbackGestor, GestorId) VALUES (@avaliacaoId, @feedback, @gestorId)`);

            await transaction.request()
                .input('id', sql.Int, avaliacaoId)
                .query(`UPDATE AvaliacoesDesempenho SET Status = 'Aguardando PDI' WHERE Id = @id`);

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async salvarFeedbackPDI(avaliacaoId, feedbackGestor, pdi, gestorId) {
        const pool = await getDatabasePool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Buscar dados da avaliação
            const avaliacaoResult = await transaction.request()
                .input('id', sql.Int, avaliacaoId)
                .query('SELECT UserId, GestorId FROM AvaliacoesDesempenho WHERE Id = @id');

            if (avaliacaoResult.recordset.length === 0) {
                throw new Error('Avaliação não encontrada');
            }

            const avaliacao = avaliacaoResult.recordset[0];

            // Salvar feedback
            await transaction.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .input('feedback', sql.NVarChar, feedbackGestor)
                .input('gestorId', sql.Int, gestorId)
                .query(`INSERT INTO FeedbacksAvaliacaoDesempenho (AvaliacaoId, FeedbackGestor, GestorId) VALUES (@avaliacaoId, @feedback, @gestorId)`);

            // Criar PDI
            const pdiResult = await transaction.request()
                .input('userId', sql.Int, avaliacao.UserId)
                .input('gestorId', sql.Int, avaliacao.GestorId)
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .input('titulo', sql.NVarChar, `PDI - Avaliação ${avaliacaoId}`)
                .input('objetivos', sql.NText, pdi.objetivos)
                .input('acoes', sql.NText, pdi.acoes)
                .input('prazo', sql.Date, pdi.prazoRevisao)
                .query(`
                    INSERT INTO PDIs (UserId, GestorId, AvaliacaoId, Titulo, Objetivos, Acoes, PrazoRevisao, Status, Progresso)
                    OUTPUT INSERTED.Id
                    VALUES (@userId, @gestorId, @avaliacaoId, @titulo, @objetivos, @acoes, @prazo, 'Ativo', 0)
                `);

            // Atualizar status da avaliação
            await transaction.request()
                .input('id', sql.Int, avaliacaoId)
                .query(`UPDATE AvaliacoesDesempenho SET Status = 'Concluida' WHERE Id = @id`);

            await transaction.commit();
            return pdiResult.recordset[0].Id;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async listarPerguntas() {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .query('SELECT * FROM PerguntasDesempenho WHERE Ativo = 1 ORDER BY Ordem');

        return result.recordset.map(p => {
            if (p.Opcoes && typeof p.Opcoes === 'string') {
                try {
                    p.Opcoes = JSON.parse(p.Opcoes);
                } catch (e) {
                    p.Opcoes = [];
                }
            }
            return p;
        });
    }

    static async listarRespostas(avaliacaoId) {
        const pool = await getDatabasePool();

        // Primeiro, verificar se a avaliação tem perguntas específicas
        const perguntasEspecificasResult = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query('SELECT COUNT(*) as Total FROM PerguntasAvaliacaoDesempenho WHERE AvaliacaoId = @avaliacaoId');

        const temPerguntasEspecificas = perguntasEspecificasResult.recordset[0].Total > 0;

        if (temPerguntasEspecificas) {
            // Buscar respostas com perguntas específicas da avaliação
            const result = await pool.request()
                .input('avaliacaoId', sql.Int, avaliacaoId)
                .query(`
                    SELECT r.*, p.Texto as PerguntaTexto, p.Tipo as TipoPergunta
                    FROM RespostasDesempenho r 
                    INNER JOIN PerguntasAvaliacaoDesempenho p ON r.PerguntaId = p.Id
                    WHERE r.AvaliacaoId = @avaliacaoId
                    ORDER BY p.Ordem
                `);
            return result.recordset;
        }

        return [];
    }

    static async criarPergunta(dados) {
        const pool = await getDatabasePool();
        const { texto, tipo, opcoes, obrigatoria, ordem, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima } = dados;

        const result = await pool.request()
            .input('texto', sql.NVarChar, texto)
            .input('tipo', sql.VarChar, tipo)
            .input('opcoes', sql.NVarChar, opcoes ? JSON.stringify(opcoes) : null)
            .input('obrigatoria', sql.Bit, obrigatoria ? 1 : 0)
            .input('ordem', sql.Int, ordem || 0)
            .input('escalaMinima', sql.Int, escalaMinima)
            .input('escalaMaxima', sql.Int, escalaMaxima)
            .input('escalaLabelMinima', sql.NVarChar, escalaLabelMinima)
            .input('escalaLabelMaxima', sql.NVarChar, escalaLabelMaxima)
            .query(`INSERT INTO PerguntasDesempenho (Texto, Tipo, Opcoes, Obrigatoria, Ordem, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima, Ativo) OUTPUT INSERTED.Id VALUES (@texto, @tipo, @opcoes, @obrigatoria, @ordem, @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima, 1)`);

        return result.recordset[0].Id;
    }

    static async atualizarPergunta(id, dados) {
        const pool = await getDatabasePool();
        const { texto, tipo, opcoes, obrigatoria, ordem, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima } = dados;

        await pool.request()
            .input('id', sql.Int, id)
            .input('texto', sql.NVarChar, texto)
            .input('tipo', sql.VarChar, tipo)
            .input('opcoes', sql.NVarChar, opcoes ? JSON.stringify(opcoes) : null)
            .input('obrigatoria', sql.Bit, obrigatoria ? 1 : 0)
            .input('ordem', sql.Int, ordem)
            .input('escalaMinima', sql.Int, escalaMinima)
            .input('escalaMaxima', sql.Int, escalaMaxima)
            .input('escalaLabelMinima', sql.NVarChar, escalaLabelMinima)
            .input('escalaLabelMaxima', sql.NVarChar, escalaLabelMaxima)
            .query(`UPDATE PerguntasDesempenho SET Texto = @texto, Tipo = @tipo, Opcoes = @opcoes, Obrigatoria = @obrigatoria, Ordem = @ordem, EscalaMinima = @escalaMinima, EscalaMaxima = @escalaMaxima, EscalaLabelMinima = @escalaLabelMinima, EscalaLabelMaxima = @escalaLabelMaxima WHERE Id = @id`);
    }

    static async excluirPergunta(id) {
        const pool = await getDatabasePool();
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE PerguntasDesempenho SET Ativo = 0 WHERE Id = @id');
    }

    static async reordenarPerguntas(itens) {
        const pool = await getDatabasePool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const item of itens) {
                await transaction.request()
                    .input('id', sql.Int, item.id)
                    .input('ordem', sql.Int, item.ordem)
                    .query('UPDATE PerguntasDesempenho SET Ordem = @ordem WHERE Id = @id');
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async buscarCalibragem(avaliacaoId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query('SELECT * FROM CalibragemConsideracoes WHERE AvaliacaoId = @avaliacaoId ORDER BY DataCriacao DESC');
        return result.recordset[0] || null;
    }

    static async buscarFeedback(avaliacaoId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query('SELECT * FROM FeedbacksAvaliacaoDesempenho WHERE AvaliacaoId = @avaliacaoId ORDER BY DataCriacao DESC');
        return result.recordset[0] || null;
    }

    static async buscarPDIs(avaliacaoId) {
        const pool = await getDatabasePool();
        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query('SELECT * FROM PDIs WHERE AvaliacaoId = @avaliacaoId ORDER BY DataCriacao');
        return result.recordset;
    }

    static async atualizarStatusPDI(pdiId, novoStatus) {
        const pool = await getDatabasePool();
        await pool.request()
            .input('id', sql.Int, pdiId)
            .input('status', sql.NVarChar, novoStatus)
            .query('UPDATE PDIs SET Status = @status, DataAtualizacao = GETDATE() WHERE Id = @id');
    }

    static async listarPerguntasPorAvaliacao(avaliacaoId) {
        const pool = await getDatabasePool();

        const result = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query(`
                SELECT p.*
                FROM PerguntasAvaliacaoDesempenho p
                WHERE p.AvaliacaoId = @avaliacaoId
                ORDER BY p.Ordem
            `);

        const perguntas = result.recordset;

        if (perguntas.length > 0) {
            for (const p of perguntas) {
                if (p.Tipo === 'multipla_escolha') {
                    const opcoesResult = await pool.request()
                        .input('perguntaId', sql.Int, p.Id)
                        .query('SELECT TextoOpcao FROM OpcoesPerguntasAvaliacaoDesempenho WHERE PerguntaId = @perguntaId ORDER BY Ordem');
                    p.Opcoes = opcoesResult.recordset.map(o => ({ TextoOpcao: o.TextoOpcao }));
                } else {
                    p.Opcoes = [];
                }
            }
            return perguntas;
        }

        throw new Error('Avaliação sem perguntas cadastradas');
    }

    static async getAvaliacaoCompleta(avaliacaoId) {
        const avaliacao = await this.getAvaliacao(avaliacaoId);
        if (!avaliacao) return null;

        avaliacao.calibragem = await this.buscarCalibragem(avaliacaoId);
        avaliacao.feedback = await this.buscarFeedback(avaliacaoId);
        avaliacao.pdis = await this.buscarPDIs(avaliacaoId);

        return avaliacao;
    }
}

module.exports = AvaliacoesDesempenhoManager;
