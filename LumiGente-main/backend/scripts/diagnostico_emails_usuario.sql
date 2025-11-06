-- =====================================================
-- SCRIPT DE DIAGNÓSTICO - EMAILS DE USUÁRIOS
-- =====================================================
-- Verifica se os usuários têm emails cadastrados
-- para receber alertas de troca de senha
-- =====================================================

USE [LUMICENTER_FEEDBACKS];
GO

PRINT '========================================';
PRINT 'DIAGNÓSTICO DE EMAILS - Sistema de Senha';
PRINT '========================================';
PRINT '';

-- 1. Estatísticas gerais
PRINT '📊 ESTATÍSTICAS GERAIS:';
PRINT '----------------------------------------';

DECLARE @TotalUsuarios INT, @ComEmail INT, @ComPreviousEmail INT, @ComAmbos INT, @SemEmail INT;

SELECT @TotalUsuarios = COUNT(*) FROM Users WHERE IsActive = 1;
SELECT @ComEmail = COUNT(*) FROM Users WHERE IsActive = 1 AND Email IS NOT NULL AND Email != '';
SELECT @ComPreviousEmail = COUNT(*) FROM Users WHERE IsActive = 1 AND PreviousEmail IS NOT NULL AND PreviousEmail != '';
SELECT @ComAmbos = COUNT(*) FROM Users WHERE IsActive = 1 AND Email IS NOT NULL AND Email != '' AND PreviousEmail IS NOT NULL AND PreviousEmail != '';
SELECT @SemEmail = COUNT(*) FROM Users WHERE IsActive = 1 AND (Email IS NULL OR Email = '');

PRINT 'Total de usuários ativos: ' + CAST(@TotalUsuarios AS VARCHAR);
PRINT 'Com Email (atual): ' + CAST(@ComEmail AS VARCHAR) + ' (' + CAST((@ComEmail * 100 / NULLIF(@TotalUsuarios, 0)) AS VARCHAR) + '%)';
PRINT 'Com PreviousEmail: ' + CAST(@ComPreviousEmail AS VARCHAR) + ' (' + CAST((@ComPreviousEmail * 100 / NULLIF(@TotalUsuarios, 0)) AS VARCHAR) + '%)';
PRINT 'Com AMBOS emails: ' + CAST(@ComAmbos AS VARCHAR) + ' (' + CAST((@ComAmbos * 100 / NULLIF(@TotalUsuarios, 0)) AS VARCHAR) + '%)';
PRINT 'Sem email cadastrado: ' + CAST(@SemEmail AS VARCHAR) + ' (' + CAST((@SemEmail * 100 / NULLIF(@TotalUsuarios, 0)) AS VARCHAR) + '%)';

PRINT '';
PRINT '----------------------------------------';
PRINT '';

-- 2. Listagem de usuários por categoria
PRINT '📋 CATEGORIAS DE USUÁRIOS:';
PRINT '----------------------------------------';
PRINT '';

-- Usuários com AMBOS emails (ideal para sistema de reversão)
PRINT '✅ IDEAL - Usuários com Email E PreviousEmail:';
SELECT TOP 10
    Id,
    NomeCompleto,
    Email,
    PreviousEmail,
    LastLogin
FROM Users
WHERE IsActive = 1
AND Email IS NOT NULL AND Email != ''
AND PreviousEmail IS NOT NULL AND PreviousEmail != ''
ORDER BY LastLogin DESC;

PRINT '';

-- Usuários com apenas Email atual (receberão apenas 1 alerta)
PRINT '⚠️ PARCIAL - Usuários com Email mas SEM PreviousEmail:';
SELECT TOP 10
    Id,
    NomeCompleto,
    Email,
    PreviousEmail,
    LastLogin
FROM Users
WHERE IsActive = 1
AND Email IS NOT NULL AND Email != ''
AND (PreviousEmail IS NULL OR PreviousEmail = '')
ORDER BY LastLogin DESC;

PRINT '';

-- Usuários sem Email atual (NÃO podem trocar senha)
PRINT '❌ PROBLEMA - Usuários SEM Email (não podem trocar senha):';
SELECT TOP 10
    Id,
    NomeCompleto,
    Email,
    PreviousEmail,
    LastLogin
FROM Users
WHERE IsActive = 1
AND (Email IS NULL OR Email = '')
ORDER BY LastLogin DESC;

PRINT '';
PRINT '----------------------------------------';
PRINT '';

-- 3. Verificar seu próprio usuário (substitua o CPF/Email)
PRINT '🔍 VERIFICAR USUÁRIO ESPECÍFICO:';
PRINT '----------------------------------------';
PRINT 'Execute esta query com SEU CPF ou Email:';
PRINT '';
PRINT 'SELECT ';
PRINT '    Id,';
PRINT '    NomeCompleto,';
PRINT '    Email as ''Email Atual (recebe token)'',';
PRINT '    PreviousEmail as ''Email Anterior (recebe alerta de reversão)'',';
PRINT '    LastPasswordChange as ''Última troca de senha'',';
PRINT '    CASE ';
PRINT '        WHEN Email IS NOT NULL AND PreviousEmail IS NOT NULL THEN ''✅ Receberá 2 alertas''';
PRINT '        WHEN Email IS NOT NULL AND PreviousEmail IS NULL THEN ''⚠️ Receberá apenas 1 alerta''';
PRINT '        ELSE ''❌ NÃO pode trocar senha (sem email)''';
PRINT '    END as Status';
PRINT 'FROM Users';
PRINT 'WHERE CPF = ''000.000.000-00'' -- Substitua pelo seu CPF';
PRINT '   OR Email = ''seu@email.com'' -- Ou pelo seu email';
PRINT '';

-- Exemplo prático (descomente e ajuste)
/*
SELECT 
    Id,
    NomeCompleto,
    Email as 'Email Atual',
    PreviousEmail as 'Email Anterior',
    LastPasswordChange,
    CASE 
        WHEN Email IS NOT NULL AND PreviousEmail IS NOT NULL THEN '✅ Receberá 2 alertas'
        WHEN Email IS NOT NULL AND PreviousEmail IS NULL THEN '⚠️ Receberá apenas 1 alerta'
        ELSE '❌ NÃO pode trocar senha'
    END as Status
FROM Users
WHERE CPF = '123.456.789-00' -- SEU CPF AQUI
   OR Email = 'seu@email.com'; -- OU SEU EMAIL AQUI
*/

PRINT '';
PRINT '========================================';
PRINT '✅ Diagnóstico concluído!';
PRINT '========================================';
PRINT '';
PRINT '💡 DICA:';
PRINT '   - Para receber alertas de reversão em 2 emails,';
PRINT '     o usuário precisa ter Email E PreviousEmail cadastrados.';
PRINT '   - PreviousEmail é preenchido automaticamente quando';
PRINT '     o usuário troca de email (sistema de troca de email).';
PRINT '';

GO

