# 🔍 Verificação de Estrutura - Sistema de Troca de Senha

## 📊 Status Atual do Banco de Dados

### ✅ Campos que JÁ EXISTEM (6 de 9)

Baseado na consulta fornecida da tabela `[LUMICENTER_FEEDBACKS].[dbo].[Users]`:

```sql
-- ✅ SISTEMA DE SENHA EXISTENTE
[PasswordHash]                    -- Hash da senha atual (bcrypt)
[PreviousPasswordHash]            -- Hash da senha anterior (para reversão)
[PendingPasswordHash]             -- Hash da nova senha aguardando confirmação

-- ✅ TOKENS DE TROCA EXISTENTES  
[PasswordChangeToken]             -- Token JWT para verificar troca (2 min)
[PasswordChangeExpires]           -- Data de expiração do token de verificação

-- ✅ TOKENS DE CANCELAMENTO EXISTENTES
[PasswordChangeCancelToken]       -- Token JWT para cancelar antes da confirmação (2 min)
[PasswordChangeCancelExpires]     -- Data de expiração do token de cancelamento
```

### 🆕 Campos que PRECISAM SER ADICIONADOS (3 novos)

```sql
-- 🆕 SISTEMA DE REVERSÃO (NOVO)
[PasswordRevertToken]             -- Token JWT para reverter APÓS confirmação (7 dias)
[PasswordRevertExpires]           -- Data de expiração do token de reversão

-- 🆕 AUDITORIA (NOVO)
[LastPasswordChange]              -- Data/hora da última alteração de senha
```

---

## 🎯 Compatibilidade do Código

### ✅ Código COMPATÍVEL com Campos Existentes

O código implementado nos controllers já usa corretamente os campos existentes:

#### 1. **initiatePasswordChange()** - Solicitar Troca
```javascript
// ✅ USA CAMPOS EXISTENTES
UPDATE Users 
SET PendingPasswordHash = @pendingHash,           -- ✅ Existe
    PasswordChangeToken = @token,                 -- ✅ Existe
    PasswordChangeExpires = @expiresAt,           -- ✅ Existe
    PasswordChangeCancelToken = @cancelToken,     -- ✅ Existe
    PasswordChangeCancelExpires = @cancelExpires  -- ✅ Existe
```

#### 2. **verifyPasswordChange()** - Confirmar Troca
```javascript
// ✅ USA CAMPOS EXISTENTES + NOVOS
UPDATE Users 
SET PreviousPasswordHash = PasswordHash,          -- ✅ Existe
    PasswordHash = PendingPasswordHash,           -- ✅ Existe
    PendingPasswordHash = NULL,                   -- ✅ Existe
    PasswordChangeToken = NULL,                   -- ✅ Existe
    PasswordChangeExpires = NULL,                 -- ✅ Existe
    PasswordChangeCancelToken = NULL,             -- ✅ Existe
    PasswordChangeCancelExpires = NULL,           -- ✅ Existe
    PasswordRevertToken = @revertToken,           -- 🆕 NOVO
    PasswordRevertExpires = @revertExpires,       -- 🆕 NOVO
    LastPasswordChange = GETDATE()                -- 🆕 NOVO
```

#### 3. **revertPasswordChange()** - Reverter Troca
```javascript
// ✅ USA CAMPOS EXISTENTES + NOVOS
SELECT Id, PreviousPasswordHash,                  -- ✅ Existe
       PasswordRevertToken,                       -- 🆕 NOVO
       PasswordRevertExpires,                     -- 🆕 NOVO
       NomeCompleto
FROM Users 

UPDATE Users 
SET PasswordHash = @previousHash,                 -- ✅ Existe
    PreviousPasswordHash = NULL,                  -- ✅ Existe
    PasswordRevertToken = NULL,                   -- 🆕 NOVO
    PasswordRevertExpires = NULL,                 -- 🆕 NOVO
    LastPasswordChange = GETDATE()                -- 🆕 NOVO
```

#### 4. **cancelPasswordChange()** - Cancelar Antes da Confirmação
```javascript
// ✅ USA APENAS CAMPOS EXISTENTES
UPDATE Users 
SET PendingPasswordHash = NULL,                   -- ✅ Existe
    PasswordChangeToken = @invalidToken,          -- ✅ Existe
    PasswordChangeExpires = DATEADD(...),         -- ✅ Existe
    PasswordChangeCancelToken = NULL,             -- ✅ Existe
    PasswordChangeCancelExpires = NULL            -- ✅ Existe
```

---

## 🚀 Plano de Implementação

### Passo 1: Executar Script SQL ✅

Execute o script simplificado que adiciona APENAS os 3 campos novos:

