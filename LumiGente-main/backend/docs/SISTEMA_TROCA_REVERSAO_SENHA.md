# Sistema de Troca e Reversão de Senha

## 📋 Visão Geral

Este documento descreve o sistema completo e seguro de alteração de senha implementado no LumiGente, que inclui:

- ✅ **Verificação em duas etapas** (token por email)
- ⏱️ **Cancelamento antes da confirmação** (2 minutos)
- 🔄 **Reversão após a confirmação** (7 dias)
- 📧 **Alertas para múltiplos emails** (atual e anterior)
- 🔒 **Armazenamento seguro da senha anterior**

## 🔐 Fluxo de Segurança

### Fase 1: Solicitação de Troca de Senha

1. **Usuário solicita troca de senha**
   - Endpoint: `PUT /api/usuario/password`
   - Requer senha atual para validação
   - Sistema valida se há pelo menos um email cadastrado

2. **Sistema gera tokens**
   - Token de verificação (6 dígitos, válido por 2 minutos)
   - Token de cancelamento (válido por 2 minutos)
   - Nova senha é armazenada como `PendingPasswordHash`

3. **Emails enviados**
   - **Email atual**: Recebe o token de 6 dígitos para confirmar
   - **Email anterior**: Recebe link de cancelamento (se não foi você)

### Fase 2: Confirmação da Troca

4. **Usuário confirma com token**
   - Endpoint: `POST /api/usuario/verify-password-change`
   - Token de 6 dígitos é validado
   - Senha atual é movida para `PreviousPasswordHash`
   - Nova senha se torna `PasswordHash`
   - Token de reversão é gerado (válido por 7 dias)

5. **Emails de confirmação enviados**
   - **Email atual**: Alerta de senha alterada + link de reversão
   - **Email anterior**: Alerta de senha alterada + link de reversão
   - Todas as sessões do usuário são invalidadas
   - Usuário precisa fazer login com a nova senha

### Fase 3: Segurança Pós-Troca

6. **Cancelamento (antes da confirmação)**
   - Endpoint: `GET/POST /api/usuario/cancel-password-change`
   - Remove `PendingPasswordHash`
   - Invalida todos os tokens de verificação
   - Senha atual permanece inalterada

7. **Reversão (após a confirmação)**
   - Endpoint: `GET/POST /api/usuario/revert-password-change`
   - Restaura `PreviousPasswordHash` como `PasswordHash`
   - Remove token de reversão
   - Invalida todas as sessões
   - Usuário faz login com a senha anterior

## 📊 Campos na Tabela Users

### Campos de Senha
```sql
PasswordHash              -- Hash da senha atual
PreviousPasswordHash      -- Hash da senha anterior (para reversão)
PendingPasswordHash       -- Hash da nova senha (aguardando confirmação)
LastPasswordChange        -- Data da última troca de senha
```

### Campos de Tokens - Verificação
```sql
PasswordChangeToken       -- Token JWT para confirmar a troca
PasswordChangeExpires     -- Expiração do token de verificação (2 minutos)
```

### Campos de Tokens - Cancelamento
```sql
PasswordChangeCancelToken -- Token JWT para cancelar antes da confirmação
PasswordChangeCancelExpires -- Expiração do token de cancelamento (2 minutos)
```

### Campos de Tokens - Reversão
```sql
PasswordRevertToken       -- Token JWT para reverter após confirmação
PasswordRevertExpires     -- Expiração do token de reversão (7 dias)
```

## 🔄 Diagrama de Estados

```
┌─────────────────┐
│ Senha Atual     │
│ (PasswordHash)  │
└────────┬────────┘
         │
         │ 1. Solicitar troca
         │    PUT /api/usuario/password
         ▼
┌─────────────────────────────┐
│ Senha Pendente              │
│ (PendingPasswordHash)       │
│ + Token verificação (2min)  │
│ + Token cancelamento (2min) │
└────────┬───────────┬────────┘
         │           │
         │           │ CANCELAR
         │           │ /cancel-password-change
         │           ▼
         │      ┌─────────────┐
         │      │ Cancelado   │
         │      │ (sem troca) │
         │      └─────────────┘
         │
         │ 2. Confirmar troca
         │    POST /verify-password-change
         ▼
┌────────────────────────────┐
│ Senha Alterada             │
│ (PasswordHash = nova)      │
│ (PreviousPasswordHash = anterior) │
│ + Token reversão (7 dias)  │
└────────┬───────────────────┘
         │
         │ REVERTER
         │ /revert-password-change
         ▼
┌─────────────────┐
│ Senha Revertida │
│ (PasswordHash = anterior) │
└─────────────────┘
```

