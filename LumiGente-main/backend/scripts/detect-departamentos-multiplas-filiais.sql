-- ================================================================================
-- Script SQL: Detectar departamentos que existem em mais de uma filial
-- Consulta apenas a tabela Users
-- ================================================================================

-- Versão 1: Resultado resumido (departamentos em múltiplas filiais)
SELECT 
    UPPER(LTRIM(RTRIM(DescricaoDepartamento))) AS Departamento,
    COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) AS QtdFiliais
FROM Users
WHERE DescricaoDepartamento IS NOT NULL 
  AND LTRIM(RTRIM(DescricaoDepartamento)) <> ''
  AND (Unidade IS NOT NULL OR Filial IS NOT NULL)
GROUP BY UPPER(LTRIM(RTRIM(DescricaoDepartamento)))
HAVING COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) > 1
ORDER BY QtdFiliais DESC, Departamento;

-- ================================================================================
-- Versão 2: Resultado com contagem de usuários por departamento/filial
-- ================================================================================

SELECT 
    UPPER(LTRIM(RTRIM(DescricaoDepartamento))) AS Departamento,
    UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial)))) AS Filial,
    COUNT(*) AS QtdUsuarios
FROM Users
WHERE DescricaoDepartamento IS NOT NULL 
  AND LTRIM(RTRIM(DescricaoDepartamento)) <> ''
  AND (Unidade IS NOT NULL OR Filial IS NOT NULL)
  AND UPPER(LTRIM(RTRIM(DescricaoDepartamento))) IN (
      -- Subquery: departamentos que aparecem em mais de uma filial
      SELECT UPPER(LTRIM(RTRIM(DescricaoDepartamento)))
      FROM Users
      WHERE DescricaoDepartamento IS NOT NULL 
        AND LTRIM(RTRIM(DescricaoDepartamento)) <> ''
        AND (Unidade IS NOT NULL OR Filial IS NOT NULL)
      GROUP BY UPPER(LTRIM(RTRIM(DescricaoDepartamento)))
      HAVING COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) > 1
  )
GROUP BY 
    UPPER(LTRIM(RTRIM(DescricaoDepartamento))),
    UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))
ORDER BY 
    Departamento, 
    Filial;

-- ================================================================================
-- Versão 3: Resumo executivo (apenas contadores)
-- ================================================================================

SELECT 
    COUNT(DISTINCT UPPER(LTRIM(RTRIM(DescricaoDepartamento)))) AS TotalDepartamentosMultiplasFiliais,
    SUM(QtdFiliais) AS TotalOcorrencias
FROM (
    SELECT 
        UPPER(LTRIM(RTRIM(DescricaoDepartamento))) AS Departamento,
        COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) AS QtdFiliais
    FROM Users
    WHERE DescricaoDepartamento IS NOT NULL 
      AND LTRIM(RTRIM(DescricaoDepartamento)) <> ''
      AND (Unidade IS NOT NULL OR Filial IS NOT NULL)
    GROUP BY UPPER(LTRIM(RTRIM(DescricaoDepartamento)))
    HAVING COUNT(DISTINCT UPPER(LTRIM(RTRIM(COALESCE(Unidade, Filial))))) > 1
) AS Resumo;