```bash
# Windows
sqlcmd -S seu_servidor -d LUMICENTER_FEEDBACKS -i backend/scripts/add_password_revert_fields_minimal.sql

# Ou no SQL Server Management Studio (SSMS)
# Abra o arquivo add_password_revert_fields_minimal.sql e execute
```

**O que o script faz:**
- ✅ Verifica se os campos já existem (não duplica)
- ✅ Adiciona apenas: `PasswordRevertToken`, `PasswordRevertExpires`, `LastPasswordChange`
- ✅ Cria índices para performance
- ✅ Valida a estrutura final
- ✅ Faz COMMIT apenas se tudo estiver OK

### Passo 2: Configurar Variáveis de Ambiente (Opcional)

Adicione no seu `.env` (se ainda não existir):

```env
# Tempo de reversão (padrão: 7 dias)
JWT_PASSWORD_REVERT_EXPIRES_IN=7d

# URL base (já deve existir)
APP_BASE_URL=http://seu-dominio.com
```

### Passo 3: Reiniciar Servidor

```bash
npm restart
```

---

## 🧪 Script de Teste/Verificação

Execute este script SQL para verificar se tudo está correto:

```sql
-- =====================================================
-- SCRIPT DE VERIFICAÇÃO
-- =====================================================
USE [LUMICENTER_FEEDBACKS];
GO

PRINT '🔍 VERIFICANDO ESTRUTURA DA TABELA USERS';
PRINT '==========================================';
PRINT '';

-- Verificar campos de senha
SELECT 
    COLUMN_NAME as 'Campo',
    DATA_TYPE as 'Tipo',
    CHARACTER_MAXIMUM_LENGTH as 'Tamanho',
    IS_NULLABLE as 'Nulo?',
    CASE 
        WHEN COLUMN_NAME IN ('PasswordRevertToken', 'PasswordRevertExpires', 'LastPasswordChange')
        THEN '🆕 NOVO'
        ELSE '✅ EXISTENTE'
    END as 'Status'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
AND TABLE_SCHEMA = 'dbo'
AND COLUMN_NAME IN (
    'PasswordHash',
    'PreviousPasswordHash',
    'PendingPasswordHash',
    'PasswordChangeToken',
    'PasswordChangeExpires',
    'PasswordChangeCancelToken',
    'PasswordChangeCancelExpires',
    'PasswordRevertToken',
    'PasswordRevertExpires',
    'LastPasswordChange'
)
ORDER BY COLUMN_NAME;

PRINT '';
PRINT '==========================================';

-- Contar campos
DECLARE @Total INT, @Novos INT, @Existentes INT;

SELECT @Total = COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
AND TABLE_SCHEMA = 'dbo'
AND COLUMN_NAME IN (
    'PasswordHash', 'PreviousPasswordHash', 'PendingPasswordHash',
    'PasswordChangeToken', 'PasswordChangeExpires',
    'PasswordChangeCancelToken', 'PasswordChangeCancelExpires',
    'PasswordRevertToken', 'PasswordRevertExpires', 'LastPasswordChange'
);

SELECT @Novos = COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
AND TABLE_SCHEMA = 'dbo'
AND COLUMN_NAME IN ('PasswordRevertToken', 'PasswordRevertExpires', 'LastPasswordChange');

SET @Existentes = @Total - @Novos;

PRINT '';
PRINT '📊 RESUMO:';
PRINT '   Total de campos: ' + CAST(@Total AS VARCHAR) + '/10';
PRINT '   Campos existentes: ' + CAST(@Existentes AS VARCHAR);
PRINT '   Campos novos: ' + CAST(@Novos AS VARCHAR);
PRINT '';

IF @Total = 10
BEGIN
    PRINT '✅ ESTRUTURA COMPLETA E PRONTA!';
    PRINT '   O sistema de reversão de senha pode ser usado.';
END
ELSE
BEGIN
    PRINT '⚠️ ESTRUTURA INCOMPLETA!';
    PRINT '   Execute o script: add_password_revert_fields_minimal.sql';
END

PRINT '';
PRINT '==========================================';
GO

-- Verificar índices
SELECT 
    i.name as 'Índice',
    i.type_desc as 'Tipo',
    CASE 
        WHEN i.name = 'IX_Users_PasswordRevertToken' THEN '🆕 NOVO'
        WHEN i.name = 'IX_Users_PasswordChangeCancelToken' THEN '🆕 NOVO'
        ELSE '✅ EXISTENTE'
    END as 'Status'
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.Users')
AND i.name IN ('IX_Users_PasswordRevertToken', 'IX_Users_PasswordChangeCancelToken');

PRINT '';
PRINT '🎉 Verificação concluída!';
GO
```

