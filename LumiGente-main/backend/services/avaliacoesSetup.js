const sql = require('mssql');
const { getDatabasePool } = require('../config/db');

/**
 * Garante que todas as tabelas necessárias para o sistema de avaliações existam no banco de dados.
 * Executado na inicialização do servidor.
 */
async function ensureAvaliacoesTablesExist() {
    try {
        const pool = await getDatabasePool();



        // 1. Tabela TiposAvaliacao (45 dias e 90 dias)
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TiposAvaliacao')
            BEGIN
                CREATE TABLE TiposAvaliacao (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Nome NVARCHAR(100) NOT NULL,
                    Descricao NTEXT,
                    created_at DATETIME DEFAULT GETDATE()
                );
                
                -- Inserir tipos padrão
                INSERT INTO TiposAvaliacao (Nome, Descricao) VALUES
                ('Avaliação de 45 dias', 'Avaliação de experiência após 45 dias de admissão'),
                ('Avaliação de 90 dias', 'Avaliação de experiência após 90 dias de admissão');
                
                PRINT '  -> Tabela TiposAvaliacao criada';
            END
            ELSE
            BEGIN
                PRINT '  -> Tabela TiposAvaliacao já existe';
            END
        `);

        // 2. Tabela TemplatesPerguntasAvaliacao (questionários padrão TEMPLATES)
        const templatesTableCheck = await pool.request().query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TemplatesPerguntasAvaliacao'
        `);

        if (templatesTableCheck.recordset[0].existe === 0) {
            await pool.request().query(`
                CREATE TABLE TemplatesPerguntasAvaliacao (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    TipoAvaliacaoId INT NOT NULL,
                    Pergunta NTEXT NOT NULL,
                    TipoPergunta VARCHAR(50) NOT NULL DEFAULT 'texto',
                    Ordem INT NOT NULL,
                    Obrigatoria BIT DEFAULT 1,
                    EscalaMinima INT NULL,
                    EscalaMaxima INT NULL,
                    EscalaLabelMinima NVARCHAR(100) NULL,
                    EscalaLabelMaxima NVARCHAR(100) NULL,
                    Ativa BIT DEFAULT 1,
                    CriadoEm DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (TipoAvaliacaoId) REFERENCES TiposAvaliacao(Id)
                );
                
                -- Inserir perguntas padrão para avaliação de 45 dias
                INSERT INTO TemplatesPerguntasAvaliacao (TipoAvaliacaoId, Pergunta, TipoPergunta, Ordem, Obrigatoria, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima) VALUES
                (1, 'Como você avalia seu processo de integração na empresa?', 'escala', 1, 1, 1, 5, 'Muito Insatisfeito', 'Muito Satisfeito'),
                (1, 'Você se sente preparado para executar suas atividades?', 'escala', 2, 1, 1, 5, 'Nada Preparado', 'Totalmente Preparado'),
                (1, 'O ambiente de trabalho atende suas expectativas?', 'escala', 3, 1, 1, 5, 'Muito Abaixo', 'Muito Acima'),
                (1, 'Você recebeu o suporte necessário da sua liderança?', 'escala', 4, 1, 1, 5, 'Nenhum Suporte', 'Suporte Total'),
                (1, 'Tem alguma sugestão ou comentário sobre seus primeiros dias?', 'texto', 5, 0, NULL, NULL, NULL, NULL);
                
                -- Inserir perguntas padrão para avaliação de 90 dias
                INSERT INTO TemplatesPerguntasAvaliacao (TipoAvaliacaoId, Pergunta, TipoPergunta, Ordem, Obrigatoria, EscalaMinima, EscalaMaxima, EscalaLabelMinima, EscalaLabelMaxima) VALUES
                (2, 'Como você avalia sua adaptação à empresa após 90 dias?', 'escala', 1, 1, 1, 5, 'Muito Mal Adaptado', 'Muito Bem Adaptado'),
                (2, 'Você compreende claramente suas responsabilidades e objetivos?', 'escala', 2, 1, 1, 5, 'Não Compreendo', 'Compreendo Totalmente'),
                (2, 'Como você avalia o relacionamento com sua equipe?', 'escala', 3, 1, 1, 5, 'Muito Ruim', 'Excelente'),
                (2, 'A empresa atendeu suas expectativas iniciais?', 'escala', 4, 1, 1, 5, 'Muito Abaixo', 'Muito Acima'),
                (2, 'Você se vê continuando na empresa a longo prazo?', 'escala', 5, 1, 1, 5, 'Definitivamente Não', 'Definitivamente Sim'),
                (2, 'Quais pontos você gostaria de destacar (positivos ou de melhoria)?', 'texto', 6, 0, NULL, NULL, NULL, NULL);
            `);
        }

        // 3. Tabela Avaliacoes (instâncias de avaliações) - Verificar se já existe
        const avaliacoesTableCheck = await pool.request().query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Avaliacoes'
        `);

        if (avaliacoesTableCheck.recordset[0].existe === 0) {
            await pool.request().query(`
                CREATE TABLE Avaliacoes (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    UserId INT NOT NULL,
                    GestorId INT NULL,
                    Matricula NVARCHAR(50),
                    DataAdmissao DATE NOT NULL,
                    TipoAvaliacaoId INT NOT NULL,
                    DataCriacao DATETIME DEFAULT GETDATE(),
                    DataLimiteResposta DATE NOT NULL,
                    StatusAvaliacao NVARCHAR(50) DEFAULT 'Agendada',
                    RespostaColaboradorConcluida BIT DEFAULT 0,
                    RespostaGestorConcluida BIT DEFAULT 0,
                    DataRespostaColaborador DATETIME NULL,
                    DataRespostaGestor DATETIME NULL,
                    AtualizadoEm DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (UserId) REFERENCES Users(Id),
                    FOREIGN KEY (GestorId) REFERENCES Users(Id),
                    FOREIGN KEY (TipoAvaliacaoId) REFERENCES TiposAvaliacao(Id)
                );
            `);
        }

        // 5. Tabela RespostasAvaliacoes (respostas dos participantes)
        const respostasTableCheck = await pool.request().query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RespostasAvaliacoes'
        `);

        if (respostasTableCheck.recordset[0].existe === 0) {
            await pool.request().query(`
                CREATE TABLE RespostasAvaliacoes (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    AvaliacaoId INT NOT NULL,
                    PerguntaId INT NOT NULL,
                    Resposta NTEXT,
                    RespondidoPor INT NOT NULL,
                    TipoRespondente NVARCHAR(50) NOT NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id) ON DELETE CASCADE,
                    FOREIGN KEY (PerguntaId) REFERENCES PerguntasSalvasAvaliacao(Id),
                    FOREIGN KEY (RespondidoPor) REFERENCES Users(Id)
                );
            `);
        }
        // Verificar estrutura da tabela PerguntasAvaliacao para adaptar o código
        await verificarEstruturaPerguntasAvaliacao(pool);

        return true;

    } catch (error) {
        console.error('❌ Erro ao criar/verificar tabelas de avaliações:', error);
        throw error;
    }
}

/**
 * Verifica a estrutura real da tabela PerguntasAvaliacao para adaptar o código
 */
async function verificarEstruturaPerguntasAvaliacao(pool) {
    try {
        const colunas = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'PerguntasAvaliacao'
            ORDER BY ORDINAL_POSITION
        `);

        if (colunas.recordset.length > 0) {

            // Verificar se há dados na tabela
            const count = await pool.request().query(`SELECT COUNT(*) as total FROM PerguntasAvaliacao`);


            // Se houver dados, mostrar um exemplo
            if (count.recordset[0].total > 0) {
                const exemplo = await pool.request().query(`SELECT TOP 1 * FROM PerguntasAvaliacao`);

            }
        }
    } catch (error) {
        console.log('⚠️ Não foi possível verificar estrutura:', error.message);
    }
}

module.exports = { ensureAvaliacoesTablesExist };