## 📧 Sistema de Emails

### 1. Email de Verificação (Email Atual)
- **Assunto**: "Alteração de Senha - LumiGente"
- **Conteúdo**: Token de 6 dígitos
- **Válido por**: 2 minutos
- **Objetivo**: Confirmar identidade

### 2. Email de Alerta de Cancelamento (Email Anterior)
- **Assunto**: "Alerta de alteração de senha - LumiGente"
- **Conteúdo**: Link de cancelamento
- **Válido por**: 2 minutos
- **Objetivo**: Permitir cancelamento se não foi o usuário

### 3. Email de Confirmação com Reversão (Ambos os Emails)
- **Assunto**: "🔒 Senha alterada com sucesso - LumiGente"
- **Conteúdo**: Confirmação + link de reversão
- **Válido por**: 7 dias
- **Objetivo**: Informar e permitir reversão

## 🛡️ Medidas de Segurança Implementadas

### 1. Validação de Identidade
- ✅ Senha atual obrigatória
- ✅ Token de 6 dígitos enviado por email
- ✅ Token com hash SHA-256
- ✅ Expiração de 2 minutos para verificação

### 2. Proteção Contra Acesso Não Autorizado
- ✅ Invalidação de todas as sessões após troca
- ✅ Login obrigatório com nova senha
- ✅ Alertas para múltiplos emails
- ✅ Links únicos e criptografados (JWT)

### 3. Sistema de Reversão
- ✅ Armazena senha anterior de forma segura
- ✅ Token de reversão válido por 7 dias
- ✅ Uma única reversão permitida
- ✅ Invalidação de sessões ao reverter

### 4. Prevenção de Ataques
- ✅ Rate limiting em endpoints de verificação
- ✅ Tokens JWT assinados e validados
- ✅ Validação de expiração no lado do servidor
- ✅ Logs de segurança para auditoria

## 🔧 Variáveis de Ambiente

```env
# Token de verificação (2 minutos padrão)
JWT_PASSWORD_CHANGE_EXPIRES_IN=2m

# Token de cancelamento (1 dia padrão)
JWT_PASSWORD_CHANGE_CANCEL_EXPIRES_IN=1d

# Token de reversão (7 dias padrão)
JWT_PASSWORD_REVERT_EXPIRES_IN=7d

# Secret para assinar tokens JWT
JWT_SECRET=seu_secret_aqui

# URL base do app (para links em emails)
APP_BASE_URL=https://seudominio.com
```

## 📝 Endpoints da API

### 1. Iniciar Troca de Senha
```http
PUT /api/usuario/password
Content-Type: application/json

{
  "currentPassword": "senha_atual",
  "newPassword": "nova_senha"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "message": "Emails enviados com sucesso."
}
```

### 2. Confirmar Troca de Senha
```http
POST /api/usuario/verify-password-change
Content-Type: application/json

{
  "token": "123456"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "message": "Senha alterada com sucesso. Por segurança, você será desconectado e precisará fazer login novamente."
}
```

### 3. Cancelar Troca (Antes da Confirmação)
```http
GET /api/usuario/cancel-password-change?token=jwt_token_aqui
```

**Resposta**: Página HTML com confirmação

### 4. Reverter Troca (Após a Confirmação)
```http
GET /api/usuario/revert-password-change?token=jwt_token_aqui
```

**Resposta**: Página HTML com confirmação

## 🚀 Instalação e Configuração

### 1. Executar Script SQL
```bash
# Adicionar campos necessários no banco de dados
sqlcmd -S servidor -d database -i backend/scripts/add_password_revert_fields.sql
```