---

## 📋 Checklist de Implementação

### Antes de Executar o Script
- [ ] Fazer backup do banco de dados
- [ ] Verificar conexão com o banco
- [ ] Confirmar nome correto do database: `LUMICENTER_FEEDBACKS`
- [ ] Ter permissões de ALTER TABLE

### Durante a Execução
- [ ] Executar script: `add_password_revert_fields_minimal.sql`
- [ ] Verificar mensagens de sucesso no output
- [ ] Confirmar que transação foi commitada
- [ ] Executar script de verificação

### Após a Execução
- [ ] Verificar que 3 novos campos foram criados
- [ ] Verificar que 2 índices foram criados
- [ ] Testar query de verificação
- [ ] Adicionar variáveis no `.env`
- [ ] Reiniciar servidor backend
- [ ] Testar fluxo completo de troca de senha

---

## ⚠️ Pontos de Atenção

### 1. Campos com Nome Similar
```sql
-- ✅ CORRETO - Usado no código
PasswordRevertToken         -- Para REVERTER após confirmação

-- ✅ DIFERENTE - Também existe
PasswordChangeCancelToken   -- Para CANCELAR antes da confirmação
```

### 2. Diferença entre Cancelar e Reverter

| Ação | Timing | Campo Usado | Prazo |
|------|--------|-------------|-------|
| **Cancelar** | ANTES da confirmação | `PasswordChangeCancelToken` | 2 minutos |
| **Reverter** | DEPOIS da confirmação | `PasswordRevertToken` | 7 dias |

### 3. Fluxo de Dados

```
1. Solicitar Troca
   PasswordHash (atual) → permanece
   PendingPasswordHash ← nova senha
   PasswordChangeCancelToken ← gerado (2 min)

2. Confirmar Troca
   PreviousPasswordHash ← PasswordHash (backup)
   PasswordHash ← PendingPasswordHash (aplica nova)
   PendingPasswordHash ← NULL
   PasswordRevertToken ← gerado (7 dias)
   LastPasswordChange ← GETDATE()

3. Reverter (opcional, até 7 dias)
   PasswordHash ← PreviousPasswordHash (restaura)
   PreviousPasswordHash ← NULL
   PasswordRevertToken ← NULL
   LastPasswordChange ← GETDATE()
```

---

## 🎯 Status Final Esperado

Após executar o script, a tabela Users terá:

```sql
-- ESTRUTURA COMPLETA (10 campos de senha)
✅ PasswordHash                    -- Existente
✅ PreviousPasswordHash            -- Existente
✅ PendingPasswordHash             -- Existente
✅ PasswordChangeToken             -- Existente
✅ PasswordChangeExpires           -- Existente
✅ PasswordChangeCancelToken       -- Existente
✅ PasswordChangeCancelExpires     -- Existente
🆕 PasswordRevertToken             -- NOVO
🆕 PasswordRevertExpires           -- NOVO
🆕 LastPasswordChange              -- NOVO

-- ÍNDICES (2 novos)
🆕 IX_Users_PasswordRevertToken
🆕 IX_Users_PasswordChangeCancelToken
```

---

## 📞 Troubleshooting

### Problema: Script falha ao executar
**Solução:**
1. Verifique permissões no banco
2. Confirme nome do database
3. Execute manualmente cada seção do script

### Problema: Campos já existem
**Solução:**
- Script já verifica automaticamente
- Não duplicará campos existentes
- Apenas adicionará os que faltam

### Problema: Erro no código após adicionar campos
**Solução:**
- Reinicie o servidor Node.js
- Limpe cache do pool de conexões
- Verifique logs do backend

---

## ✅ Conclusão

**Resumo da Situação:**
- 📊 Você já tem 67% da estrutura implementada (6 de 9 campos)
- 🆕 Precisa adicionar apenas 3 campos novos
- ✅ O código está 100% compatível com a estrutura existente
- ✅ Script SQL está seguro e não duplica campos
- 🚀 Após executar o script, tudo estará pronto!

**Próximos Passos:**
1. Execute `add_password_revert_fields_minimal.sql`
2. Execute script de verificação
3. Reinicie o servidor
4. Teste o fluxo completo

---

**Documentação Completa:**
- 📖 Sistema Completo: `SISTEMA_TROCA_REVERSAO_SENHA.md`
- 🚀 Guia Rápido: `GUIA_RAPIDO_TROCA_SENHA.md`
- 🔍 Esta Verificação: `VERIFICACAO_ESTRUTURA_SENHA.md`

**Data da Verificação:** 05/11/2025

