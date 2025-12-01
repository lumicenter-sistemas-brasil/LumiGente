-- Script para criar tabela PerguntasAvaliacao
-- Execute este script manualmente no SQL Server Management Studio

-- Verificar se a tabela já existe
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
    
    PRINT '✅ Tabela PerguntasAvaliacao criada com sucesso';
END
ELSE
BEGIN
    PRINT '⚠️ Tabela PerguntasAvaliacao já existe';
END
GO
