-- =====================================================
-- SCRIPT OPCIONAL - CRIAR ÍNDICES
-- =====================================================
-- Execute APENAS DEPOIS de adicionar os campos
-- Os índices melhoram performance mas NÃO são obrigatórios
-- =====================================================

USE [LUMICENTER_FEEDBACKS];
GO

PRINT '========================================';
PRINT 'Criando índices (OPCIONAL)';
PRINT '========================================';
PRINT '';

-- Índice para PasswordRevertToken
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Users_PasswordRevertToken' 
    AND object_id = OBJECT_ID('dbo.Users')
)
BEGIN
    PRINT '➕ Criando índice para PasswordRevertToken...';
    CREATE NONCLUSTERED INDEX [IX_Users_PasswordRevertToken] 
    ON [dbo].[Users]([PasswordRevertToken]);
    PRINT '✅ Índice criado!';
END
ELSE
BEGIN
    PRINT '✓ Índice já existe';
END

-- Índice para PasswordChangeCancelToken
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Users_PasswordChangeCancelToken' 
    AND object_id = OBJECT_ID('dbo.Users')
)
BEGIN
    PRINT '➕ Criando índice para PasswordChangeCancelToken...';
    CREATE NONCLUSTERED INDEX [IX_Users_PasswordChangeCancelToken] 
    ON [dbo].[Users]([PasswordChangeCancelToken]);
    PRINT '✅ Índice criado!';
END
ELSE
BEGIN
    PRINT '✓ Índice já existe';
END

PRINT '';
PRINT '========================================';
PRINT '✅ Índices criados com sucesso!';
PRINT '========================================';
GO

