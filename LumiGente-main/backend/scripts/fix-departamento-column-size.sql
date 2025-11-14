-- ================================================================================
-- Script SQL: Aumentar tamanho da coluna departamento_codigo
-- ================================================================================

-- Verificar tamanho atual
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'SurveyDepartamentoFilters'
  AND COLUMN_NAME IN ('departamento_codigo', 'Departamento');

-- Aumentar tamanho das colunas
ALTER TABLE SurveyDepartamentoFilters 
ALTER COLUMN departamento_codigo NVARCHAR(200);

ALTER TABLE SurveyDepartamentoFilters 
ALTER COLUMN Departamento NVARCHAR(200);

PRINT '✅ Colunas atualizadas com sucesso!';

-- Verificar novo tamanho
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'SurveyDepartamentoFilters'
  AND COLUMN_NAME IN ('departamento_codigo', 'Departamento');
