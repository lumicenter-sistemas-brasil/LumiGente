# 🔧 Troubleshooting - Email de Reversão de Senha

## ❓ Problema Reportado

**Sintoma:** O email registrado no campo `PreviousEmail` não está recebendo o alerta de reversão após a troca de senha.

---

## 🔍 Causa Raiz

O problema pode ter **3 causas**:

### 1. Campo `PreviousEmail` Vazio/Null ⚠️

O campo `PreviousEmail` só é preenchido quando o usuário **troca de email** usando o sistema de troca de email. Se o usuário **nunca trocou de email**, este campo estará vazio.

```sql
-- Verificar se o campo está preenchido
SELECT 
    NomeCompleto,
    Email,
    PreviousEmail,
    CASE 
        WHEN PreviousEmail IS NULL THEN '❌ Vazio (nunca trocou email)'
        WHEN PreviousEmail = '' THEN '❌ String vazia'
        ELSE '✅ Preenchido'
    END as Status
FROM Users
WHERE Id = SEU_USER_ID;
```

### 2. Promise Não Aguardado ❌ (CORRIGIDO)

O código original não aguardava o envio dos emails antes de retornar a resposta, causando envios assíncronos que falhavam silenciosamente.

**✅ Status:** Corrigido! Agora usa `await Promise.allSettled()`.

### 3. Erro no Envio de Email 📧

Pode haver erro na configuração SMTP ou no serviço de email.

---

## ✅ Solução Implementada

### Código Corrigido

**Arquivo:** `backend/controllers/userController.js`

**Melhorias implementadas:**

1. **Logs detalhados** para debug
2. **Await adequado** no `Promise.allSettled()`
3. **Verificação explícita** se `PreviousEmail` existe
4. **Captura de erros** individual por email

```javascript
// Email atual
if (user.Email) {
    console.log(`📧 Preparando envio para email atual: ${user.Email}`);
    emailPromises.push(...);
} else {
    console.log('⚠️ Email atual não está cadastrado');
}

// Email anterior
if (user.PreviousEmail && user.PreviousEmail !== user.Email) {
    console.log(`📧 Preparando envio para email anterior: ${user.PreviousEmail}`);
    emailPromises.push(...);
} else if (!user.PreviousEmail) {
    console.log('⚠️ PreviousEmail não está cadastrado (campo vazio/null)');
} else if (user.PreviousEmail === user.Email) {
    console.log('⚠️ PreviousEmail é igual ao Email atual (não enviar duplicado)');
}

// AGUARDAR envio
const results = await Promise.allSettled(emailPromises);
console.log('📊 Resultado do envio de emails:', {
    total: results.length,
    enviados: results.filter(r => r.status === 'fulfilled').length,
    falhas: results.filter(r => r.status === 'rejected').length
});
```

---

## 🧪 Como Diagnosticar

### Passo 1: Execute o Script de Diagnóstico

```bash
sqlcmd -S LMC00SV006\dwlumicenter -d LUMICENTER_FEEDBACKS -U sistema_relatorios -P FBXvVX42F -i backend/scripts/diagnostico_emails_usuario.sql
```

**Ou no SSMS:** Abra e execute `backend/scripts/diagnostico_emails_usuario.sql`

### Passo 2: Verifique os Logs do Backend

Após tentar trocar senha, procure nos logs:

```
✅ Senha alterada com sucesso. Enviando emails de confirmação...
📧 Preparando envio para email atual: usuario@email.com
✅ Email de confirmação enviado para email atual: usuario@email.com
⚠️ PreviousEmail não está cadastrado (campo vazio/null)
📊 Resultado do envio de emails: { total: 1, enviados: 1, falhas: 0 }
```

**Se ver:** `⚠️ PreviousEmail não está cadastrado` → Usuário nunca trocou de email

### Passo 3: Verifique Manualmente

```sql
-- Substituir USER_ID pelo ID do usuário
SELECT 
    Id,
    NomeCompleto,
    Email as 'Email Atual (recebe token)',
    PreviousEmail as 'Email Anterior (recebe reversão)',
    LastPasswordChange,
    CASE 
        WHEN Email IS NOT NULL AND PreviousEmail IS NOT NULL 
        THEN '✅ Receberá 2 alertas de reversão'
        WHEN Email IS NOT NULL AND PreviousEmail IS NULL 
        THEN '⚠️ Receberá apenas 1 alerta (no email atual)'
        ELSE '❌ NÃO pode trocar senha (sem email)'
    END as Status
FROM Users
WHERE Id = USER_ID;
```

---

## 📊 Cenários Possíveis

### Cenário 1: ✅ IDEAL - Ambos Emails Cadastrados

```sql
Email:         usuario@novodomain.com
PreviousEmail: usuario@antigodomain.com
```

