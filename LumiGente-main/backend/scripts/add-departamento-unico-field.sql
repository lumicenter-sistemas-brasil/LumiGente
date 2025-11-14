-- ================================================================================
-- Script SQL: Adicionar campo DepartamentoUnico na tabela Users
-- Concatena Filial + DescricaoDepartamento para criar identificador único
-- ================================================================================

-- Adicionar coluna computada (atualiza automaticamente)
IF COL_LENGTH('Users', 'DepartamentoUnico') IS NULL
BEGIN
    ALTER TABLE Users ADD DepartamentoUnico AS 
        UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial)))) + ' - ' + 
        UPPER(LTRIM(RTRIM(DescricaoDepartamento))) PERSISTED;
    PRINT 'Coluna DepartamentoUnico adicionada com sucesso!';
END
ELSE
BEGIN
    PRINT 'Coluna DepartamentoUnico já existe.';
END
GO

-- ================================================================================
-- Verificar exemplos de DepartamentoUnico gerados
-- ================================================================================

SELECT TOP 20
    COALESCE(Unidade, Filial) AS Filial,
    DescricaoDepartamento,
    DepartamentoUnico
FROM Users
WHERE DescricaoDepartamento IS NOT NULL
ORDER BY DepartamentoUnico;

-- ================================================================================
-- Estatísticas: Comparar total de departamentos antes e depois
-- ================================================================================

SELECT 
    COUNT(DISTINCT DescricaoDepartamento) AS TotalDescricoesDepartamento,
    COUNT(DISTINCT DepartamentoUnico) AS TotalDepartamentosUnicos,
    COUNT(DISTINCT DepartamentoUnico) - COUNT(DISTINCT DescricaoDepartamento) AS DiferencaAposUnificacao
FROM Users
WHERE DescricaoDepartamento IS NOT NULL;

-- ================================================================================
-- Listar todos os departamentos únicos
-- ================================================================================

SELECT DISTINCT 
    DepartamentoUnico,
    COUNT(*) AS QtdUsuarios
FROM Users
WHERE DepartamentoUnico IS NOT NULL
GROUP BY DepartamentoUnico
ORDER BY DepartamentoUnico;
