const sql = require('mssql');
const { getDatabasePool } = require('../config/db');
const emailService = require('../services/emailService');

/**
 * Job para atualizar status das avaliações e enviar notificações
 * Deve ser executado diariamente
 */
async function atualizarStatusAvaliacoes() {
    try {
        const pool = await getDatabasePool();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // 1. Atualizar Agendada -> Pendente (quando chega 10 dias antes do prazo)
        // IMPORTANTE: Usa COALESCE para considerar NovaDataLimiteResposta quando uma avaliação foi reaberta
        // Se NovaDataLimiteResposta não for NULL, usa ele; caso contrário, usa DataLimiteResposta original
        const avaliacoesParaAbrir = await pool.request().query(`
            SELECT 
                a.Id, a.UserId, a.GestorId, 
                COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta) as DataLimiteResposta,
                t.Nome as TipoAvaliacao,
                u.NomeCompleto as NomeColaborador, u.email as EmailColaborador,
                g.NomeCompleto as NomeGestor, g.email as EmailGestor
            FROM Avaliacoes a
            JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE a.StatusAvaliacao = 'Agendada'
              AND CAST(GETDATE() AS DATE) >= CAST(DATEADD(DAY, -10, COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta)) AS DATE)
        `);

        for (const avaliacao of avaliacoesParaAbrir.recordset) {
            // Atualizar status
            await pool.request()
                .input('id', sql.Int, avaliacao.Id)
                .query(`UPDATE Avaliacoes SET StatusAvaliacao = 'Pendente', AtualizadoEm = GETDATE() WHERE Id = @id`);

            const dataLimiteFormatada = new Date(avaliacao.DataLimiteResposta).toLocaleDateString('pt-BR');

            // Enviar email para colaborador
            if (avaliacao.EmailColaborador) {
                try {
                    await emailService.sendAvaliacaoAbertaEmail(
                        avaliacao.EmailColaborador,
                        avaliacao.NomeColaborador,
                        avaliacao.TipoAvaliacao,
                        dataLimiteFormatada
                    );
                } catch (error) {
                    console.error(`❌ Erro ao enviar email para colaborador ${avaliacao.NomeColaborador}:`, error.message);
                }
            }

            // Enviar email para gestor
            if (avaliacao.GestorId && avaliacao.EmailGestor) {
                try {
                    await emailService.sendAvaliacaoAbertaEmail(
                        avaliacao.EmailGestor,
                        avaliacao.NomeGestor,
                        avaliacao.TipoAvaliacao,
                        dataLimiteFormatada
                    );
                } catch (error) {
                    console.error(`❌ Erro ao enviar email para gestor ${avaliacao.NomeGestor}:`, error.message);
                }
            }

            // Criar notificações no sistema
            await criarNotificacaoAvaliacao(pool, avaliacao.UserId, 'avaliacao_aberta', avaliacao.TipoAvaliacao);
            if (avaliacao.GestorId) {
                await criarNotificacaoAvaliacao(pool, avaliacao.GestorId, 'avaliacao_aberta', avaliacao.TipoAvaliacao);
            }

        }

        // 2. Enviar lembrete 3 dias antes de expirar
        // IMPORTANTE: Usa COALESCE para considerar NovaDataLimiteResposta quando uma avaliação foi reaberta
        // Se NovaDataLimiteResposta não for NULL, usa ele; caso contrário, usa DataLimiteResposta original
        const avaliacoesParaLembrete = await pool.request().query(`
            SELECT 
                a.Id, a.UserId, a.GestorId, 
                COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta) as DataLimiteResposta,
                t.Nome as TipoAvaliacao,
                u.NomeCompleto as NomeColaborador, u.email as EmailColaborador,
                g.NomeCompleto as NomeGestor, g.email as EmailGestor,
                a.RespostaColaboradorConcluida, a.RespostaGestorConcluida
            FROM Avaliacoes a
            JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE a.StatusAvaliacao = 'Pendente'
              AND CAST(GETDATE() AS DATE) = CAST(DATEADD(DAY, -3, COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta)) AS DATE)
        `);

        for (const avaliacao of avaliacoesParaLembrete.recordset) {
            const dataLimiteFormatada = new Date(avaliacao.DataLimiteResposta).toLocaleDateString('pt-BR');

            // Enviar lembrete para colaborador se ainda não respondeu
            if (!avaliacao.RespostaColaboradorConcluida && avaliacao.EmailColaborador) {
                try {
                    await emailService.sendAvaliacaoLembreteEmail(
                        avaliacao.EmailColaborador,
                        avaliacao.NomeColaborador,
                        avaliacao.TipoAvaliacao,
                        dataLimiteFormatada
                    );
                    await criarNotificacaoAvaliacao(pool, avaliacao.UserId, 'avaliacao_lembrete', avaliacao.TipoAvaliacao);
                } catch (error) {
                    console.error(`❌ Erro ao enviar lembrete para colaborador ${avaliacao.NomeColaborador}:`, error.message);
                }
            }

            // Enviar lembrete para gestor se ainda não respondeu
            if (!avaliacao.RespostaGestorConcluida && avaliacao.GestorId && avaliacao.EmailGestor) {
                try {
                    await emailService.sendAvaliacaoLembreteEmail(
                        avaliacao.EmailGestor,
                        avaliacao.NomeGestor,
                        avaliacao.TipoAvaliacao,
                        dataLimiteFormatada
                    );
                    await criarNotificacaoAvaliacao(pool, avaliacao.GestorId, 'avaliacao_lembrete', avaliacao.TipoAvaliacao);
                } catch (error) {
                    console.error(`❌ Erro ao enviar lembrete para gestor ${avaliacao.NomeGestor}:`, error.message);
                }
            }

        }

        // 3. Atualizar Pendente -> Expirada (quando passa do prazo)
        // IMPORTANTE: Usa COALESCE para considerar NovaDataLimiteResposta quando uma avaliação foi reaberta
        // Se NovaDataLimiteResposta não for NULL, usa ele; caso contrário, usa DataLimiteResposta original
        const avaliacoesParaExpirar = await pool.request().query(`
            SELECT 
                a.Id, a.UserId, a.GestorId, t.Nome as TipoAvaliacao,
                u.NomeCompleto as NomeColaborador, u.email as EmailColaborador,
                g.NomeCompleto as NomeGestor, g.email as EmailGestor,
                a.RespostaColaboradorConcluida, a.RespostaGestorConcluida,
                COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta) as DataLimiteResposta
            FROM Avaliacoes a
            JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE a.StatusAvaliacao = 'Pendente'
              AND CAST(GETDATE() AS DATE) > CAST(COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta) AS DATE)
        `);

        for (const avaliacao of avaliacoesParaExpirar.recordset) {
            // Atualizar status para Expirada
            // IMPORTANTE: Quando uma avaliação reaberta expira novamente, apenas o status muda
            // O campo NovaDataLimiteResposta permanece preenchido para histórico
            await pool.request()
                .input('id', sql.Int, avaliacao.Id)
                .query(`UPDATE Avaliacoes SET StatusAvaliacao = 'Expirada', AtualizadoEm = GETDATE() WHERE Id = @id`);

            // Enviar email para colaborador se não respondeu
            if (!avaliacao.RespostaColaboradorConcluida && avaliacao.EmailColaborador) {
                try {
                    await emailService.sendAvaliacaoExpiradaEmail(
                        avaliacao.EmailColaborador,
                        avaliacao.NomeColaborador,
                        avaliacao.TipoAvaliacao
                    );
                    await criarNotificacaoAvaliacao(pool, avaliacao.UserId, 'avaliacao_expirada', avaliacao.TipoAvaliacao);
                } catch (error) {
                    console.error(`❌ Erro ao enviar email de expiração para colaborador ${avaliacao.NomeColaborador}:`, error.message);
                }
            }

            // Enviar email para gestor se não respondeu
            if (!avaliacao.RespostaGestorConcluida && avaliacao.GestorId && avaliacao.EmailGestor) {
                try {
                    await emailService.sendAvaliacaoExpiradaEmail(
                        avaliacao.EmailGestor,
                        avaliacao.NomeGestor,
                        avaliacao.TipoAvaliacao
                    );
                    await criarNotificacaoAvaliacao(pool, avaliacao.GestorId, 'avaliacao_expirada', avaliacao.TipoAvaliacao);
                } catch (error) {
                    console.error(`❌ Erro ao enviar email de expiração para gestor ${avaliacao.NomeGestor}:`, error.message);
                }
            }

        }

        console.log(`[JOB][AVALIACOES] Status ok - Abertas: ${avaliacoesParaAbrir.recordset.length}, Lembretes: ${avaliacoesParaLembrete.recordset.length}, Expiradas: ${avaliacoesParaExpirar.recordset.length}`);
    } catch (error) {
        console.error('❌ Erro no job de atualização de status de avaliações:', error);
        throw error;
    }
}

/**
 * Cria notificação no sistema para o usuário
 */
async function criarNotificacaoAvaliacao(pool, userId, tipo, tipoAvaliacao) {
    const mensagens = {
        'avaliacao_aberta': `Sua avaliação de ${tipoAvaliacao} está disponível para resposta`,
        'avaliacao_lembrete': `Lembrete: Sua avaliação de ${tipoAvaliacao} expira em 3 dias`,
        'avaliacao_expirada': `Sua avaliação de ${tipoAvaliacao} expirou`
    };

    try {
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('type', sql.VarChar, tipo)
            .input('message', sql.NVarChar, mensagens[tipo])
            .query(`
                INSERT INTO Notifications (UserId, Type, Message, IsRead, CreatedAt)
                VALUES (@userId, @type, @message, 0, GETDATE())
            `);
    } catch (error) {
        console.error(`❌ Erro ao criar notificação para usuário ${userId}:`, error.message);
    }
}

module.exports = { atualizarStatusAvaliacoes };