**Comportamento:**
- ✅ Email atual recebe: Token de verificação
- ✅ Email anterior recebe: Link de cancelamento (antes)
- ✅ Ambos recebem: Link de reversão (após confirmação)

### Cenário 2: ⚠️ PARCIAL - Apenas Email Atual

```sql
Email:         usuario@domain.com
PreviousEmail: NULL
```

**Comportamento:**
- ✅ Email atual recebe: Token de verificação
- ❌ Nenhum email recebe: Link de cancelamento (não tem anterior)
- ✅ Email atual recebe: Link de reversão (após confirmação)

**Solução:** Usuário precisa trocar de email pelo menos uma vez para ter `PreviousEmail`.

### Cenário 3: ❌ PROBLEMA - Sem Email

```sql
Email:         NULL
PreviousEmail: NULL
```

**Comportamento:**
- ❌ Sistema não permite trocar senha
- ❌ Erro: "É necessário ter pelo menos um email cadastrado"

**Solução:** Usuário precisa cadastrar um email primeiro.

---

## 🔧 Como Testar

### 1. Teste com Usuário que TEM `PreviousEmail`

```javascript
// 1. No frontend, faça login com um usuário que tem PreviousEmail
// 2. Vá em Configurações > Segurança
// 3. Solicite troca de senha
// 4. Verifique logs do backend
// 5. Confirme com token
// 6. Verifique se AMBOS emails receberam o alerta de reversão
```

### 2. Teste com Usuário que NÃO TEM `PreviousEmail`

```javascript
// 1. Faça login com usuário sem PreviousEmail
// 2. Solicite troca de senha
// 3. Logs devem mostrar: "⚠️ PreviousEmail não está cadastrado"
// 4. Confirme com token
// 5. Apenas Email atual receberá o alerta de reversão
```

### 3. Criar Cenário Ideal (Trocar Email Primeiro)

```javascript
// Para ter PreviousEmail:
// 1. Cadastre/verifique um email
// 2. Troque para outro email (sistema de troca de email)
// 3. Agora você terá Email (novo) e PreviousEmail (antigo)
// 4. Teste a troca de senha
// 5. Ambos receberão os alertas
```

---

## 💡 Entendimento do Sistema

### Sistema de Email vs Sistema de Senha

| Campo | Sistema | Finalidade |
|-------|---------|------------|
| `Email` | Email | Email atual do usuário |
| `PreviousEmail` | Email | Email anterior (backup após troca) |
| `PasswordHash` | Senha | Senha atual do usuário |
| `PreviousPasswordHash` | Senha | Senha anterior (backup após troca) |

**Importante:** `PreviousEmail` é do **sistema de email**, não de senha!

### Fluxo de Troca de Email

```
1. Usuário tem: Email = "antigo@email.com"
2. Troca para:  Email = "novo@email.com"
3. Sistema faz: PreviousEmail = "antigo@email.com"
```

### Fluxo de Troca de Senha (Usa Ambos Emails)

```
1. SOLICITAÇÃO:
   - Email atual: Token de verificação
   - Email anterior (PreviousEmail): Link de cancelamento

2. CONFIRMAÇÃO:
   - Email atual: Link de reversão (7 dias)
   - Email anterior (PreviousEmail): Link de reversão (7 dias)
```

---

## 🎯 Resumo da Solução

### ✅ O que Foi Corrigido

1. **Promise aguardado** com `await Promise.allSettled()`
2. **Logs detalhados** para debug
3. **Verificações explícitas** de campos vazios
4. **Tratamento de erros** individual por email

### ⚠️ O que o Usuário Precisa Entender

1. **`PreviousEmail` só existe** se o usuário trocou de email antes
2. **Se não tiver `PreviousEmail`**, receberá alerta apenas no email atual
3. **Para ter 2 alertas**, precisa ter trocado de email pelo menos uma vez

### 📋 Checklist de Verificação

- [ ] Executar script de diagnóstico
- [ ] Verificar se `PreviousEmail` está preenchido
- [ ] Reiniciar servidor backend
- [ ] Testar troca de senha
- [ ] Verificar logs do backend
- [ ] Confirmar recebimento dos emails
- [ ] Testar link de reversão

---

## 📞 Suporte

**Logs importantes:**
```bash
# Verificar logs durante troca de senha
npm start | grep "📧\|✅\|❌\|⚠️"
```

**Arquivos relacionados:**
- `backend/controllers/userController.js` (linha 633-684)
- `backend/services/emailService.js` (sendPasswordChangeConfirmationAlert)
- `backend/scripts/diagnostico_emails_usuario.sql`

---

**Última atualização:** 05/11/2025  
**Status:** ✅ Código corrigido e logs implementados

