# Análise: Deletar Todas as Tabelas e Reiniciar o Sistema

## ⚠️ Resposta Direta

**SIM, o sistema funcionará corretamente** se você deletar apenas os **dados** (DELETE FROM) mantendo as **estruturas** das tabelas, **APÓS** as correções implementadas nos problemas 1 e 2.

---

## 🔴 Problemas Críticos Identificados (2 corrigidos, 3 não são problemas)

### 1. **Tabela `TiposAvaliacao` - Dados Padrão Não Serão Inseridos** ✅ CORRIGIDO

**Problema**: O código verifica se a tabela existe, mas **NÃO verifica se está vazia**. Se a tabela existir mas estiver vazia, os 2 registros padrão (45 dias e 90 dias) **NÃO serão inseridos**.

**Código problemático** (anterior):
```sql
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TiposAvaliacao')
BEGIN
    -- Cria e insere dados
END
ELSE
BEGIN
    -- Apenas loga que existe, mas não verifica se está vazia!
END
```

**Impacto**: Sistema de avaliações não funcionará, pois não haverá tipos de avaliação disponíveis.

**Solução implementada**: 
- ✅ Adicionada verificação se a tabela está vazia após verificar existência
- ✅ Se vazia, insere os 2 registros padrão (45 dias e 90 dias)
- ✅ Suporta estrutura completa (com DiasMinimos/DiasMaximos) e estrutura antiga
- ✅ Logs informativos para cada cenário

---

### 2. **Tabela `Roles` - Dados Essenciais Perdidos** ✅ CORRIGIDO

**Problema**: A tabela `Roles` tem 3 registros padrão que são essenciais para o sistema. Se deletados, usuários não terão roles válidas.

**Impacto**: 
- Usuários podem não conseguir fazer login
- Sistema de permissões pode quebrar
- Foreign keys podem falhar

**Solução implementada**: 
- ✅ Criado `rolesSetup.js` para verificar e garantir roles padrão
- ✅ Verifica se a tabela existe, se não existe cria com estrutura
- ✅ Verifica se está vazia e insere os 3 roles padrão se necessário
- ✅ Verifica se roles essenciais existem e insere faltantes

#### 2.1. **Problema do IDENTITY - IDs Não Resettam** ✅ CORRIGIDO

**Problema adicional identificado**: Quando você deleta os dados da tabela `Roles` e ela é repopulada, o IDENTITY não reseta. Os novos registros começam do ID onde parou (ex: 4, 5, 6 ao invés de 1, 2, 3).

**Impacto**: 
- Código que usa `RoleId = 2` hardcoded falha, pois o role 'public' agora tem ID 5
- Verificações como `user.RoleId === 1 || user.RoleId === 2` não funcionam mais

**Solução implementada**: 
- ✅ Criada função `getRoleIdByName()` em `rolesSetup.js` para buscar IDs dinamicamente pelo nome
- ✅ Atualizado `externalUserController.js` para buscar RoleId dinamicamente ao criar usuários externos
- ✅ Atualizado `routes/index.js` para verificar roles dinamicamente ao invés de usar IDs hardcoded
- ✅ Sistema agora funciona independente dos IDs dos roles (1,2,3 ou 4,5,6)

**Script opcional**: Criado `scripts/reset-roles-identity.js` para resetar o IDENTITY caso você queira que os IDs comecem do 1 novamente (não é necessário, pois a solução dinâmica já resolve o problema).
- ✅ Integrado na inicialização do servidor (antes das tabelas de avaliações)
- ✅ Roles padrão: `admin` (Administrador), `public` (Usuário comum), `manager` (Gestor)

---

### 3. **Foreign Keys Dependem de Tabelas Existentes** ✅ NÃO É PROBLEMA

**Contexto**: Se você deletar apenas os **dados** (DELETE FROM) mantendo as **estruturas** das tabelas (não fazer DROP TABLE), as foreign keys continuarão existindo.

**Tabelas que dependem de `Users`**:
- `Avaliacoes` - FK para `Users(Id)`
- `RespostasAvaliacoes` - FK para `Users(Id)`
- `Notifications` - FK para `Users(Id)`
- `ChatMessages` - FK para `Users(Id)`
- E muitas outras...

**Tabelas que dependem de outras tabelas**:
- `SurveyNotificationLog` - FK para `Surveys(Id)`
- `ChatMessages` - FK para `Feedbacks(Id)`

