# 🔐 Guia Rápido - Sistema de Troca e Reversão de Senha

## 🚀 Configuração Inicial (Uma Vez)

### 1. Execute o Script SQL
```bash
# Windows com SQL Server
sqlcmd -S seu_servidor -d sua_database -i backend/scripts/add_password_revert_fields.sql

# Ou execute manualmente no SQL Server Management Studio
```

### 2. Configure Variáveis de Ambiente
Adicione no seu arquivo `.env`:

```env
# Tempo de expiração dos tokens
JWT_PASSWORD_CHANGE_EXPIRES_IN=2m          # Token de verificação (2 minutos)
JWT_PASSWORD_CHANGE_CANCEL_EXPIRES_IN=1d   # Token de cancelamento (1 dia)
JWT_PASSWORD_REVERT_EXPIRES_IN=7d          # Token de reversão (7 dias)

# URL base da aplicação (para links nos emails)
APP_BASE_URL=http://localhost:3057
```

### 3. Reinicie o Servidor
```bash
npm restart
```

## 📧 Como Funciona (Fluxo do Usuário)

### Cenário 1: Troca Normal de Senha ✅

1. **Usuário acessa configurações** e solicita troca de senha
2. **Recebe token no email atual** (6 dígitos)
3. **Confirma com o token**
4. **Sistema faz logout automático**
5. **Faz login com a nova senha**

**Emails enviados:**
- 📧 **Email atual**: Token de verificação
- 📧 **Email anterior**: Link de cancelamento (se não foi você)
- 📧 **Ambos emails**: Confirmação + link de reversão (após confirmação)

---

### Cenário 2: Cancelar ANTES de Confirmar 🚫

1. **Usuário solicita troca de senha**
2. **Email anterior recebe alerta**
3. **Clica em "Cancelar alteração"**
4. **Senha atual permanece inalterada**

---

### Cenário 3: Reverter DEPOIS de Confirmar 🔄

1. **Senha foi alterada com sucesso**
2. **Ambos emails recebem confirmação**
3. **Clica em "Reverter para senha anterior"** (válido por 7 dias)
4. **Senha volta para a versão anterior**
5. **Faz login com senha antiga**

## 🔒 Segurança Implementada

✅ **Verificação em 2 etapas** (email + token)  
✅ **Tokens JWT criptografados** com expiração  
✅ **Senha anterior armazenada** de forma segura (hash)  
✅ **Invalidação de sessões** após troca  
✅ **Múltiplos emails alertados** (atual + anterior)  
✅ **Logs de auditoria** para monitoramento  
✅ **Rate limiting** para prevenir ataques  

## 📋 Endpoints Disponíveis

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| PUT | `/api/usuario/password` | Inicia troca de senha | ✅ |
| POST | `/api/usuario/verify-password-change` | Confirma troca com token | ✅ |
| GET/POST | `/api/usuario/cancel-password-change` | Cancela antes da confirmação | ❌* |
| GET/POST | `/api/usuario/revert-password-change` | Reverte após confirmação | ❌* |

**`*` Não requer auth pois usa token JWT no link do email**

## 🧪 Teste Rápido

### Frontend (JavaScript)
```javascript
// 1. Iniciar troca de senha
const response = await fetch('/api/usuario/password', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    currentPassword: 'senha_atual',
    newPassword: 'nova_senha_123'
  })
});

// 2. Verificar com token recebido por email
const verify = await fetch('/api/usuario/verify-password-change', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: '123456' })
});
```

### cURL (Teste Manual)
```bash
# 1. Iniciar troca
curl -X PUT http://localhost:3057/api/usuario/password \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"senha_atual","newPassword":"nova_senha"}'

# 2. Confirmar com token
curl -X POST http://localhost:3057/api/usuario/verify-password-change \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'
```

## 🎯 Prazos Importantes

| Ação | Prazo | Configurável via |
|------|-------|------------------|
| Confirmar com token | **2 minutos** | `JWT_PASSWORD_CHANGE_EXPIRES_IN` |
| Cancelar antes de confirmar | **2 minutos** | `JWT_PASSWORD_CHANGE_CANCEL_EXPIRES_IN` |
| Reverter após confirmação | **7 dias** | `JWT_PASSWORD_REVERT_EXPIRES_IN` |

## ⚠️ Avisos Importantes

1. **Logout Automático**: Após confirmar a troca, TODAS as sessões do usuário são encerradas
2. **Uma Reversão Apenas**: Só é possível reverter uma vez (volta para senha anterior)
3. **Email Obrigatório**: É necessário ter pelo menos um email cadastrado para trocar senha
4. **Expiração Rigorosa**: Tokens expirados não podem ser usados (segurança)

## 🐛 Solução de Problemas

### Problema: "Token inválido ou expirado"
**Solução**: Token expira em 2 minutos. Solicite nova troca de senha.

### Problema: "Já existe uma alteração de senha pendente"
**Solução**: Aguarde 2 minutos ou cancele a alteração anterior.

### Problema: "Email não cadastrado"
**Solução**: Cadastre um email antes de trocar a senha.

### Problema: Não recebo emails
**Verificar**:
1. Configuração SMTP no `.env`
2. Email do usuário está correto
3. Pasta de spam
4. Logs do servidor (`console.log`)

## 📊 Estrutura dos Campos no Banco

```sql
-- Senhas
PasswordHash              -- Senha atual (hash bcrypt)
PreviousPasswordHash      -- Senha anterior (para reversão)
PendingPasswordHash       -- Nova senha pendente

-- Tokens
PasswordChangeToken       -- JWT para verificação (2 min)
PasswordChangeCancelToken -- JWT para cancelamento (2 min)
PasswordRevertToken       -- JWT para reversão (7 dias)

-- Expiração
PasswordChangeExpires
PasswordChangeCancelExpires
PasswordRevertExpires

-- Auditoria
LastPasswordChange
```

## 📞 Suporte

- 📖 **Documentação Completa**: `backend/docs/SISTEMA_TROCA_REVERSAO_SENHA.md`
- 🔧 **Script SQL**: `backend/scripts/add_password_revert_fields.sql`
- 📁 **Código**: `backend/controllers/userController.js`
- 📧 **Emails**: `backend/services/emailService.js`

---

**Dica**: Mantenha os prazos configuráveis no `.env` para ajustar conforme necessidade da sua aplicação!

