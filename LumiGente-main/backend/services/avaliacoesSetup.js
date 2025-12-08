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

        // 2. Tabela Avaliacoes (instâncias de avaliações) - Verificar se já existe
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

        // 4. Tabela PerguntasAvaliacao (snapshot das perguntas)
        const perguntasAvaliacaoCheck = await pool.request().query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PerguntasAvaliacao'
        `);

        if (perguntasAvaliacaoCheck.recordset[0].existe === 0) {
            await pool.request().query(`
                CREATE TABLE PerguntasAvaliacao (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    AvaliacaoId INT NOT NULL,
                    Pergunta NTEXT NOT NULL,
                    TipoPergunta VARCHAR(50) NOT NULL DEFAULT 'texto',
                    Ordem INT NOT NULL,
                    Obrigatoria BIT DEFAULT 1,
                    EscalaMinima INT NULL,
                    EscalaMaxima INT NULL,
                    EscalaLabelMinima NVARCHAR(100) NULL,
                    EscalaLabelMaxima NVARCHAR(100) NULL,
                    CriadoEm DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id) ON DELETE CASCADE
                );
            `);
        }

        // 5. Tabela OpcoesPerguntasAvaliacao (snapshot das opções)
        const opcoesAvaliacaoCheck = await pool.request().query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OpcoesPerguntasAvaliacao'
        `);

        if (opcoesAvaliacaoCheck.recordset[0].existe === 0) {
            await pool.request().query(`
                CREATE TABLE OpcoesPerguntasAvaliacao (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    PerguntaId INT NOT NULL,
                    TextoOpcao NVARCHAR(500) NOT NULL,
                    Ordem INT NOT NULL,
                    FOREIGN KEY (PerguntaId) REFERENCES PerguntasAvaliacao(Id) ON DELETE CASCADE
                );
            `);
        }

        // 6. Tabela RespostasAvaliacoes (respostas dos participantes)
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
                    FOREIGN KEY (PerguntaId) REFERENCES PerguntasAvaliacao(Id),
                    FOREIGN KEY (RespondidoPor) REFERENCES Users(Id)
                );
            `);
        }
        // Verificar estrutura da tabela PerguntasAvaliacao para adaptar o código
        await verificarEstruturaPerguntasAvaliacao(pool);

        // Migração: Adicionar campo NovaDataLimiteResposta se não existir
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Avaliacoes' AND COLUMN_NAME = 'NovaDataLimiteResposta'
            )
            BEGIN
                ALTER TABLE Avaliacoes
                ADD NovaDataLimiteResposta DATE NULL;
                PRINT '  -> Campo NovaDataLimiteResposta adicionado à tabela Avaliacoes';
            END
            ELSE
            BEGIN
                PRINT '  -> Campo NovaDataLimiteResposta já existe';
            END
        `);

        // Migração: Renomear PrazoRevisao para PrazoConclusao na tabela PDIs
        try {
            const prazoRevisaoCheck = await pool.request().query(`
                SELECT COUNT(*) as existe
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoRevisao'
            `);

            const prazoConclusaoCheck = await pool.request().query(`
                SELECT COUNT(*) as existe
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
            `);

            if (prazoRevisaoCheck.recordset[0].existe > 0 && prazoConclusaoCheck.recordset[0].existe === 0) {
                await pool.request().query(`
                    EXEC sp_rename 'PDIs.PrazoRevisao', 'PrazoConclusao', 'COLUMN';
                `);
                console.log('  -> Coluna PrazoRevisao renomeada para PrazoConclusao na tabela PDIs');
            } else if (prazoConclusaoCheck.recordset[0].existe > 0) {
                console.log('  -> Coluna PrazoConclusao já existe na tabela PDIs');
            }
        } catch (error) {
            // Se a tabela PDIs não existir ainda, apenas logar o erro sem quebrar
            console.log('  -> Aviso: Não foi possível verificar/renomear coluna PrazoRevisao:', error.message);
        }

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