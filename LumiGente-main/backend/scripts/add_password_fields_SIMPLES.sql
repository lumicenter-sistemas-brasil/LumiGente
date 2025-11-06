-- =====================================================
-- SCRIPT ULTRA SIMPLIFICADO - APENAS ADICIONA CAMPOS
-- =====================================================
-- Adiciona APENAS os 3 campos necessários
-- SEM índices (não são essenciais)
-- =====================================================

USE [LUMICENTER_FEEDBACKS];
GO

PRINT '========================================';
PRINT 'Adicionando campos de reversão de senha';
PRINT '========================================';
PRINT '';

-- 1. PasswordRevertToken
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PasswordRevertToken'
)
BEGIN
    PRINT '➕ Adicionando PasswordRevertToken...';
    ALTER TABLE [dbo].[Users] ADD [PasswordRevertToken] VARCHAR(500) NULL;
    PRINT '✅ PasswordRevertToken adicionado!';
END
ELSE
BEGIN
    PRINT '✓ PasswordRevertToken já existe';
END

-- 2. PasswordRevertExpires
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PasswordRevertExpires'
)
BEGIN
    PRINT '➕ Adicionando PasswordRevertExpires...';
    ALTER TABLE [dbo].[Users] ADD [PasswordRevertExpires] DATETIME NULL;
    PRINT '✅ PasswordRevertExpires adicionado!';
END
ELSE
BEGIN
    PRINT '✓ PasswordRevertExpires já existe';
END

-- 3. LastPasswordChange
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'LastPasswordChange'
)
BEGIN
    PRINT '➕ Adicionando LastPasswordChange...';
    ALTER TABLE [dbo].[Users] ADD [LastPasswordChange] DATETIME NULL;
    PRINT '✅ LastPasswordChange adicionado!';
END
ELSE
BEGIN
    PRINT '✓ LastPasswordChange já existe';
END

PRINT '';
PRINT '========================================';
PRINT '🎉 Campos adicionados com sucesso!';
PRINT '========================================';
PRINT '';

-- Verificar
SELECT 
    COLUMN_NAME as 'Campo Adicionado',
    DATA_TYPE as 'Tipo'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
AND COLUMN_NAME IN ('PasswordRevertToken', 'PasswordRevertExpires', 'LastPasswordChange')
ORDER BY COLUMN_NAME;

GO

