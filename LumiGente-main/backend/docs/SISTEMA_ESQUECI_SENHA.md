# 🔑 Sistema de "Esqueci Minha Senha" - Documentação Completa

## 📋 Visão Geral

Sistema completo de recuperação de senha para usuários **não logados**, com:

- ✅ Recuperação por CPF (sem necessidade de login)
- ✅ Token enviado para **AMBOS** os emails (Email + PreviousEmail)
- ✅ Token de 6 dígitos válido por 15 minutos
- ✅ Informações de suporte para usuários sem email
- ✅ Validação de segurança e rate limiting
- ✅ Interface responsiva e intuitiva

---

## 🔄 Fluxo Completo

### Etapa 1: Solicitar Recuperação

**Tela de Login → "Recuperar senha"**

```javascript
// Frontend
POST /api/forgot-password
Body: { cpf: "123.456.789-00" }

// Backend
1. Valida CPF
2. Busca usuário por CPF
3. Verifica se tem Email ou PreviousEmail
4. Gera token de 6 dígitos
5. Salva token no banco (PasswordResetToken)
6. Envia token para Email
7. Envia token para PreviousEmail (se diferente)
```

**Respostas possíveis:**
```json
// Sucesso - Emails enviados
{
  "success": true,
  "message": "Token enviado para o(s) email(s) cadastrado(s)...",
  "emailsSent": 2,
  "hasSupportContact": true
}

// Sem emails cadastrados
{
  "success": true,
  "message": "Nenhum email encontrado. Entre em contato com TI...",
  "needsSupport": true,
  "hasSupportContact": true
}

// CPF não existe (por segurança retorna sucesso)
{
  "success": true,
  "message": "Se o CPF estiver cadastrado, um token será enviado...",
  "hasSupportContact": true
}
```

### Etapa 2: Redefinir Senha

**Tela de Login → Inserir token e nova senha**

```javascript
// Frontend
POST /api/verify-forgot-password
Body: {
  cpf: "123.456.789-00",
  token: "123456",
  newPassword: "nova_senha_123"
}

// Backend
1. Busca usuário por CPF
2. Valida token JWT
3. Verifica expiração (15 minutos)
4. Compara hash do token
5. Atualiza PasswordHash com nova senha
6. Remove token do banco
7. Registra LastPasswordChange
```

**Respostas:**
```json
// Sucesso
{
  "success": true,
  "message": "Senha alterada com sucesso! Você já pode fazer login."
}

// Erro - Token inválido
{
  "error": "Token inválido ou expirado"
}
```

---

## 📁 Arquivos Implementados

### Backend

#### 1. **userController.js** (2 novas funções)

```javascript
exports.forgotPassword          // POST /api/forgot-password
exports.verifyForgotPassword    // POST /api/verify-forgot-password
```

**Características:**
- ✅ NÃO requer autenticação
- ✅ Envia token para Email + PreviousEmail
- ✅ Retorna sucesso mesmo se CPF não existir (segurança)
- ✅ Logs detalhados

#### 2. **emailService.js** (1 nova função)

```javascript
exports.sendForgotPasswordEmail  // Email com token de recuperação
```

**Template:**
- 🎨 Design profissional e responsivo
- 📧 Token destacado (6 dígitos)
- ⏱️ Aviso de expiração (15 minutos)
- 💡 Orientações claras

#### 3. **authRoutes.js** (2 novas rotas)

```javascript
POST /api/forgot-password         // Solicitar token
POST /api/verify-forgot-password  // Verificar token e trocar senha
```

**Middlewares aplicados:**
- ✅ `loginLimiter` - Previne ataques de força bruta
- ✅ `tokenVerificationLimiter` - Limita tentativas de token
- ✅ `auditLog` - Registra todas as tentativas

### Frontend

#### 1. **login.html** (Nova interface)

**Elementos adicionados:**
```html
<!-- Formulário com 2 etapas -->
<div id="forgotPasswordForm">
  <div id="forgot-step-1">        <!-- CPF -->
  <div id="forgot-step-2">        <!-- Token + Nova Senha -->
</div>

<!-- Botão de toggle -->
<button id="toggleForgotPassword">Recuperar senha</button>
```

**Informação de suporte:**
```html
<div style="...">
  📧 ti.sistemas@lumicenter.com
</div>
```

#### 2. **login-handler.js** (5 novas funções)