### 2. Configurar Variáveis de Ambiente
Adicione as variáveis no arquivo `.env`:
```env
JWT_PASSWORD_CHANGE_EXPIRES_IN=2m
JWT_PASSWORD_CHANGE_CANCEL_EXPIRES_IN=1d
JWT_PASSWORD_REVERT_EXPIRES_IN=7d
```

### 3. Reiniciar Servidor
```bash
npm restart
```

## 🧪 Testes Recomendados

### Cenário 1: Troca Normal
1. Solicitar troca de senha
2. Verificar email recebido
3. Confirmar com token
4. Verificar email de confirmação
5. Fazer logout automático
6. Login com nova senha

### Cenário 2: Cancelamento
1. Solicitar troca de senha
2. Receber email no email anterior
3. Clicar em "Cancelar alteração"
4. Verificar que senha atual continua funcionando

### Cenário 3: Reversão
1. Confirmar troca de senha
2. Receber email de confirmação
3. Clicar em "Reverter para senha anterior"
4. Login com senha antiga

### Cenário 4: Expiração
1. Solicitar troca
2. Aguardar 3 minutos
3. Tentar confirmar com token
4. Verificar mensagem de token expirado

## 📊 Logs de Segurança

O sistema registra os seguintes eventos:

```
🔍 Buscando informações do usuário para troca de senha...
✅ Informações de alteração de senha salvas com sucesso
📧 Token de verificação enviado para: email@exemplo.com
✅ Alerta de cancelamento enviado com sucesso para: email.anterior@exemplo.com
🔄 Confirmando alteração de senha e gerando token de reversão
✅ Senha alterada com sucesso. Enviando emails de confirmação...
✅ Email de confirmação enviado para email atual: email@exemplo.com
✅ Email de confirmação enviado para email anterior: email.anterior@exemplo.com
🔄 Senha revertida para versão anterior. Usuário: 123 Nome do Usuário
🔒 Alteração de senha cancelada antes da confirmação. Usuário: 123
```

## 🎯 Vantagens do Sistema

### Para o Usuário
- ✅ Segurança extra com verificação em duas etapas
- ✅ Capacidade de reverter mudanças não autorizadas
- ✅ Alertas em múltiplos emails
- ✅ Interface simples e clara

### Para a Empresa
- ✅ Conformidade com boas práticas de segurança
- ✅ Logs detalhados para auditoria
- ✅ Proteção contra acessos não autorizados
- ✅ Sistema robusto e escalável

## 🔍 Comparação com Sistema de Email

O sistema de troca de senha é similar ao sistema de troca de email, mas com diferenças importantes:

| Característica | Troca de Email | Troca de Senha |
|---------------|----------------|----------------|
| Token de verificação | 6 dígitos (2 min) | 6 dígitos (2 min) |
| Token de cancelamento | 2 minutos | 2 minutos |
| Token de reversão | 1 dia | **7 dias** |
| Invalidação de sessões | ❌ Não | ✅ Sim |
| Múltiplos emails alertados | ✅ Sim | ✅ Sim |
| Armazena versão anterior | Email anterior | **Hash da senha anterior** |

## 💡 Boas Práticas

### Para Desenvolvedores
1. Nunca expor hashes de senha em logs
2. Sempre invalidar sessões após troca de senha
3. Usar JWT com expiração adequada
4. Implementar rate limiting em endpoints sensíveis
5. Validar expiração no servidor (não confiar no cliente)

### Para Administradores
1. Monitorar logs de trocas de senha frequentes
2. Alertar sobre múltiplas tentativas falhadas
3. Revisar configurações de expiração periodicamente
4. Manter backup dos dados de usuários
5. Testar fluxo completo regularmente

## 📞 Suporte

Em caso de problemas:

1. Verificar logs do servidor
2. Confirmar que campos existem no banco
3. Validar configuração de email
4. Revisar variáveis de ambiente
5. Consultar documentação adicional

---

**Última atualização**: Novembro 2025  
**Versão**: 1.0  
**Autor**: Sistema LumiGente

