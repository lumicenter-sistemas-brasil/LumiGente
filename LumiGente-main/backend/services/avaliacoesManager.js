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

                // Tentar buscar gestor atualizado
                try {
                    const gestorId = await this.buscarGestor(pool, func.Id);
                    if (gestorId) {
                        func.GestorId = gestorId;
                    }
                } catch (err) {
                    console.warn(`⚠️ Não foi possível buscar gestor para ${func.NomeCompleto}: ${err.message}`);
                }

                // Criar avaliações para colaboradores com menos de 90 dias
                if (diasNaEmpresa < 90) {
                    // Se tem menos de 45 dias, cria ambas as avaliações
                    if (diasNaEmpresa < 45) {
                        const avaliacao45existente = await pool.request()
                            .input('userId', sql.Int, func.Id)
                            .input('tipoId', sql.Int, 1)
                            .query('SELECT Id FROM Avaliacoes WHERE UserId = @userId AND TipoAvaliacaoId = @tipoId');

                        if (avaliacao45existente.recordset.length === 0) {
                            await this.criarAvaliacao(func, 1);
                            criadas45++;
                        }
                    }
                    
                    // Sempre cria avaliação de 90 dias para quem tem menos de 90 dias
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
     * Abre 10 dias antes e expira no dia exato (45 ou 90 dias).
     */
    static async criarAvaliacao(funcionario, tipoAvaliacaoId) {
        const pool = await getDatabasePool();
        const diasPrazo = tipoAvaliacaoId === 1 ? 45 : 90;
        const diasAntecipacao = 10;

        // Data limite (expiração): no dia exato que completa 45 ou 90 dias
        const dataLimite = new Date(funcionario.DataAdmissao);
        dataLimite.setDate(dataLimite.getDate() + diasPrazo);
        
        // Data de abertura: 10 dias antes da data limite
        const dataAbertura = new Date(dataLimite);
        dataAbertura.setDate(dataAbertura.getDate() - diasAntecipacao);

        // Determinar status inicial: Pendente se já passou da data de abertura, senão Agendada
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataAbertura.setHours(0, 0, 0, 0);
        const statusInicial = hoje >= dataAbertura ? 'Pendente' : 'Agendada';

        // Criar a avaliação
        const insertResult = await pool.request()
            .input('userId', sql.Int, funcionario.Id)
            .input('gestorId', sql.Int, funcionario.GestorId || null)
            .input('matricula', sql.VarChar, funcionario.Matricula || '')
            .input('dataAdmissao', sql.Date, funcionario.DataAdmissao)
            .input('tipoId', sql.Int, tipoAvaliacaoId)
            .input('dataLimite', sql.Date, dataLimite)
            .input('status', sql.VarChar, statusInicial)
            .query(`
                INSERT INTO Avaliacoes (UserId, GestorId, Matricula, DataAdmissao, TipoAvaliacaoId, DataLimiteResposta, StatusAvaliacao, DataCriacao)
                OUTPUT INSERTED.Id
                VALUES (@userId, @gestorId, @matricula, @dataAdmissao, @tipoId, @dataLimite, @status, GETDATE())
            `);

        const avaliacaoId = insertResult.recordset[0].Id;

        // Copiar perguntas do template padrão para criar snapshot da avaliação
        const tabelaQuestionario = tipoAvaliacaoId === 1 ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';
        const tabelaOpcoes = tipoAvaliacaoId === 1 ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';
        
        const perguntas = await pool.request()
            .query(`SELECT * FROM ${tabelaQuestionario} ORDER BY Ordem`);

        for (const pergunta of perguntas.recordset) {
            const insertPergunta = await pool.request()
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
                    OUTPUT INSERTED.Id
                    VALUES (@avaliacaoId, @pergunta, @tipoPergunta, @ordem, @obrigatoria,
                            @escalaMinima, @escalaMaxima, @escalaLabelMinima, @escalaLabelMaxima, GETDATE())
                `);

            const perguntaAvaliacaoId = insertPergunta.recordset[0].Id;

            if (pergunta.TipoPergunta === 'multipla_escolha') {
                const opcoes = await pool.request()
                    .input('perguntaId', sql.Int, pergunta.Id)
                    .query(`SELECT * FROM ${tabelaOpcoes} WHERE PerguntaId = @perguntaId ORDER BY Ordem`);

                for (const opcao of opcoes.recordset) {
                    await pool.request()
                        .input('perguntaAvaliacaoId', sql.Int, perguntaAvaliacaoId)
                        .input('textoOpcao', sql.NVarChar, opcao.TextoOpcao)
                        .input('ordem', sql.Int, opcao.Ordem)
                        .query(`INSERT INTO OpcoesPerguntasAvaliacao (PerguntaAvaliacaoId, TextoOpcao, Ordem) VALUES (@perguntaAvaliacaoId, @textoOpcao, @ordem)`);
                }
            }
        }

        console.log(`-> Avaliação de ${diasPrazo} dias criada para: ${funcionario.NomeCompleto} (Fecha em: ${dataLimite.toLocaleDateString('pt-BR')})`);
    }

    /**
     * Busca as avaliações associadas a um usuário (como avaliado ou avaliador).
     */
    static async buscarAvaliacoesUsuario(pool, userId, temPermissaoAdmin) {
        const query = `
            SELECT a.*, t.Nome as TipoAvaliacao, u.NomeCompleto, u.DescricaoDepartamento, g.NomeCompleto as NomeGestor
            FROM Avaliacoes a
            JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE a.UserId = @userId OR a.GestorId = @userId
            ORDER BY 
                CASE a.StatusAvaliacao 
                    WHEN 'Pendente' THEN 1 
                    WHEN 'Agendada' THEN 2 
                    WHEN 'Concluída' THEN 3 
                    WHEN 'Expirada' THEN 4 
                    ELSE 5 
                END, 
                a.DataLimiteResposta ASC
        `;

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
    static async validarPermissaoResposta(pool, avaliacaoId, userId, tipoRespondente) {
        console.log('🔍 Validando permissão - avaliacaoId:', avaliacaoId, 'userId:', userId, 'tipo:', tipoRespondente);
        
        const result = await pool.request()
            .input('id', sql.Int, avaliacaoId)
            .query('SELECT * FROM Avaliacoes WHERE Id = @id');
        
        const avaliacao = result.recordset[0];
        console.log('📋 Avaliação encontrada:', avaliacao ? 'Sim' : 'Não');

        if (!avaliacao) {
            const err = new Error('Avaliação não encontrada');
            err.statusCode = 404;
            throw err;
        }
        
        if (tipoRespondente === 'colaborador' && avaliacao.RespostaColaboradorConcluida) {
            const err = new Error('Você já respondeu esta avaliação.');
            err.statusCode = 400;
            throw err;
        }
        if (tipoRespondente === 'gestor' && avaliacao.RespostaGestorConcluida) {
            const err = new Error('Você já respondeu esta avaliação.');
            err.statusCode = 400;
            throw err;
        }
        
        if (avaliacao.StatusAvaliacao === 'Concluida' || avaliacao.StatusAvaliacao === 'Concluída') {
            const err = new Error('Esta avaliação já foi concluída e não pode ser alterada.');
            err.statusCode = 400;
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

        if (tipoRespondente === 'colaborador' && avaliacao.UserId !== userId) {
            throw new Error('Permissão negada para responder como colaborador.');
        }
        if (tipoRespondente === 'gestor' && avaliacao.GestorId !== userId) {
            throw new Error('Permissão negada para responder como gestor.');
        }

        return avaliacao;
    }

    /**
     * Busca as perguntas que foram salvas para uma avaliação específica no momento da sua criação.
     */
    static async buscarPerguntasAvaliacao(avaliacaoId) {
        const pool = await getDatabasePool();
        
        // Buscar perguntas do snapshot da avaliação
        const perguntas = await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .query('SELECT * FROM PerguntasAvaliacao WHERE AvaliacaoId = @avaliacaoId ORDER BY Ordem');
        
        // Para cada pergunta, buscar suas opções se for múltipla escolha
        for (const pergunta of perguntas.recordset) {
            if (pergunta.TipoPergunta === 'multipla_escolha') {
                const opcoes = await pool.request()
                    .input('perguntaId', sql.Int, pergunta.Id)
                    .query('SELECT * FROM OpcoesPerguntasAvaliacao WHERE PerguntaAvaliacaoId = @perguntaId ORDER BY Ordem');
                pergunta.Opcoes = opcoes.recordset;
            } else {
                pergunta.Opcoes = [];
            }
        }
        
        return perguntas.recordset;
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
    static async salvarRespostaAvaliacao(pool, respostaData) {
        const { avaliacaoId, perguntaId, resposta, respondidoPor, tipoRespondente } = respostaData;
        
        // Buscar tipo da avaliação e texto da pergunta
        const avaliacaoResult = await pool.request()
            .input('id', sql.Int, avaliacaoId)
            .query('SELECT TipoAvaliacaoId FROM Avaliacoes WHERE Id = @id');
        
        const tipoQuestionario = avaliacaoResult.recordset[0].TipoAvaliacaoId === 1 ? '45' : '90';
        
        // Buscar texto e tipo da pergunta
        const perguntaResult = await pool.request()
            .input('perguntaId', sql.Int, perguntaId)
            .query('SELECT Pergunta, TipoPergunta FROM PerguntasAvaliacao WHERE Id = @perguntaId');
        
        const textoPergunta = perguntaResult.recordset[0]?.Pergunta || '';
        const tipoPergunta = perguntaResult.recordset[0]?.TipoPergunta || 'texto';

        await pool.request()
            .input('avaliacaoId', sql.Int, avaliacaoId)
            .input('perguntaId', sql.Int, perguntaId)
            .input('pergunta', sql.NText, textoPergunta)
            .input('tipoPergunta', sql.VarChar, tipoPergunta)
            .input('resposta', sql.NText, resposta)
            .input('respondidoPor', sql.Int, respondidoPor)
            .input('tipoRespondente', sql.NVarChar, tipoRespondente)
            .input('tipoQuestionario', sql.VarChar, tipoQuestionario)
            .query(`
                INSERT INTO RespostasAvaliacoes (AvaliacaoId, PerguntaId, Pergunta, TipoPergunta, Resposta, RespondidoPor, TipoRespondente, TipoQuestionario)
                VALUES (@avaliacaoId, @perguntaId, @pergunta, @tipoPergunta, @resposta, @respondidoPor, @tipoRespondente, @tipoQuestionario)
            `);
    }

    /**
     * Marca a parte de uma avaliação (do colaborador ou do gestor) como concluída.
     */
    static async concluirAvaliacao(pool, avaliacaoId, tipoRespondente) {
        console.log('📝 Concluindo avaliação', avaliacaoId, 'para', tipoRespondente);
        
        let campoData = tipoRespondente === 'colaborador' ? 'DataRespostaColaborador' : 'DataRespostaGestor';
        let campoConcluida = tipoRespondente === 'colaborador' ? 'RespostaColaboradorConcluida' : 'RespostaGestorConcluida';

        await pool.request()
            .input('id', sql.Int, avaliacaoId)
            .query(`
                UPDATE Avaliacoes 
                SET ${campoConcluida} = 1, ${campoData} = GETDATE()
                WHERE Id = @id
            `);
        
        console.log('✅ Campo', campoConcluida, 'marcado como concluído');
        
        const checkCompletion = await pool.request().input('id', sql.Int, avaliacaoId).query('SELECT RespostaColaboradorConcluida, RespostaGestorConcluida FROM Avaliacoes WHERE Id = @id');
        
        if (checkCompletion.recordset[0].RespostaColaboradorConcluida && checkCompletion.recordset[0].RespostaGestorConcluida) {
            await pool.request().input('id', sql.Int, avaliacaoId).query(`UPDATE Avaliacoes SET StatusAvaliacao = 'Concluida' WHERE Id = @id`);
            console.log('✅ Ambas as partes responderam - Status alterado para Concluida');
        }
    }

    /**
     * Busca o questionário template padrão (45 ou 90 dias) para exibição.
     */
    static async buscarQuestionarioPadrao(pool, tipo) { // tipo '45' ou '90'
        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';
        const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';

        const perguntas = await pool.request()
            .query(`SELECT * FROM ${tabelaQuestionario} ORDER BY Ordem`);
        
        for (const pergunta of perguntas.recordset) {
            if (pergunta.TipoPergunta === 'multipla_escolha') {
                const opcoes = await pool.request()
                    .input('perguntaId', sql.Int, pergunta.Id)
                    .query(`SELECT * FROM ${tabelaOpcoes} WHERE PerguntaId = @perguntaId ORDER BY Ordem`);
                pergunta.Opcoes = opcoes.recordset;
            }
        }
        
        return perguntas.recordset;
    }

    /**
     * Atualiza as perguntas de um questionário template padrão.
     * Não usado mais - templates são gerenciados via CRUD nas tabelas QuestionarioPadrao45/90
     */
    static async atualizarQuestionarioPadrao(pool, tipo, perguntas) {
        // Método mantido para compatibilidade, mas não deve ser usado
        console.warn('⚠️ Método atualizarQuestionarioPadrao não deve ser usado. Use o CRUD de templates.');
        return { success: false, message: 'Use o CRUD de templates para gerenciar questionários' };
    }

    /**
     * Reabre uma avaliação que foi expirada.
     */
    static async reabrirAvaliacao(pool, avaliacaoId, novaDataLimite) {
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
     * Busca o ID do gestor direto usando DEPARTAMENTO e hierarchyPath.
     */
    static async buscarGestor(pool, userId) {
        try {
            const userResult = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT Id, NomeCompleto, DEPARTAMENTO, hierarchyPath FROM Users WHERE Id = @userId AND IsActive = 1');
            
            if (userResult.recordset.length === 0) {
                console.log(`❌ Usuário ${userId} não encontrado`);
                return null;
            }
            
            const user = userResult.recordset[0];
            console.log(`🔍 Buscando gestor para: ${user.NomeCompleto} (ID: ${userId})`);
            console.log(`   DEPARTAMENTO: ${user.DEPARTAMENTO}`);
            console.log(`   hierarchyPath: ${user.hierarchyPath}`);
            
            if (!user.DEPARTAMENTO || !user.hierarchyPath) {
                console.log(`⚠️ DEPARTAMENTO ou hierarchyPath ausente`);
                return null;
            }
            
            const departamento = user.DEPARTAMENTO;
            const hierarchyPath = user.hierarchyPath;
            const pathParts = hierarchyPath.split(' > ').map(p => p.trim());
            
            console.log(`   Path dividido:`, pathParts);
            
            const deptIndex = pathParts.indexOf(departamento);
            console.log(`   Índice do departamento no path: ${deptIndex}`);
            
            if (deptIndex <= 0) {
                console.log(`⚠️ Departamento não encontrado no path ou é o primeiro (sem gestor acima)`);
                return null;
            }
            
            const gestorDepartamento = pathParts[deptIndex - 1];
            console.log(`   Departamento do gestor: ${gestorDepartamento}`);
            
            const gestorResult = await pool.request()
                .input('gestorDept', sql.VarChar, gestorDepartamento)
                .query('SELECT Id, NomeCompleto FROM Users WHERE DEPARTAMENTO = @gestorDept AND IsActive = 1');
            
            if (gestorResult.recordset.length > 0) {
                const gestor = gestorResult.recordset[0];
                console.log(`✅ Gestor encontrado: ${gestor.NomeCompleto} (ID: ${gestor.Id})`);
                return gestor.Id;
            }
            
            console.log(`❌ Nenhum usuário encontrado com DEPARTAMENTO = ${gestorDepartamento}`);
            return null;
        } catch (error) {
            console.error(`❌ Erro ao buscar gestor para userId ${userId}:`, error.message);
            return null;
        }
    }
}

module.exports = AvaliacoesManager;