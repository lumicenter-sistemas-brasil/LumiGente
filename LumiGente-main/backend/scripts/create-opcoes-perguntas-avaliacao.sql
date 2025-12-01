-- Script para criar tabela OpcoesPerguntasAvaliacao
-- Execute este script manualmente no SQL Server Management Studio

-- Verificar se a tabela já existe
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
    
    PRINT '✅ Tabela OpcoesPerguntasAvaliacao criada com sucesso';
END
ELSE
BEGIN
    PRINT '⚠️ Tabela OpcoesPerguntasAvaliacao já existe';
END
GO
