const mysql = require('mysql2/promise');
const { getDatabasePool } = require('../config/db');
const AvaliacoesManager = require('./avaliacoesManager');

class AvaliacoesDesempenhoManager {

    static async criarAvaliacao(dados) {
        const pool = await getDatabasePool();
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const { userIds, titulo, dataLimite, criadoPor, perguntas } = dados;
            const avaliacoesCriadas = [];

            for (const userId of userIds) {
                let gestorId = null;
                try {
                    gestorId = await AvaliacoesManager.buscarGestor(connection, userId);
                } catch (err) {
                    console.warn(`⚠️ Não foi possível buscar gestor para userId ${userId}: ${err.message}`);
                }

                const [result] = await connection.query(`
                    INSERT INTO AvaliacoesDesempenho 
                    (UserId, GestorId, Titulo, DataLimiteAutoAvaliacao, DataLimiteGestor, CriadoPor, Status)
                    VALUES (?, ?, ?, ?, ?, ?, 'Pendente')
                `, [userId, gestorId, titulo, dataLimite, dataLimite, criadoPor]);

                const avaliacaoId = result.insertId;
                avaliacoesCriadas.push(avaliacaoId);

                if (perguntas && Array.isArray(perguntas) && perguntas.length > 0) {
                    console.log(`📝 Criando ${perguntas.length} perguntas personalizadas para avaliação ${avaliacaoId}`);

                    for (const pergunta of perguntas) {
                        const [perguntaResult] = await connection.query(`
                            INSERT INTO PerguntasAvaliacaoDesempenho 
                            (AvaliacaoId, Texto, Tipo, Obrigatoria, Ordem, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [avaliacaoId, pergunta.texto, pergunta.tipo, pergunta.obrigatoria ? 1 : 0, pergunta.ordem, 
                            pergunta.escalaMinima || null, pergunta.escalaMaxima || null, 
                            pergunta.escalaLabelMinima || null, pergunta.escalaLabelMaxima || null]);

                        const perguntaId = perguntaResult.insertId;

                        if (pergunta.tipo === 'multipla_escolha' && pergunta.opcoes && Array.isArray(pergunta.opcoes)) {
                            for (let i = 0; i < pergunta.opcoes.length; i++) {
                                await connection.query(`
                                    INSERT INTO OpcoesPerguntasAvaliacaoDesempenho 
                                    (PerguntaId, TextoOpcao, Ordem)
                                    VALUES (?, ?, ?)
                                `, [perguntaId, pergunta.opcoes[i], i + 1]);
                            }
                        }
                    }
                    console.log(`✅ Perguntas personalizadas criadas para avaliação ${avaliacaoId}`);
                } else {
                    // Buscar perguntas do questionário padrão
                    console.log('ℹ️ Nenhuma pergunta personalizada fornecida. Buscando questionário padrão...');

                    const [perguntasPadrao] = await connection.query(
                        'SELECT * FROM PerguntasDesempenho WHERE Ativo = 1 ORDER BY Ordem'
                    );

                    if (perguntasPadrao.length === 0) {
                        throw new Error('Nenhuma pergunta foi adicionada e não há questionário padrão definido.');
                    }

                    console.log(`📝 Usando ${perguntasPadrao.length} perguntas do questionário padrão para avaliação ${avaliacaoId}`);

                    for (const p of perguntasPadrao) {
                        const [perguntaResult] = await connection.query(`
                            INSERT INTO PerguntasAvaliacaoDesempenho 
                            (AvaliacaoId, Texto, Tipo, Obrigatoria, Ordem, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [avaliacaoId, p.Texto, p.Tipo, p.Obrigatoria ? 1 : 0, p.Ordem,
                            p.EscalaMinima || null, p.EscalaMaxima || null,
                            p.EscalaLabelMinima || null, p.EscalaLabelMaxima || null]);

                        const perguntaId = perguntaResult.insertId;

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
                                    await connection.query(`
                                        INSERT INTO OpcoesPerguntasAvaliacaoDesempenho 
                                        (PerguntaId, TextoOpcao, Ordem)
                                        VALUES (?, ?, ?)
                                    `, [perguntaId, opcoes[i], i + 1]);
                                }
                            }
                        }
                    }
                }
            }

            await connection.commit();
            connection.release();
            console.log(`✅ ${avaliacoesCriadas.length} avaliações criadas com sucesso`);
            return avaliacoesCriadas;
        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('❌ Erro ao criar avaliação:', error);
            throw error;
        }
    }

    static async listarAvaliacoes(filtros = {}) {
        const pool = await getDatabasePool();
        let query = `
            SELECT a.*, u.NomeCompleto, u.NomeCompleto as NomeColaborador, g.NomeCompleto as NomeGestor, 
                   COALESCE(u.DescricaoDepartamento, u.Departamento) as Departamento,
                   (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaColaborador IS NOT NULL) as RespostasColaboradorCount,
                   (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaGestor IS NOT NULL) as RespostasGestorCount,
                   (SELECT COUNT(*) FROM PerguntasAvaliacaoDesempenho p WHERE p.AvaliacaoId = a.Id) as PerguntasEspecificasCount
            FROM AvaliacoesDesempenho a
            INNER JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE 1=1
        `;

        const params = [];

        if (filtros.userId) {
            query += ' AND a.UserId = ?';
            params.push(filtros.userId);
        }

        if (filtros.gestorId) {
            query += ' AND a.GestorId = ?';
            params.push(filtros.gestorId);
        }

        if (filtros.status) {
            query += ' AND a.Status = ?';
            params.push(filtros.status);
        }

        query += ' ORDER BY a.DataCriacao DESC';

        const [avaliacoes] = await pool.query(query, params);

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
        const [result] = await pool.query(`
            SELECT a.*, u.NomeCompleto, u.NomeCompleto as NomeColaborador, g.NomeCompleto as NomeGestor,
                   COALESCE(u.DescricaoDepartamento, u.Departamento) as Departamento,
                   (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaColaborador IS NOT NULL) as RespostasColaboradorCount,
                   (SELECT COUNT(*) FROM RespostasDesempenho r WHERE r.AvaliacaoId = a.Id AND r.RespostaGestor IS NOT NULL) as RespostasGestorCount,
                   (SELECT COUNT(*) FROM PerguntasAvaliacaoDesempenho p WHERE p.AvaliacaoId = a.Id) as PerguntasEspecificasCount
            FROM AvaliacoesDesempenho a
            INNER JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE a.Id = ?
        `, [id]);

        const av = result[0];
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
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const campoResposta = tipoRespondente === 'colaborador' ? 'RespostaColaborador' : 'RespostaGestor';
            const campoData = tipoRespondente === 'colaborador' ? 'DataRespostaColaborador' : 'DataRespostaGestor';

            for (const resp of respostas) {
                const [check] = await connection.query(
                    'SELECT Id FROM RespostasDesempenho WHERE AvaliacaoId = ? AND PerguntaId = ?',
                    [avaliacaoId, resp.perguntaId]
                );

                if (check.length > 0) {
                    await connection.query(
                        `UPDATE RespostasDesempenho SET ${campoResposta} = ?, ${campoData} = NOW() WHERE Id = ?`,
                        [resp.resposta, check[0].Id]
                    );
                } else {
                    await connection.query(
                        `INSERT INTO RespostasDesempenho (AvaliacaoId, PerguntaId, ${campoResposta}, ${campoData}) VALUES (?, ?, ?, NOW())`,
                        [avaliacaoId, resp.perguntaId, resp.resposta]
                    );
                }
            }

            const [totalPerguntasResult] = await connection.query(
                'SELECT COUNT(*) as Total FROM PerguntasAvaliacaoDesempenho WHERE AvaliacaoId = ?',
                [avaliacaoId]
            );
            const totalPerguntas = totalPerguntasResult[0].Total;

            const [respostasColabResult] = await connection.query(
                'SELECT COUNT(*) as Total FROM RespostasDesempenho WHERE AvaliacaoId = ? AND RespostaColaborador IS NOT NULL',
                [avaliacaoId]
            );
            const respostasColab = respostasColabResult[0].Total;

            const [respostasGestorResult] = await connection.query(
                'SELECT COUNT(*) as Total FROM RespostasDesempenho WHERE AvaliacaoId = ? AND RespostaGestor IS NOT NULL',
                [avaliacaoId]
            );
            const respostasGestor = respostasGestorResult[0].Total;

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

            await connection.query('UPDATE AvaliacoesDesempenho SET Status = ? WHERE Id = ?', [novoStatus, avaliacaoId]);

            await connection.commit();
            connection.release();
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    static async salvarCalibragem(avaliacaoId, dadosCalibragem, criadoPor) {
        const pool = await getDatabasePool();
        const { respostas, consideracoesFinais } = dadosCalibragem;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Salvar respostas calibradas
            for (const resp of respostas) {
                await connection.query(`
                    UPDATE RespostasDesempenho 
                    SET RespostaCalibrada = ?, JustificativaCalibrada = ?, DataRespostaCalibrada = NOW() 
                    WHERE AvaliacaoId = ? AND PerguntaId = ?
                `, [resp.resposta, resp.justificativa || null, avaliacaoId, resp.perguntaId]);
            }

            // Salvar considerações finais
            if (consideracoesFinais) {
                const [check] = await connection.query(
                    'SELECT Id FROM CalibragemConsideracoes WHERE AvaliacaoId = ?',
                    [avaliacaoId]
                );

                if (check.length > 0) {
                    await connection.query(
                        'UPDATE CalibragemConsideracoes SET ConsideracoesFinais = ?, DataAtualizacao = NOW() WHERE AvaliacaoId = ?',
                        [consideracoesFinais, avaliacaoId]
                    );
                } else {
                    await connection.query(
                        'INSERT INTO CalibragemConsideracoes (AvaliacaoId, ConsideracoesFinais, CriadoPor) VALUES (?, ?, ?)',
                        [avaliacaoId, consideracoesFinais, criadoPor]
                    );
                }
            }

            await connection.query(`UPDATE AvaliacoesDesempenho SET Status = 'Aguardando Feedback' WHERE Id = ?`, [avaliacaoId]);

            await connection.commit();
            connection.release();
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    static async salvarFeedback(avaliacaoId, feedback, gestorId) {
        const pool = await getDatabasePool();
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.query(
                `INSERT INTO FeedbacksAvaliacaoDesempenho (AvaliacaoId, FeedbackGestor, GestorId) VALUES (?, ?, ?)`,
                [avaliacaoId, feedback, gestorId]
            );

            await connection.query(`UPDATE AvaliacoesDesempenho SET Status = 'Aguardando PDI' WHERE Id = ?`, [avaliacaoId]);

            await connection.commit();
            connection.release();
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    static async salvarFeedbackPDI(avaliacaoId, feedbackGestor, pdi, gestorId) {
        const pool = await getDatabasePool();
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Buscar dados da avaliação
            const [avaliacaoResult] = await connection.query(
                'SELECT UserId, GestorId FROM AvaliacoesDesempenho WHERE Id = ?',
                [avaliacaoId]
            );

            if (avaliacaoResult.length === 0) {
                throw new Error('Avaliação não encontrada');
            }

            const avaliacao = avaliacaoResult[0];

            // Salvar feedback
            await connection.query(
                `INSERT INTO FeedbacksAvaliacaoDesempenho (AvaliacaoId, FeedbackGestor, GestorId) VALUES (?, ?, ?)`,
                [avaliacaoId, feedbackGestor, gestorId]
            );

            // Verificar qual coluna existe (PrazoConclusao ou PrazoRevisao)
            const [colunaCheck] = await connection.query(`
                SELECT COUNT(*) as existe
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
            `);
            const usarPrazoConclusao = colunaCheck[0].existe > 0;
            const colunaPrazo = usarPrazoConclusao ? 'PrazoConclusao' : 'PrazoRevisao';
            
            const [pdiResult] = await connection.query(`
                INSERT INTO PDIs (UserId, GestorId, AvaliacaoId, Titulo, Objetivos, Acoes, ${colunaPrazo}, Status, Progresso)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Ativo', 0)
            `, [avaliacao.UserId, avaliacao.GestorId, avaliacaoId, 
                pdi.titulo || `PDI - Avaliação ${avaliacaoId}`, pdi.objetivos, pdi.acoes, 
                pdi.prazoRevisao || pdi.prazoConclusao]);

            // Atualizar status da avaliação
            await connection.query(`UPDATE AvaliacoesDesempenho SET Status = 'Concluida' WHERE Id = ?`, [avaliacaoId]);

            await connection.commit();
            connection.release();
            return pdiResult.insertId;
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    static async listarPerguntas() {
        const pool = await getDatabasePool();
        const [result] = await pool.query('SELECT * FROM PerguntasDesempenho WHERE Ativo = 1 ORDER BY Ordem');

        return result.map(p => {
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
        const [perguntasEspecificasResult] = await pool.query(
            'SELECT COUNT(*) as Total FROM PerguntasAvaliacaoDesempenho WHERE AvaliacaoId = ?',
            [avaliacaoId]
        );

        const temPerguntasEspecificas = perguntasEspecificasResult[0].Total > 0;

        if (temPerguntasEspecificas) {
            // Buscar respostas com perguntas específicas da avaliação
            const [result] = await pool.query(`
                SELECT r.*, p.Texto as PerguntaTexto, p.Tipo as TipoPergunta
                FROM RespostasDesempenho r 
                INNER JOIN PerguntasAvaliacaoDesempenho p ON r.PerguntaId = p.Id
                WHERE r.AvaliacaoId = ?
                ORDER BY p.Ordem
            `, [avaliacaoId]);
            return result;
        }

        return [];
    }

    static async criarPergunta(dados) {
        const pool = await getDatabasePool();
        const { texto, tipo, opcoes, obrigatoria, ordem, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima } = dados;

        const [result] = await pool.query(
            `INSERT INTO PerguntasDesempenho (Texto, Tipo, Opcoes, Obrigatoria, Ordem, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima, Ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [texto, tipo, opcoes ? JSON.stringify(opcoes) : null, obrigatoria ? 1 : 0, ordem || 0, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima]
        );

        return result.insertId;
    }

    static async atualizarPergunta(id, dados) {
        const pool = await getDatabasePool();
        const { texto, tipo, opcoes, obrigatoria, ordem, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima } = dados;

        await pool.query(
            `UPDATE PerguntasDesempenho SET Texto = ?, Tipo = ?, Opcoes = ?, Obrigatoria = ?, Ordem = ?, EscalaMinima = ?, EscalaMaxima = ?, EscalaLabelMinima = ?, EscalaLabelMaxima = ? WHERE Id = ?`,
            [texto, tipo, opcoes ? JSON.stringify(opcoes) : null, obrigatoria ? 1 : 0, ordem, escalaMinima, escalaMaxima, escalaLabelMinima, escalaLabelMaxima, id]
        );
    }

    static async excluirPergunta(id) {
        const pool = await getDatabasePool();
        await pool.query('UPDATE PerguntasDesempenho SET Ativo = 0 WHERE Id = ?', [id]);
    }

    static async reordenarPerguntas(itens) {
        const pool = await getDatabasePool();
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const item of itens) {
                await connection.query('UPDATE PerguntasDesempenho SET Ordem = ? WHERE Id = ?', [item.ordem, item.id]);
            }
            await connection.commit();
            connection.release();
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    static async buscarCalibragem(avaliacaoId) {
        const pool = await getDatabasePool();
        const [result] = await pool.query(
            'SELECT * FROM CalibragemConsideracoes WHERE AvaliacaoId = ? ORDER BY DataCriacao DESC',
            [avaliacaoId]
        );
        return result[0] || null;
    }

    static async buscarFeedback(avaliacaoId) {
        const pool = await getDatabasePool();
        const [result] = await pool.query(
            'SELECT * FROM FeedbacksAvaliacaoDesempenho WHERE AvaliacaoId = ? ORDER BY DataCriacao DESC',
            [avaliacaoId]
        );
        return result[0] || null;
    }

    static async buscarPDIs(avaliacaoId) {
        const pool = await getDatabasePool();
        const [result] = await pool.query('SELECT * FROM PDIs WHERE AvaliacaoId = ? ORDER BY DataCriacao', [avaliacaoId]);
        return result;
    }

    static async atualizarStatusPDI(pdiId, novoStatus) {
        const pool = await getDatabasePool();
        await pool.query('UPDATE PDIs SET Status = ?, DataAtualizacao = NOW() WHERE Id = ?', [novoStatus, pdiId]);
    }

    static async listarPerguntasPorAvaliacao(avaliacaoId) {
        const pool = await getDatabasePool();

        const [perguntas] = await pool.query(`
            SELECT p.*
            FROM PerguntasAvaliacaoDesempenho p
            WHERE p.AvaliacaoId = ?
            ORDER BY p.Ordem
        `, [avaliacaoId]);

        if (perguntas.length > 0) {
            for (const p of perguntas) {
                if (p.Tipo === 'multipla_escolha') {
                    const [opcoesResult] = await pool.query(
                        'SELECT TextoOpcao FROM OpcoesPerguntasAvaliacaoDesempenho WHERE PerguntaId = ? ORDER BY Ordem',
                        [p.Id]
                    );
                    p.Opcoes = opcoesResult.map(o => ({ TextoOpcao: o.TextoOpcao }));
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