**Análise**: 
- ✅ **Não é problema crítico** se apenas dados forem deletados (estruturas mantidas)
- ✅ Foreign keys vazias não causam problemas - apenas impedem inserção de dados inválidos
- ✅ O sistema popula tabelas na ordem correta:
  1. `Users` é populada primeiro pelo sincronizador (na inicialização)
  2. Depois outras tabelas são populadas conforme uso
  3. Foreign keys garantem integridade, não bloqueiam funcionamento inicial
- ⚠️ **Único cuidado**: Não tentar criar registros que referenciam IDs inexistentes antes das tabelas serem populadas

**Conclusão**: Este não é um problema se você mantiver as estruturas das tabelas. O sistema funcionará normalmente após a sincronização inicial de `Users`.

---

### 4. **Sincronizador Precisa de `TAB_HIST_SRA`** ✅ NÃO É PROBLEMA

**Descoberta**: A tabela `TAB_HIST_SRA` é populada automaticamente por um **SQL Server Agent Job**.

**Como funciona**:
- ✅ **Job ativo**: `TAB_HIST_SRA` (SQL Server Agent Job)
- ✅ **Frequência**: Executa **diariamente às 00:04:00**
- ✅ **Processo**: 
  1. Faz `DROP TABLE IF EXISTS [TAB_HIST_SRA]`
  2. Executa `SELECT * INTO TAB_HIST_SRA` de um linked server Oracle (`ORACLE_PROD_SJP`)
  3. Busca dados da tabela `SRA010` do Oracle (sistema de RH)
- ✅ **Fonte**: Linked Server `ORACLE_PROD_SJP` → Tabela `SRA010` (Oracle)

**Análise**:
- ✅ Se você deletar os dados (`DELETE FROM TAB_HIST_SRA`), o job vai **repovoar automaticamente** no próximo ciclo (meia-noite)
- ✅ Se você deletar a tabela (`DROP TABLE TAB_HIST_SRA`), o job vai **recriar e popular** no próximo ciclo
- ✅ O job está **ATIVO** e executando com sucesso diariamente
- ✅ Histórico mostra execuções bem-sucedidas todos os dias

**Impacto**: 
- ⚠️ Se você deletar os dados **antes** do próximo ciclo do job (meia-noite), o sincronizador não terá dados temporariamente
- ✅ Mas o job vai repovoar automaticamente na próxima execução
- ✅ Sistema funcionará normalmente após o job executar

**Conclusão**: 
- ✅ **Não é problema crítico** - o job repopula automaticamente
- ⚠️ **Recomendação**: Se deletar dados, aguardar até 00:04:00 do dia seguinte OU executar o job manualmente

---

### 5. **Tabelas Criadas Sob Demanda Podem Falhar** ✅ NÃO É PROBLEMA

**Contexto**: Se você deletar apenas os **dados** (DELETE FROM) mantendo as **estruturas** das tabelas, não haverá problemas.

**Tabelas que são criadas no primeiro uso**:
- `Notifications` - Criada no primeiro uso de notificações
- `Objetivos`, `ObjetivoCheckins`, `ObjetivoResponsaveis` - Criadas no primeiro uso de objetivos

**Análise**: 
- ✅ **Não é problema crítico** se apenas dados forem deletados (estruturas mantidas)
- ✅ O código verifica se a tabela existe antes de criar (`IF NOT EXISTS`)
- ✅ Se a estrutura já existir, o código não tenta recriar
- ✅ Foreign keys vazias não causam problemas - apenas garantem integridade quando há dados
- ✅ As tabelas serão populadas normalmente quando o sistema precisar usar essas funcionalidades

**Conclusão**: Este não é um problema se você mantiver as estruturas das tabelas. O sistema funcionará normalmente, criando dados conforme necessário.

---

## ✅ O Que Funcionará Corretamente

1. **Tabelas criadas automaticamente na inicialização**:
   - `Avaliacoes` - Será criada se não existir
   - `PerguntasAvaliacao` - Será criada se não existir
   - `OpcoesPerguntasAvaliacao` - Será criada se não existir
   - `RespostasAvaliacoes` - Será criada se não existir
   - `SurveyNotificationLog` - Será criada se não existir

2. **Sincronizador de usuários**:
   - Funcionará se `TAB_HIST_SRA` tiver dados
   - Criará usuários automaticamente na primeira execução

3. **Jobs agendados**:
   - Continuarão funcionando normalmente

---

## 🔧 Soluções Necessárias

### Solução 1: Corrigir `TiposAvaliacao` ✅ IMPLEMENTADA

**Status**: ✅ Corrigido em `avaliacoesSetup.js`

