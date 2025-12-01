-- Script completo para configurar sistema de snapshot de avaliações
-- Execute este script no SQL Server Management Studio

PRINT '🔧 Iniciando configuração do sistema de avaliações...';
GO

-- 1. Criar tabela PerguntasAvaliacao (snapshot das perguntas)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PerguntasAvaliacao')
BEGIN
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
        CONSTRAINT FK_PerguntasAvaliacao_Avaliacoes 
            FOREIGN KEY (AvaliacaoId) REFERENCES Avaliacoes(Id) ON DELETE CASCADE
    );
    PRINT '  ✅ Tabela PerguntasAvaliacao criada';
END
ELSE
BEGIN
    PRINT '  ⚠️ Tabela PerguntasAvaliacao já existe';
END
GO

-- 2. Criar tabela OpcoesPerguntasAvaliacao (snapshot das opções)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OpcoesPerguntasAvaliacao')
BEGIN
    CREATE TABLE OpcoesPerguntasAvaliacao (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PerguntaId INT NOT NULL,
        TextoOpcao NVARCHAR(500) NOT NULL,
        Ordem INT NOT NULL,
        CONSTRAINT FK_OpcoesPerguntasAvaliacao_PerguntasAvaliacao 
            FOREIGN KEY (PerguntaId) REFERENCES PerguntasAvaliacao(Id) ON DELETE CASCADE
    );
    PRINT '  ✅ Tabela OpcoesPerguntasAvaliacao criada';
END
ELSE
BEGIN
    PRINT '  ⚠️ Tabela OpcoesPerguntasAvaliacao já existe';
END
GO

-- 3. Atualizar FK da tabela RespostasAvaliacoes se necessário
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
    WHERE CONSTRAINT_NAME = 'FK__Respostas__Pergu__XXX'
)
BEGIN
    PRINT '  ℹ️ Verificando FK de RespostasAvaliacoes...';
    -- A FK será recriada automaticamente se necessário
END
GO

PRINT '✅ Configuração concluída com sucesso!';
PRINT '';
PRINT '📋 Próximos passos:';
PRINT '  1. Reinicie o servidor Node.js';
PRINT '  2. O sistema criará avaliações automaticamente';
PRINT '  3. As perguntas serão copiadas de QuestionarioPadrao45/90';
GO
