const { getDatabasePool } = require('../config/db');

/**
 * Garante que todas as tabelas necessárias para o sistema de avaliações existam no banco de dados.
 * Executado na inicialização do servidor.
 */
async function ensureAvaliacoesTablesExist() {
    try {
        const pool = await getDatabasePool();

        // 1. Tabela TiposAvaliacao (45 dias e 90 dias)
        const [tiposTableCheck] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TiposAvaliacao'
        `);

        if (tiposTableCheck[0].existe === 0) {
            // Tabela não existe - criar com estrutura completa e inserir dados padrão
            await pool.execute(`
                CREATE TABLE TiposAvaliacao (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    Nome VARCHAR(50) NOT NULL,
                    DiasMinimos INT NOT NULL,
                    DiasMaximos INT NOT NULL,
                    Descricao VARCHAR(500),
                    Ativo TINYINT(1) DEFAULT 1,
                    CriadoEm DATETIME DEFAULT NOW(),
                    AtualizadoEm DATETIME DEFAULT NOW()
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            await pool.execute(`
                INSERT INTO TiposAvaliacao (Nome, DiasMinimos, DiasMaximos, Descricao) VALUES
                ('Avaliação de 45 dias', 45, 45, 'Avaliação de experiência após 45 dias de admissão'),
                ('Avaliação de 90 dias', 90, 90, 'Avaliação de experiência após 90 dias de admissão')
            `);
            
            console.log('  -> Tabela TiposAvaliacao criada e populada com dados padrão');
        } else {
            // Tabela existe - verificar se está vazia e inserir dados se necessário
            const [tiposCountCheck] = await pool.execute(`SELECT COUNT(*) as total FROM TiposAvaliacao`);

            if (tiposCountCheck[0].total === 0) {
                // Verificar estrutura da tabela para inserir com campos corretos
                const [columnsCheck] = await pool.execute(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TiposAvaliacao'
                `);
                
                const hasDiasMinimos = columnsCheck.some(c => c.COLUMN_NAME === 'DiasMinimos');
                const hasDiasMaximos = columnsCheck.some(c => c.COLUMN_NAME === 'DiasMaximos');
                
                if (hasDiasMinimos && hasDiasMaximos) {
                    await pool.execute(`
                        INSERT INTO TiposAvaliacao (Nome, DiasMinimos, DiasMaximos, Descricao) VALUES
                        ('Avaliação de 45 dias', 45, 45, 'Avaliação de experiência após 45 dias de admissão'),
                        ('Avaliação de 90 dias', 90, 90, 'Avaliação de experiência após 90 dias de admissão')
                    `);
                } else {
                    await pool.execute(`
                        INSERT INTO TiposAvaliacao (Nome, Descricao) VALUES
                        ('Avaliação de 45 dias', 'Avaliação de experiência após 45 dias de admissão'),
                        ('Avaliação de 90 dias', 'Avaliação de experiência após 90 dias de admissão')
                    `);
                }
                
                console.log('  -> Tabela TiposAvaliacao estava vazia - dados padrão inseridos');
            } else {
                console.log('  -> Tabela TiposAvaliacao já existe e possui dados');
            }
        }

        // 2. Tabela Avaliacoes (instâncias de avaliações)
        const [avaliacoesTableCheck] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Avaliacoes'
        `);

        if (avaliacoesTableCheck[0].existe === 0) {
            await pool.execute(`
                CREATE TABLE Avaliacoes (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    UserId INT NOT NULL,
                    GestorId INT NULL,
                    Matricula VARCHAR(50),
                    DataAdmissao DATE NOT NULL,
                    TipoAvaliacaoId INT NOT NULL,
                    DataCriacao DATETIME DEFAULT NOW(),
                    DataLimiteResposta DATE NOT NULL,
                    StatusAvaliacao VARCHAR(50) DEFAULT 'Agendada',
                    RespostaColaboradorConcluida TINYINT(1) DEFAULT 0,
                    RespostaGestorConcluida TINYINT(1) DEFAULT 0,
                    DataRespostaColaborador DATETIME NULL,
                    DataRespostaGestor DATETIME NULL,
                    AtualizadoEm DATETIME DEFAULT NOW(),
                    NovaDataLimiteResposta DATE NULL,
                    FOREIGN KEY (UserId) REFERENCES Users(Id),
                    FOREIGN KEY (GestorId) REFERENCES Users(Id),
                    FOREIGN KEY (TipoAvaliacaoId) REFERENCES TiposAvaliacao(Id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('  -> Tabela Avaliacoes criada');
        }

        // 3. Tabela PerguntasAvaliacao (snapshot das perguntas)
        const [perguntasAvaliacaoCheck] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PerguntasAvaliacao'
        `);

        if (perguntasAvaliacaoCheck[0].existe === 0) {
            await pool.execute(`
                CREATE TABLE PerguntasAvaliacao (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    AvaliacaoId INT NOT NULL,
                    Pergunta TEXT NOT NULL,
                    TipoPergunta VARCHAR(50) NOT NULL DEFAULT 'texto',
                    Ordem INT NOT NULL,
                    Obrigatoria TINYINT(1) DEFAULT 1,
                    EscalaMinima INT NULL,
                    EscalaMaxima INT NULL,
                    EscalaLabelMinima VARCHAR(100) NULL,
                    EscalaLabelMaxima VARCHAR(100) NULL,
                    CriadoEm DATETIME DEFAULT NOW(),
                    FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('  -> Tabela PerguntasAvaliacao criada');
        }

        // 4. Tabela OpcoesPerguntasAvaliacao (snapshot das opções)
        const [opcoesAvaliacaoCheck] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OpcoesPerguntasAvaliacao'
        `);

        if (opcoesAvaliacaoCheck[0].existe === 0) {
            await pool.execute(`
                CREATE TABLE OpcoesPerguntasAvaliacao (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    PerguntaId INT NOT NULL,
                    TextoOpcao VARCHAR(500) NOT NULL,
                    Ordem INT NOT NULL,
                    FOREIGN KEY (PerguntaId) REFERENCES PerguntasAvaliacao(Id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('  -> Tabela OpcoesPerguntasAvaliacao criada');
        }

        // 5. Tabela RespostasAvaliacoes (respostas dos participantes)
        const [respostasTableCheck] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RespostasAvaliacoes'
        `);

        if (respostasTableCheck[0].existe === 0) {
            await pool.execute(`
                CREATE TABLE RespostasAvaliacoes (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    AvaliacaoId INT NOT NULL,
                    PerguntaId INT NOT NULL,
                    Resposta TEXT,
                    RespondidoPor INT NOT NULL,
                    TipoRespondente VARCHAR(50) NOT NULL,
                    created_at DATETIME DEFAULT NOW(),
                    FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id) ON DELETE CASCADE,
                    FOREIGN KEY (PerguntaId) REFERENCES PerguntasAvaliacao(Id),
                    FOREIGN KEY (RespondidoPor) REFERENCES Users(Id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('  -> Tabela RespostasAvaliacoes criada');
        }

        // Verificar estrutura da tabela PerguntasAvaliacao para adaptar o código
        await verificarEstruturaPerguntasAvaliacao(pool);

        // Migração: Adicionar campo NovaDataLimiteResposta se não existir
        const [novaDataCheck] = await pool.execute(`
            SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Avaliacoes' AND COLUMN_NAME = 'NovaDataLimiteResposta'
        `);

        if (novaDataCheck[0].existe === 0) {
            await pool.execute(`ALTER TABLE Avaliacoes ADD COLUMN NovaDataLimiteResposta DATE NULL`);
            console.log('  -> Campo NovaDataLimiteResposta adicionado à tabela Avaliacoes');
        }

        // Migração: Renomear PrazoRevisao para PrazoConclusao na tabela PDIs
        try {
            const [pdisTableCheck] = await pool.execute(`
                SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs'
            `);

            if (pdisTableCheck[0].existe > 0) {
                const [prazoRevisaoCheck] = await pool.execute(`
                    SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoRevisao'
                `);

                const [prazoConclusaoCheck] = await pool.execute(`
                    SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoConclusao'
                `);

                if (prazoRevisaoCheck[0].existe > 0 && prazoConclusaoCheck[0].existe === 0) {
                    // No MySQL, para renomear coluna usa-se CHANGE COLUMN
                    // Primeiro precisamos saber o tipo da coluna
                    const [colInfo] = await pool.execute(`
                        SELECT DATA_TYPE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PDIs' AND COLUMN_NAME = 'PrazoRevisao'
                    `);
                    
                    if (colInfo.length > 0) {
                        const columnType = colInfo[0].COLUMN_TYPE;
                        await pool.execute(`ALTER TABLE PDIs CHANGE COLUMN PrazoRevisao PrazoConclusao ${columnType}`);
                        console.log('  -> Coluna PrazoRevisao renomeada para PrazoConclusao na tabela PDIs');
                    }
                }
            }
        } catch (error) {
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
        const [colunas] = await pool.execute(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PerguntasAvaliacao'
            ORDER BY ORDINAL_POSITION
        `);

        if (colunas.length > 0) {
            // Verificar se há dados na tabela
            const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM PerguntasAvaliacao`);

            // Se houver dados, mostrar um exemplo
            if (countResult[0].total > 0) {
                const [exemplo] = await pool.execute(`SELECT * FROM PerguntasAvaliacao LIMIT 1`);
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
        
        const [rows] = await pool.execute(`
            SELECT Id FROM TiposAvaliacao 
            WHERE (DiasMinimos = ? OR DiasMaximos = ?)
               OR (Nome LIKE ? AND (DiasMinimos IS NULL OR DiasMaximos IS NULL))
            ORDER BY Id
            LIMIT 1
        `, [dias, dias, `%${dias}%`]);
        
        if (rows.length > 0) {
            return rows[0].Id;
        }
        
        return null;
    } catch (error) {
        console.error(`Erro ao buscar TipoAvaliacaoId para ${dias} dias:`, error);
        return null;
    }
}

module.exports = { ensureAvaliacoesTablesExist, getTipoAvaliacaoIdByDias };
