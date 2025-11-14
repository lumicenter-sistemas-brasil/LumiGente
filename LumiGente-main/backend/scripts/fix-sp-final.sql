-- ================================================================================
-- Script SQL: SP Corrigida e Funcional
-- ================================================================================

DROP PROCEDURE IF EXISTS sp_CalculateSurveyEligibleUsers;
GO

CREATE PROCEDURE sp_CalculateSurveyEligibleUsers
    @survey_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DELETE FROM SurveyEligibleUsers WHERE survey_id = @survey_id;
    
    DECLARE @hasFilial INT;
    DECLARE @hasDept INT;
    
    SELECT @hasFilial = COUNT(*) FROM SurveyFilialFilters WHERE survey_id = @survey_id;
    SELECT @hasDept = COUNT(*) FROM SurveyDepartamentoFilters WHERE survey_id = @survey_id;
    
    -- Caso 1: Filtro de departamento
    IF @hasDept > 0 AND @hasFilial = 0
    BEGIN
        INSERT INTO SurveyEligibleUsers (survey_id, user_id)
        SELECT @survey_id, u.Id
        FROM Users u
        INNER JOIN SurveyDepartamentoFilters sdf ON sdf.survey_id = @survey_id
        WHERE u.IsActive = 1
          AND LTRIM(RTRIM(u.DepartamentoUnico)) = LTRIM(RTRIM(sdf.departamento_codigo));
    END
    -- Caso 2: Filtro de filial
    ELSE IF @hasFilial > 0 AND @hasDept = 0
    BEGIN
        INSERT INTO SurveyEligibleUsers (survey_id, user_id)
        SELECT @survey_id, u.Id
        FROM Users u
        INNER JOIN SurveyFilialFilters sff ON sff.survey_id = @survey_id
        WHERE u.IsActive = 1
          AND LTRIM(RTRIM(COALESCE(u.Unidade, u.Filial))) = LTRIM(RTRIM(COALESCE(sff.Unidade, sff.filial_codigo)));
    END
    -- Caso 3: Sem filtros
    ELSE
    BEGIN
        INSERT INTO SurveyEligibleUsers (survey_id, user_id)
        SELECT @survey_id, Id
        FROM Users
        WHERE IsActive = 1;
    END
END;
GO

PRINT '✅ SP Corrigida e Funcional!';
