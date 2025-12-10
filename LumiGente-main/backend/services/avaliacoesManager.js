const { getDatabasePool } = require('../config/db');
const { getTipoAvaliacaoIdByDias } = require('./avaliacoesSetup');

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
            const [novosFuncionarios] = await pool.execute(`
                SELECT 
                    u.Id, 
                    u.Matricula, 
                    u.NomeCompleto, 
                    s.DTA_ADMISSAO as DataAdmissao,
                    DATEDIFF(NOW(), s.DTA_ADMISSAO) as DiasNaEmpresa,
                    NULL as GestorId
                FROM Users u
                INNER JOIN TAB_HIST_SRA s ON s.CPF = u.CPF AND s.MATRICULA = u.Matricula AND s.STATUS_GERAL = 'ATIVO'
                WHERE 
                    u.IsActive = 1 
                    AND (u.IsExternal IS NULL OR u.IsExternal = 0)
                    AND s.DTA_ADMISSAO IS NOT NULL
                    AND DATEDIFF(NOW(), s.DTA_ADMISSAO) <= 100
            `);

            let criadas45 = 0;
            let criadas90 = 0;

            for (const func of novosFuncionarios) {
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
                    // Buscar IDs dinamicamente
                    const tipo45Id = await getTipoAvaliacaoIdByDias(45);
                    const tipo90Id = await getTipoAvaliacaoIdByDias(90);
                    
                    if (!tipo45Id || !tipo90Id) {
                        console.warn('⚠️ Tipos de avaliação não encontrados. Verifique se a tabela TiposAvaliacao está populada.');
                        continue;
                    }
                    
                    // Se tem menos de 45 dias, cria ambas as avaliações
                    if (diasNaEmpresa < 45) {
                        const [avaliacao45existente] = await pool.execute(
                            'SELECT Id FROM Avaliacoes WHERE UserId = ? AND TipoAvaliacaoId = ?',
                            [func.Id, tipo45Id]
                        );

                        if (avaliacao45existente.length === 0) {
                            await this.criarAvaliacao(func, tipo45Id);
                            criadas45++;
                        }
                    }
                    
                    // Sempre cria avaliação de 90 dias para quem tem menos de 90 dias
                    const [avaliacao90existente] = await pool.execute(
                        'SELECT Id FROM Avaliacoes WHERE UserId = ? AND TipoAvaliacaoId = ?',
                        [func.Id, tipo90Id]
                    );

                    if (avaliacao90existente.length === 0) {
                        await this.criarAvaliacao(func, tipo90Id);
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
        
        // Buscar informações do tipo de avaliação para obter os dias dinamicamente
        const [tipoAvaliacaoRows] = await pool.execute(`
            SELECT Id, DiasMinimos, DiasMaximos, Nome 
            FROM TiposAvaliacao 
            WHERE Id = ?
        `, [tipoAvaliacaoId]);
        
        if (tipoAvaliacaoRows.length === 0) {
            throw new Error(`Tipo de avaliação com ID ${tipoAvaliacaoId} não encontrado`);
        }
        
        const tipo = tipoAvaliacaoRows[0];
        let diasPrazo = tipo.DiasMinimos || tipo.DiasMaximos;
        if (!diasPrazo) {
            const match = tipo.Nome.match(/(\d+)/);
            diasPrazo = match ? parseInt(match[1]) : 45;
        }
        
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
        const [insertResult] = await pool.execute(`
            INSERT INTO Avaliacoes (UserId, GestorId, Matricula, DataAdmissao, TipoAvaliacaoId, DataLimiteResposta, StatusAvaliacao, DataCriacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [funcionario.Id, funcionario.GestorId || null, funcionario.Matricula || '', funcionario.DataAdmissao, tipoAvaliacaoId, dataLimite, statusInicial]);

        const avaliacaoId = insertResult.insertId;

        // Copiar perguntas do template padrão para criar snapshot da avaliação
        const tabelaQuestionario = diasPrazo === 45 ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';
        const tabelaOpcoes = diasPrazo === 45 ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';
        
        const [perguntas] = await pool.execute(`SELECT * FROM ${tabelaQuestionario} ORDER BY Ordem`);

        for (const pergunta of perguntas) {
            const [insertPergunta] = await pool.execute(`
                INSERT INTO PerguntasAvaliacao 
                (AvaliacaoId, Pergunta, TipoPergunta, Ordem, Obrigatoria, 
                 EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima, CriadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [avaliacaoId, pergunta.Pergunta, pergunta.TipoPergunta, pergunta.Ordem, pergunta.Obrigatoria,
                pergunta.EscalaMinima, pergunta.EscalaMaxima, pergunta.EscalaLabelMinima, pergunta.EscalaLabelMaxima]);

            const perguntaAvaliacaoId = insertPergunta.insertId;

            if (pergunta.TipoPergunta === 'multipla_escolha') {
                const [opcoes] = await pool.execute(
                    `SELECT * FROM ${tabelaOpcoes} WHERE PerguntaId = ? ORDER BY Ordem`,
                    [pergunta.Id]
                );

                for (const opcao of opcoes) {
                    await pool.execute(
                        `INSERT INTO OpcoesPerguntasAvaliacao (PerguntaAvaliacaoId, TextoOpcao, Ordem) VALUES (?, ?, ?)`,
                        [perguntaAvaliacaoId, opcao.TextoOpcao, opcao.Ordem]
                    );
                }
            }
        }
    }

    /**
     * Busca as avaliações associadas a um usuário (como avaliado ou avaliador).
     */
    static async buscarAvaliacoesUsuario(pool, userId, temPermissaoAdmin) {
        const [rows] = await pool.execute(`
            SELECT 
                a.*, 
                t.Nome as TipoAvaliacao, 
                u.NomeCompleto, 
                COALESCE(u.DescricaoDepartamento, u.Departamento, 'Não informado') as Departamento,
                g.NomeCompleto as NomeGestor,
                COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta) as DataLimiteResposta
            FROM Avaliacoes a
            JOIN TiposAvaliacao t ON a.TipoAvaliacaoId = t.Id
            JOIN Users u ON a.UserId = u.Id
            LEFT JOIN Users g ON a.GestorId = g.Id
            WHERE a.UserId = ? OR a.GestorId = ?
            ORDER BY 
                CASE a.StatusAvaliacao 
                    WHEN 'Pendente' THEN 1 
                    WHEN 'Agendada' THEN 2 
                    WHEN 'Concluída' THEN 3 
                    WHEN 'Expirada' THEN 4 
                    ELSE 5 
                END, 
                COALESCE(a.NovaDataLimiteResposta, a.DataLimiteResposta) ASC
        `, [userId, userId]);

        return rows;
    }

    /**
     * Busca uma avaliação específica pelo ID.
     */
    static async getAvaliacao(avaliacaoId) {
        const pool = await getDatabasePool();
        const [rows] = await pool.execute(`
            SELECT 
                *,
                COALESCE(NovaDataLimiteResposta, DataLimiteResposta) as DataLimiteResposta
            FROM Avaliacoes 
            WHERE Id = ?
        `, [avaliacaoId]);
        return rows[0];
    }

    /**
     * Valida se um usuário pode responder a uma avaliação e retorna os dados da avaliação.
     */
    static async validarPermissaoResposta(pool, avaliacaoId, userId, tipoRespondente) {
        console.log('🔍 Validando permissão - avaliacaoId:', avaliacaoId, 'userId:', userId, 'tipo:', tipoRespondente);
        
        const [rows] = await pool.execute(`
            SELECT 
                *,
                COALESCE(NovaDataLimiteResposta, DataLimiteResposta) as DataLimiteResposta
            FROM Avaliacoes 
            WHERE Id = ?
        `, [avaliacaoId]);
        
        const avaliacao = rows[0];
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
        
        const [perguntas] = await pool.execute(
            'SELECT * FROM PerguntasAvaliacao WHERE AvaliacaoId = ? ORDER BY Ordem',
            [avaliacaoId]
        );
        
        for (const pergunta of perguntas) {
            if (pergunta.TipoPergunta === 'multipla_escolha') {
                const [opcoes] = await pool.execute(
                    'SELECT * FROM OpcoesPerguntasAvaliacao WHERE PerguntaAvaliacaoId = ? ORDER BY Ordem',
                    [pergunta.Id]
                );
                pergunta.Opcoes = opcoes;
            } else {
                pergunta.Opcoes = [];
            }
        }
        
        return perguntas;
    }

    /**
     * Busca as respostas que um determinado usuário deu para uma avaliação.
     */
    static async buscarRespostasPorUsuario(avaliacaoId, userId) {
        const pool = await getDatabasePool();
        const [rows] = await pool.execute(
            'SELECT * FROM RespostasAvaliacoes WHERE AvaliacaoId = ? AND RespondidoPor = ? ORDER BY PerguntaId',
            [avaliacaoId, userId]
        );
        return rows;
    }

    /**
     * Busca as respostas da "outra parte" em uma avaliação.
     */
    static async buscarRespostasOutraParte(avaliacaoId, userId) {
        const pool = await getDatabasePool();
        const [rows] = await pool.execute(
            'SELECT * FROM RespostasAvaliacoes WHERE AvaliacaoId = ? AND RespondidoPor != ? ORDER BY PerguntaId',
            [avaliacaoId, userId]
        );
        return rows;
    }

    /**
     * Salva uma resposta individual de uma avaliação no banco de dados.
     */
    static async salvarRespostaAvaliacao(pool, respostaData) {
        const { avaliacaoId, perguntaId, resposta, respondidoPor, tipoRespondente } = respostaData;
        
        const [avaliacaoRows] = await pool.execute(
            'SELECT TipoAvaliacaoId FROM Avaliacoes WHERE Id = ?',
            [avaliacaoId]
        );
        
        const [tipoAvalRows] = await pool.execute(
            'SELECT DiasMinimos, DiasMaximos, Nome FROM TiposAvaliacao WHERE Id = ?',
            [avaliacaoRows[0].TipoAvaliacaoId]
        );
        
        let diasTipo = null;
        if (tipoAvalRows.length > 0) {
            const tipo = tipoAvalRows[0];
            diasTipo = tipo.DiasMinimos || tipo.DiasMaximos;
            if (!diasTipo) {
                const match = tipo.Nome.match(/(\d+)/);
                diasTipo = match ? parseInt(match[1]) : 90;
            }
        }
        const tipoQuestionario = diasTipo === 45 ? '45' : '90';
        
        const [perguntaRows] = await pool.execute(
            'SELECT Pergunta, TipoPergunta FROM PerguntasAvaliacao WHERE Id = ?',
            [perguntaId]
        );
        
        const textoPergunta = perguntaRows[0]?.Pergunta || '';
        const tipoPergunta = perguntaRows[0]?.TipoPergunta || 'texto';

        await pool.execute(`
            INSERT INTO RespostasAvaliacoes (AvaliacaoId, PerguntaId, Pergunta, TipoPergunta, Resposta, RespondidoPor, TipoRespondente, TipoQuestionario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [avaliacaoId, perguntaId, textoPergunta, tipoPergunta, resposta, respondidoPor, tipoRespondente, tipoQuestionario]);
    }

    /**
     * Marca a parte de uma avaliação (do colaborador ou do gestor) como concluída.
     */
    static async concluirAvaliacao(pool, avaliacaoId, tipoRespondente) {
        console.log('📝 Concluindo avaliação', avaliacaoId, 'para', tipoRespondente);
        
        let campoData = tipoRespondente === 'colaborador' ? 'DataRespostaColaborador' : 'DataRespostaGestor';
        let campoConcluida = tipoRespondente === 'colaborador' ? 'RespostaColaboradorConcluida' : 'RespostaGestorConcluida';

        await pool.execute(`
            UPDATE Avaliacoes 
            SET ${campoConcluida} = 1, ${campoData} = NOW()
            WHERE Id = ?
        `, [avaliacaoId]);
        
        console.log('✅ Campo', campoConcluida, 'marcado como concluído');
        
        const [checkCompletion] = await pool.execute(
            'SELECT RespostaColaboradorConcluida, RespostaGestorConcluida FROM Avaliacoes WHERE Id = ?',
            [avaliacaoId]
        );
        
        if (checkCompletion[0].RespostaColaboradorConcluida && checkCompletion[0].RespostaGestorConcluida) {
            await pool.execute(`UPDATE Avaliacoes SET StatusAvaliacao = 'Concluida' WHERE Id = ?`, [avaliacaoId]);
            console.log('✅ Ambas as partes responderam - Status alterado para Concluida');
        }
    }

    /**
     * Busca o questionário template padrão (45 ou 90 dias) para exibição.
     */
    static async buscarQuestionarioPadrao(pool, tipo) {
        const tabelaQuestionario = tipo === '45' ? 'QuestionarioPadrao45' : 'QuestionarioPadrao90';
        const tabelaOpcoes = tipo === '45' ? 'OpcoesQuestionario45' : 'OpcoesQuestionario90';

        const [perguntas] = await pool.execute(`SELECT * FROM ${tabelaQuestionario} ORDER BY Ordem`);
        
        for (const pergunta of perguntas) {
            if (pergunta.TipoPergunta === 'multipla_escolha') {
                const [opcoes] = await pool.execute(
                    `SELECT * FROM ${tabelaOpcoes} WHERE PerguntaId = ? ORDER BY Ordem`,
                    [pergunta.Id]
                );
                pergunta.Opcoes = opcoes;
            }
        }
        
        return perguntas;
    }

    /**
     * Atualiza as perguntas de um questionário template padrão.
     */
    static async atualizarQuestionarioPadrao(pool, tipo, perguntas) {
        console.warn('⚠️ Método atualizarQuestionarioPadrao não deve ser usado. Use o CRUD de templates.');
        return { success: false, message: 'Use o CRUD de templates para gerenciar questionários' };
    }

    /**
     * Reabre uma avaliação que foi expirada.
     */
    static async reabrirAvaliacao(pool, avaliacaoId, novaDataLimite) {
        const dataLimpa = novaDataLimite.trim().replace(/\s+/g, '').replace(/-+/g, '-');
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dataLimpa)) {
            throw new Error('Formato de data inválido. Use YYYY-MM-DD');
        }
        
        const [ano, mes, dia] = dataLimpa.split('-');
        const anoInt = parseInt(ano);
        const mesInt = parseInt(mes);
        const diaInt = parseInt(dia);
        const dataFormatada = new Date(anoInt, mesInt - 1, diaInt);
        
        if (isNaN(dataFormatada.getTime()) || 
            dataFormatada.getFullYear() != anoInt || 
            dataFormatada.getMonth() != mesInt - 1 || 
            dataFormatada.getDate() != diaInt) {
            throw new Error('Data inválida fornecida');
        }

        await pool.execute(`
            UPDATE Avaliacoes
            SET NovaDataLimiteResposta = ?, StatusAvaliacao = 'Pendente', AtualizadoEm = NOW()
            WHERE Id = ? AND StatusAvaliacao = 'Expirada'
        `, [dataLimpa, avaliacaoId]);
    }

    /**
     * Busca o ID do gestor direto usando DEPARTAMENTO e hierarchyPath.
     */
    static async buscarGestor(pool, userId) {
        try {
            const [userRows] = await pool.execute(
                'SELECT Id, NomeCompleto, Departamento, HierarchyPath FROM Users WHERE Id = ? AND IsActive = 1',
                [userId]
            );
            
            if (userRows.length === 0) {
                console.log(`❌ Usuário ${userId} não encontrado`);
                return null;
            }
            
            const user = userRows[0];
            
            if (!user.Departamento || !user.HierarchyPath) {
                return null;
            }
            
            const departamento = user.Departamento;
            const hierarchyPath = user.HierarchyPath;
            const pathParts = hierarchyPath.split(' > ').map(p => p.trim());
            
            const deptIndex = pathParts.indexOf(departamento);
            
            if (deptIndex <= 0) {
                return null;
            }
            
            const gestorDepartamento = pathParts[deptIndex - 1];
            
            const [gestorRows] = await pool.execute(
                'SELECT Id, NomeCompleto FROM Users WHERE Departamento = ? AND IsActive = 1',
                [gestorDepartamento]
            );
            
            if (gestorRows.length > 0) {
                const gestor = gestorRows[0];
                return gestor.Id;
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Erro ao buscar gestor para userId ${userId}:`, error.message);
            return null;
        }
    }
}

module.exports = AvaliacoesManager;