```javascript
toggleForgotPassword()         // Alterna para tela de recuperação
sendForgotPasswordToken()      // Solicita token por CPF
verifyForgotPasswordToken()    // Verifica token e redefine senha
backToForgotStep1()            // Volta para etapa 1
resetForgotPasswordForm()      // Reseta formulário
```

---

## 🎯 Diferenças: Sistema Logado vs Não Logado

| Característica | Logado (Troca) | Não Logado (Recuperação) |
|----------------|----------------|--------------------------|
| **Endpoint** | `/api/usuario/password` | `/api/forgot-password` |
| **Autenticação** | ✅ Requerida | ❌ Não requerida |
| **Identificação** | Session userId | CPF |
| **Pede senha atual?** | ✅ Sim | ❌ Não (esqueceu) |
| **Token válido por** | 2 minutos | 15 minutos |
| **Backup senha anterior?** | ✅ Sim (reversão 7 dias) | ❌ Não |
| **Emails enviados** | Email + PreviousEmail | Email + PreviousEmail |
| **Campo usado** | PendingPasswordHash | PasswordResetToken |
| **Após confirmar** | Logout + Link reversão | Apenas redirect login |

---

## 📧 Sistema de Emails

### Email de Recuperação

**Assunto:** "🔑 Recuperação de Senha - LumiGente"

**Destinatários:**
1. Email atual (se existir)
2. Email anterior (se existir e for diferente)

**Conteúdo:**
- Badge "🔑 Recuperação de Senha"
- Token de 6 dígitos em destaque
- Aviso de expiração (15 minutos)
- Orientação de não compartilhar
- Alerta se não solicitou

**Logs gerados:**
```
🔍 Buscando usuário para recuperação de senha: 12345678900
✅ Token gerado e salvo no banco
📧 Enviando token para email atual: usuario@email.com
✅ Token enviado para: usuario@email.com
📧 Enviando token para email anterior: antigo@email.com
✅ Token enviado para: antigo@email.com
📊 Total de emails enviados: 2
```

---

## 🛡️ Segurança Implementada

### 1. Proteção Contra Enumeração de CPF
```javascript
// Sempre retorna sucesso, mesmo se CPF não existir
if (userResult.recordset.length === 0) {
    return res.json({ 
        success: true, 
        message: 'Se o CPF estiver cadastrado, um token será enviado...'
    });
}
```

### 2. Rate Limiting
```javascript
// Limita tentativas de solicitação de token
router.post('/forgot-password', loginLimiter, ...)

// Limita tentativas de verificação de token
router.post('/verify-forgot-password', tokenVerificationLimiter, ...)
```

### 3. Token Seguro
```javascript
// Token criptográfico de 6 dígitos
const token = crypto.randomInt(100000, 999999).toString();

// Hash SHA-256 armazenado
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

// JWT assinado com expiração
const jwtToken = jwt.sign({ userId, tokenHash }, JWT_SECRET, { expiresIn: '15m' });
```

### 4. Validações
- ✅ CPF válido (algoritmo de validação)
- ✅ Token de 6 dígitos
- ✅ Senha mínima 6 caracteres
- ✅ Expiração de 15 minutos
- ✅ Token usado uma única vez

---

## 📊 Campos do Banco de Dados Usados

```sql
-- Busca usuário
SELECT Id, NomeCompleto, Email, PreviousEmail, CPF
FROM Users 
WHERE CPF = @cpf AND IsActive = 1

-- Armazena token
UPDATE Users 
SET PasswordResetToken = @token,
    PasswordResetExpires = @expiresAt
WHERE Id = @userId

-- Redefine senha
UPDATE Users 
SET PasswordHash = @passwordHash,
    PasswordResetToken = NULL,
    PasswordResetExpires = NULL,
    LastPasswordChange = GETDATE()
WHERE Id = @userId
```

---

## 🎨 Interface do Usuário

### Tela de Login - Estados

#### Estado 1: Login Normal
```
┌─────────────────────────┐
│  [Logo LumiGente]       │
├─────────────────────────┤
│  CPF: [___________]     │
│  Senha: [___________]   │
│  [Entrar]               │
├─────────────────────────┤
│  Primeiro acesso?       │
│  [Criar conta]          │
│  Esqueceu sua senha?    │
│  [Recuperar senha]   ← NOVO
└─────────────────────────┘
```