**Implementação**:
- Verifica se a tabela existe
- Se não existe, cria com estrutura completa e insere dados padrão
- Se existe, verifica se está vazia e insere dados padrão se necessário
- Suporta estrutura completa (DiasMinimos/DiasMaximos) e estrutura antiga
- Logs informativos para cada cenário

**Código implementado**:
```javascript
// Verifica existência da tabela
const tiposTableCheck = await pool.request().query(`
    SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TiposAvaliacao'
`);

if (tiposTableCheck.recordset[0].existe === 0) {
    // Criar tabela e inserir dados
} else {
    // Verificar se está vazia
    const tiposCountCheck = await pool.request().query(`
        SELECT COUNT(*) as total FROM TiposAvaliacao
    `);
    
    if (tiposCountCheck.recordset[0].total === 0) {
        // Inserir dados padrão
    }
}
```

### Solução 2: Criar Script de Seed para Roles ✅ IMPLEMENTADA

**Status**: ✅ Corrigido em `rolesSetup.js` e integrado em `server.js`

**Implementação**:
- Criado arquivo `services/rolesSetup.js` com função `ensureRolesExist()`
- Verifica se a tabela existe, se não existe cria com estrutura completa
- Verifica se está vazia e insere os 3 roles padrão se necessário
- Verifica se roles essenciais existem e insere apenas os faltantes
- Integrado na inicialização do servidor (executado antes das tabelas de avaliações)
- Logs informativos para cada cenário

**Roles padrão inseridos**:
1. `admin` - Administrador do sistema (Id: 1)
2. `public` - Usuário comum (Id: 2)
3. `manager` - Gestor (Id: 3)

**Código implementado**:
```javascript
// Verifica existência da tabela
const rolesTableCheck = await pool.request().query(`
    SELECT COUNT(*) as existe FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Roles'
`);

if (rolesTableCheck.recordset[0].existe === 0) {
    // Criar tabela e inserir dados
} else {
    // Verificar se está vazia ou se faltam roles essenciais
    const rolesCountCheck = await pool.request().query(`
        SELECT COUNT(*) as total FROM Roles
    `);
    
    if (rolesCountCheck.recordset[0].total === 0) {
        // Inserir todos os roles padrão
    } else {
        // Verificar e inserir apenas roles faltantes
    }
}
```

### Solução 3: Garantir Estrutura das Tabelas

**IMPORTANTE**: Se você deletar dados, **NÃO delete as estruturas das tabelas**. Use `DELETE FROM` e não `DROP TABLE`.

---

## 📋 Checklist para Reset Completo

Se você realmente quiser fazer um reset completo:

1. ✅ **Manter estruturas das tabelas** (não fazer DROP TABLE)
2. ✅ **Deletar apenas dados** (DELETE FROM)
3. ✅ **Garantir que `TAB_HIST_SRA` tenha dados** (fonte externa)
4. ✅ **Corrigir código para verificar `TiposAvaliacao` vazia** ✅ **IMPLEMENTADO**
5. ✅ **Criar script de seed para `Roles`** ✅ **IMPLEMENTADO**
6. ✅ **Reiniciar o sistema**
7. ✅ **Aguardar sincronizador popular `Users`**
8. ✅ **Verificar se `TiposAvaliacao` tem os 2 registros padrão** (agora automático)

---

## 🎯 Conclusão

**✅ O sistema funcionará corretamente após deletar todos os dados (mantendo estruturas) porque:**

1. ✅ **Correção implementada**: `TiposAvaliacao` verifica se está vazia e insere dados padrão
2. ✅ **Correção implementada**: `Roles` verifica se está vazia e insere os 3 roles padrão
3. ✅ **Não é problema**: Foreign keys não causam problemas se estruturas forem mantidas
4. ✅ **Não é problema**: `TAB_HIST_SRA` é repopulada automaticamente pelo job diário (às 00:04:00)
5. ✅ **Não é problema**: Tabelas criadas sob demanda funcionam normalmente se estruturas forem mantidas
6. ✅ **Sincronizador**: Popula `Users` automaticamente na inicialização (após `TAB_HIST_SRA` ser repopulada)
7. ✅ **Estruturas mantidas**: Todas as constraints e foreign keys continuam funcionando normalmente

**⚠️ Requisitos:**
- Manter estruturas das tabelas (não fazer DROP TABLE, apenas DELETE FROM)
- `TAB_HIST_SRA` será repopulada automaticamente pelo job diário (às 00:04:00)
- Se deletar dados de `TAB_HIST_SRA`, aguardar próximo ciclo do job OU executar manualmente
- Reiniciar o sistema após deletar dados

**✅ Com as correções implementadas, o sistema está pronto para reset completo de dados.**

