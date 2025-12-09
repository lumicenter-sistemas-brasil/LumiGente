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
        const tiposTableCheck = await pool.request().query(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TiposAvaliacao'
        `);

        if (tiposTableCheck.recordset[0].existe === 0) {
            // Tabela não existe - criar com estrutura completa e inserir dados padrão
            await pool.request().query(`
                CREATE TABLE TiposAvaliacao (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Nome VARCHAR(50) NOT NULL,
                    DiasMinimos INT NOT NULL,
                    DiasMaximos INT NOT NULL,
                    Descricao VARCHAR(500),
                    Ativo BIT DEFAULT 1,
                    CriadoEm DATETIME DEFAULT GETDATE(),
                    AtualizadoEm DATETIME DEFAULT GETDATE()
                );
            `);
            
            await pool.request().query(`
                INSERT INTO TiposAvaliacao (Nome, DiasMinimos, DiasMaximos, Descricao) VALUES
                ('Avaliação de 45 dias', 45, 45, 'Avaliação de experiência após 45 dias de admissão'),
                ('Avaliação de 90 dias', 90, 90, 'Avaliação de experiência após 90 dias de admissão');
            `);
            
            console.log('  -> Tabela TiposAvaliacao criada e populada com dados padrão');
        } else {
            // Tabela existe - verificar se está vazia e inserir dados se necessário
            const tiposCountCheck = await pool.request().query(`
                SELECT COUNT(*) as total FROM TiposAvaliacao
            `);

            if (tiposCountCheck.recordset[0].total === 0) {
                // Verificar estrutura da tabela para inserir com campos corretos
                const columnsCheck = await pool.request().query(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'TiposAvaliacao'
                `);
                
                const hasDiasMinimos = columnsCheck.recordset.some(c => c.COLUMN_NAME === 'DiasMinimos');
                const hasDiasMaximos = columnsCheck.recordset.some(c => c.COLUMN_NAME === 'DiasMaximos');
                
                if (hasDiasMinimos && hasDiasMaximos) {
                    // Estrutura completa - inserir com todos os campos
                    await pool.request().query(`
                        INSERT INTO TiposAvaliacao (Nome, DiasMinimos, DiasMaximos, Descricao) VALUES
                        ('Avaliação de 45 dias', 45, 45, 'Avaliação de experiência após 45 dias de admissão'),
                        ('Avaliação de 90 dias', 90, 90, 'Avaliação de experiência após 90 dias de admissão');
                    `);
                } else {
                    // Estrutura antiga - inserir apenas Nome e Descricao
                    await pool.request().query(`
                        INSERT INTO TiposAvaliacao (Nome, Descricao) VALUES
                        ('Avaliação de 45 dias', 'Avaliação de experiência após 45 dias de admissão'),
                        ('Avaliação de 90 dias', 'Avaliação de experiência após 90 dias de admissão');
                    `);
                }
                
                console.log('  -> Tabela TiposAvaliacao estava vazia - dados padrão inseridos');
            } else {
                console.log('  -> Tabela TiposAvaliacao já existe e possui dados');
            }
        }

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

/**
 * Busca o ID de um tipo de avaliação pelos dias (45 ou 90).
 * @param {number} dias - Número de dias (45 ou 90)
 * @returns {Promise<number|null>} - ID do tipo de avaliação ou null se não encontrado
 */
async function getTipoAvaliacaoIdByDias(dias) {
    try {
        const pool = await getDatabasePool();
        
        // Buscar por DiasMinimos ou DiasMaximos (se a estrutura tiver esses campos)
        // ou pelo nome se não tiver
        const result = await pool.request()
            .input('dias', sql.Int, dias)
            .input('diasStr', sql.VarChar, `%${dias}%`)
            .query(`
                SELECT Id FROM TiposAvaliacao 
                WHERE (DiasMinimos = @dias OR DiasMaximos = @dias)
                   OR (Nome LIKE @diasStr AND (DiasMinimos IS NULL OR DiasMaximos IS NULL))
                ORDER BY Id
            `);
        
        if (result.recordset.length > 0) {
            return result.recordset[0].Id;
        }
        
        return null;
    } catch (error) {
        console.error(`Erro ao buscar TipoAvaliacaoId para ${dias} dias:`, error);
        return null;
    }
}

module.exports = { ensureAvaliacoesTablesExist, getTipoAvaliacaoIdByDias };