#### Estado 2: Recuperar Senha - Etapa 1
```
┌─────────────────────────┐
│  [Logo LumiGente]       │
├─────────────────────────┤
│  Informe seu CPF para   │
│  receber token          │
│                         │
│  CPF: [___________]     │
│  [Enviar Token]         │
├─────────────────────────┤
│  📧 Sem acesso aos      │
│  emails cadastrados?    │
│  Entre em contato:      │
│  ti.sistemas@           │
│  lumicenter.com         │
├─────────────────────────┤
│  Voltar ao login?       │
│  [Fazer login]          │
└─────────────────────────┘
```

#### Estado 3: Recuperar Senha - Etapa 2
```
┌─────────────────────────┐
│  [Logo LumiGente]       │
├─────────────────────────┤
│  Token enviado!         │
│  Verifique seu email    │
│                         │
│  Token: [______]        │
│  Nova Senha: [______]   │
│  Confirmar: [______]    │
│  [Redefinir Senha]      │
│  [Voltar]               │
├─────────────────────────┤
│  Voltar ao login?       │
│  [Fazer login]          │
└─────────────────────────┘
```

---

## 🧪 Como Testar

### Cenário 1: Usuário com Email e PreviousEmail ✅

1. **Clicar em "Recuperar senha"**
2. **Informar CPF** e clicar em "Enviar Token"
3. **Verificar ambos os emails:**
   - Email atual: Deve receber token
   - Email anterior: Deve receber token
4. **Usar token recebido**
5. **Definir nova senha**
6. **Fazer login com nova senha**

**Logs esperados:**
```
🔍 Buscando usuário para recuperação de senha: ...
📧 Enviando token para email atual: ...
✅ Token enviado para: ...
📧 Enviando token para email anterior: ...
✅ Token enviado para: ...
📊 Total de emails enviados: 2
```

### Cenário 2: Usuário apenas com Email (sem PreviousEmail) ⚠️

1. **Mesmos passos**
2. **Apenas email atual recebe token**

**Logs esperados:**
```
📧 Enviando token para email atual: ...
✅ Token enviado para: ...
📊 Total de emails enviados: 1
```

### Cenário 3: Usuário sem Email ❌

1. **Informar CPF** e clicar em "Enviar Token"
2. **Ver mensagem:** "Nenhum email encontrado. Entre em contato com TI..."
3. **Email de contato exibido:** ti.sistemas@lumicenter.com

### Cenário 4: CPF não existe (Segurança) 🔒

1. **Informar CPF inválido**
2. **Ver mensagem genérica:** "Se o CPF estiver cadastrado..."
3. **Nenhum email é enviado** (mas usuário não sabe)

**Segurança:** Previne enumeração de CPFs cadastrados

---

## 📞 Sistema de Suporte

### Informação de Contato

**Email:** ti.sistemas@lumicenter.com

**Exibido quando:**
- ✅ Sempre (em todos os casos)
- ✅ Destaque quando usuário não tem email

**Onde aparece:**
- Etapa 1 do formulário de recuperação
- Box azul com ícone de mensagem
- Link clicável que abre email client

---

## 🔧 Configurações

### Variáveis de Ambiente

```env
# Tempo de expiração do token (padrão: 15 minutos)
JWT_FORGOT_PASSWORD_EXPIRES_IN=15m

# Email de suporte (configurado no código)
# ti.sistemas@lumicenter.com
```

### Tempo de Expiração

| Token | Uso | Prazo |
|-------|-----|-------|
| Forgot Password | Recuperação sem login | **15 minutos** |
| Password Change | Troca logado | 2 minutos |
| Password Revert | Reversão | 7 dias |

---

## 📊 Comparação com Sistema de Troca de Senha

| Aspecto | Troca (Logado) | Recuperação (Não Logado) |
|---------|----------------|--------------------------|
| **Identificação** | Session | CPF |
| **Autenticação** | ✅ Requerida | ❌ Não requerida |
| **Pede senha atual** | ✅ Sim | ❌ Não (esqueceu) |
| **Token expira em** | 2 minutos | 15 minutos |
| **Emails enviados** | Email + PreviousEmail | Email + PreviousEmail |
| **Backup senha** | ✅ Sim (reversão) | ❌ Não |
| **Após confirmar** | Logout + reversão | Redirect para login |
| **Endpoint** | `/api/usuario/password` | `/api/forgot-password` |
| **Suporte exibido** | ❌ Não | ✅ Sim |

---

## 🔍 Logs de Auditoria

### Solicitação de Token
```
[AUDIT] FORGOT_PASSWORD | User: Anônimo | IP: 192.168.1.1 | CPF: 123*****00
🔍 Buscando usuário para recuperação de senha: 12345678900
✅ Token gerado e salvo no banco
📧 Enviando token para email atual: usuario@email.com
✅ Token enviado para: usuario@email.com
📧 Enviando token para email anterior: antigo@email.com
✅ Token enviado para: antigo@email.com
📊 Total de emails enviados: 2
```

### Verificação de Token
```
[AUDIT] VERIFY_FORGOT_PASSWORD | User: Anônimo | IP: 192.168.1.1
✅ Senha redefinida com sucesso para usuário: NOME DO USUARIO
```

---

## 🛠️ Manutenção

### Limpar Tokens Expirados

Execute periodicamente:

```sql
-- Limpar tokens de recuperação expirados (opcional - performance)
UPDATE Users
SET PasswordResetToken = NULL,
    PasswordResetExpires = NULL
WHERE PasswordResetExpires < GETDATE()
AND PasswordResetToken IS NOT NULL;
```

### Monitorar Tentativas Suspeitas

```sql
-- Ver últimas solicitações de recuperação
SELECT TOP 100
    u.Id,
    u.NomeCompleto,
    u.CPF,
    u.Email,
    u.PasswordResetExpires as 'Token Expira Em'
FROM Users u
WHERE u.PasswordResetToken IS NOT NULL
ORDER BY u.PasswordResetExpires DESC;
```

---

## 🎯 Casos de Uso

### Caso 1: Funcionário Esqueceu Senha ✅
**Solução:** Usar "Recuperar senha" na tela de login

### Caso 2: Funcionário sem Email Cadastrado ⚠️
**Solução:** Contatar ti.sistemas@lumicenter.com

### Caso 3: Funcionário sem Acesso aos Emails 📧
**Solução:** Contatar ti.sistemas@lumicenter.com (exibido na tela)

### Caso 4: Funcionário Quer Trocar Senha (Sabe a Atual) 🔄
**Solução:** Fazer login e usar "Alterar Senha" em Configurações

---

## 📋 Checklist de Teste

### Teste Básico
- [ ] Clicar em "Recuperar senha"
- [ ] Informar CPF válido
- [ ] Receber token em ambos emails (se tiver 2)
- [ ] Inserir token de 6 dígitos
- [ ] Definir nova senha
- [ ] Fazer login com nova senha
- [ ] Verificar campo LastPasswordChange atualizado

### Teste de Segurança
- [ ] Informar CPF inválido (deve validar)
- [ ] Informar CPF inexistente (deve retornar sucesso genérico)
- [ ] Usar token expirado (deve rejeitar)
- [ ] Usar token incorreto (deve rejeitar)
- [ ] Tentar múltiplas vezes (deve aplicar rate limit)

### Teste de Suporte
- [ ] Usuário sem email deve ver contato TI
- [ ] Link de email deve abrir client de email
- [ ] Informação de contato sempre visível

---

## 🚀 Instalação e Configuração

### Passo 1: Campos do Banco (Já Existem!)
Os campos necessários já foram criados anteriormente:
- `PasswordResetToken`
- `PasswordResetExpires`
- `LastPasswordChange`

### Passo 2: [Opcional] Configurar .env
```env
# Adicionar (opcional - tem padrão de 15m)
JWT_FORGOT_PASSWORD_EXPIRES_IN=15m
```

### Passo 3: Reiniciar Servidor
```bash
npm restart
```

### Passo 4: Testar
```bash
# Acesse
http://localhost:3057/pages/login.html

# Clique em "Recuperar senha"
```

---

## 🎉 Conclusão

Sistema completo de recuperação de senha implementado com:

✅ Interface amigável e profissional  
✅ Segurança robusta (rate limiting, JWT, validações)  
✅ Suporte para múltiplos emails  
✅ Informação de contato para casos sem email  
✅ Logs detalhados para auditoria  
✅ 100% responsivo e acessível  

**Status:** ✅ Pronto para produção

**Email de suporte:** ti.sistemas@lumicenter.com

---

**Data de implementação:** 05/11/2025  
**Versão:** 1.0.0  
**Autor:** Sistema LumiGente

