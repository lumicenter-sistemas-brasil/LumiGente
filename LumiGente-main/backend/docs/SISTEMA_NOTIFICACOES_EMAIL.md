# 📧 Sistema de Notificações por Email

## 📋 Visão Geral

Sistema automático de notificações por email para manter os usuários informados sobre interações importantes no LumiGente:

- ✅ **Feedback recebido** - Email quando alguém envia feedback
- ✅ **Reconhecimento recebido** - Email quando alguém reconhece o trabalho
- ✅ **Objetivo atribuído** - Email quando é adicionado como responsável em objetivo

---

## 📧 Tipos de Notificações

### 1. Feedback Recebido 💬

**Quando dispara:**
- Quando um usuário ENVIA um feedback para outro usuário

**Email enviado para:**
- Usuário que RECEBEU o feedback (to_user_id)

**Informações no email:**
- Nome de quem enviou
- Tipo do feedback
- Categoria do feedback
- Link para visualizar no sistema

**Template:** Verde com badge "Novo Feedback"

---

### 2. Reconhecimento Recebido 🏆

**Quando dispara:**
- Quando um usuário ENVIA um reconhecimento para outro usuário

**Email enviado para:**
- Usuário que RECEBEU o reconhecimento (to_user_id)

**Informações no email:**
- Nome de quem enviou
- Badge do reconhecimento (ex: "Trabalho em Equipe")
- Link para visualizar no sistema

**Template:** Amarelo/Laranja com badge "Reconhecimento Recebido"

---

### 3. Objetivo Atribuído 🎯

**Quando dispara:**
- Quando um novo objetivo é CRIADO

**Email enviado para:**
- TODOS os responsáveis do objetivo (responsaveis_ids[])

**Informações no email:**
- Nome de quem criou
- Título do objetivo
- Data de início
- Data de fim/prazo
- Link para visualizar no sistema

**Template:** Azul com badge "Novo Objetivo"

---

## 🔧 Implementação Técnica

### Arquivos Modificados

#### 1. `backend/services/emailService.js`

**3 novas funções:**

```javascript
sendFeedbackNotificationEmail(email, userName, fromName, feedbackType, feedbackCategory)
sendRecognitionNotificationEmail(email, userName, fromName, badge)
sendObjetivoNotificationEmail(email, userName, creatorName, objetivoTitulo, dataInicio, dataFim)
```

#### 2. `backend/controllers/feedbackController.js`

```javascript
// Após criar feedback (linha ~219)
if (toUser && toUser.Email) {
    await emailService.sendFeedbackNotificationEmail(...);
}
```

#### 3. `backend/controllers/recognitionController.js`

```javascript
// Após criar reconhecimento (linha ~93)
if (toUser && toUser.Email) {
    await emailService.sendRecognitionNotificationEmail(...);
}
```

#### 4. `backend/controllers/objetivoController.js`

```javascript
// Após adicionar responsáveis (linha ~143)
for (const responsavelId of responsaveis_ids) {
    if (responsavel.Email) {
        await emailService.sendObjetivoNotificationEmail(...);
    }
}
```

---

## 🛡️ Segurança e Tratamento de Erros

### Verificações Implementadas

✅ **Verifica se usuário tem email** antes de enviar  
✅ **Não quebra a operação** se email falhar (try/catch)  
✅ **Logs informativos** para debug  
✅ **Catch individual** por responsável (objetivos)  

### Logs Gerados

```javascript
// Sucesso
✅ Email de notificação de feedback enviado para: usuario@email.com
✅ Email de notificação de reconhecimento enviado para: usuario@email.com
✅ Email de notificação de objetivo enviado para: usuario@email.com

// Sem email
⚠️ Usuário sem email cadastrado, notificação não enviada por email

// Erro (não crítico)
⚠️ Falha ao enviar email de notificação (não crítico): erro_detalhado
```

---

## 📊 Fluxo Completo

### Feedback

```
1. Usuário A envia feedback para Usuário B
   ↓
2. Backend salva no banco
   ↓
3. Cria notificação in-app
   ↓
4. Busca email do Usuário B
   ↓
5. Se tem email: Envia notificação por email
6. Se não tem: Log de aviso (não falha)
   ↓
7. Retorna sucesso para frontend
```

### Reconhecimento

```
1. Usuário A reconhece Usuário B
   ↓
2. Backend salva no banco
   ↓
3. Adiciona pontos para ambos
   ↓
4. Cria notificação in-app
   ↓
5. Busca email do Usuário B
   ↓
6. Se tem email: Envia notificação por email
7. Se não tem: Log de aviso
   ↓
8. Retorna sucesso para frontend
```

### Objetivo

```
1. Gestor cria objetivo com responsáveis [A, B, C]
   ↓
2. Backend salva objetivo
   ↓
3. Adiciona responsáveis no banco
   ↓
4. Para cada responsável:
   - Busca email
   - Se tem: Envia notificação
   - Se não tem: Log de aviso
   ↓
5. Retorna sucesso para frontend
```

---

## 🎨 Templates de Email

### Características Comuns

✅ Design responsivo  
✅ Logo do LumiGente  
✅ Badge colorido por tipo  
✅ Botão de ação (Ver Feedback/Reconhecimento/Objetivo)  
✅ Footer com ano dinâmico  
✅ Aviso de email automático  

### Cores por Tipo

| Tipo | Cor Badge | Cor Botão |
|------|-----------|-----------|
| Feedback | Verde (#10b981) | Azul (#0d556d) |
| Reconhecimento | Laranja (#f59e0b) | Laranja (#f59e0b) |
| Objetivo | Azul (#3b82f6) | Azul (#3b82f6) |

---

## 🧪 Como Testar

### Teste 1: Feedback

```bash
1. Login com Usuário A (com email cadastrado)
2. Enviar feedback para Usuário B (com email)
3. Verificar logs do backend:
   "✅ Email de notificação de feedback enviado para: ..."
4. Verificar email do Usuário B
5. Clicar em "Ver Feedback" no email
6. Deve abrir o sistema
```

### Teste 2: Reconhecimento

```bash
1. Login com Usuário A
2. Reconhecer Usuário B (com email)
3. Verificar logs:
   "✅ Email de notificação de reconhecimento enviado para: ..."
4. Verificar email do Usuário B
5. Email deve ter o badge em destaque
```

### Teste 3: Objetivo

```bash
1. Login com Gestor
2. Criar objetivo com 3 responsáveis (todos com email)
3. Verificar logs:
   "✅ Email de notificação de objetivo enviado para: ..." (3x)
4. Todos os 3 responsáveis devem receber email
5. Email deve ter título, datas e criador
```

### Teste 4: Usuário Sem Email

```bash
1. Enviar feedback para usuário SEM email
2. Verificar logs:
   "⚠️ Usuário sem email cadastrado, notificação não enviada por email"
3. Operação deve continuar normalmente
4. Notificação in-app deve ser criada
```

---

## 📋 Checklist de Funcionalidades

- [x] Template de email para feedback
- [x] Template de email para reconhecimento
- [x] Template de email para objetivo
- [x] Integração no feedbackController
- [x] Integração no recognitionController
- [x] Integração no objetivoController
- [x] Verificação de email cadastrado
- [x] Tratamento de erros não críticos
- [x] Logs informativos
- [x] Múltiplos responsáveis (objetivos)
- [x] Links para o sistema
- [x] Design responsivo

---

## ⚙️ Configurações

### Variáveis de Ambiente Necessárias

```env
# SMTP (já configurado)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
EMAIL_USER=naoresponda@lumicenter.com
EMAIL_PASSWORD=sua_senha

# URL base (para links nos emails)
APP_BASE_URL=http://localhost:3057
```

### Campos do Banco Necessários

```sql
-- Tabela Users
Email VARCHAR(255)              -- Email do usuário (pode ser NULL)
NomeCompleto VARCHAR(255)       -- Nome para personalização

-- Já existentes
```

---

## 🔍 Monitoramento

### Verificar Emails Enviados

```sql
-- Usuários COM email cadastrado
SELECT 
    Id,
    NomeCompleto,
    Email,
    CASE 
        WHEN Email IS NOT NULL AND Email != '' THEN 'Receberá emails'
        ELSE 'NÃO receberá emails'
    END as StatusEmail
FROM Users
WHERE IsActive = 1
ORDER BY Email IS NULL, NomeCompleto;
```

### Estatísticas

```sql
-- Quantos usuários podem receber emails
SELECT 
    COUNT(*) as Total,
    SUM(CASE WHEN Email IS NOT NULL AND Email != '' THEN 1 ELSE 0 END) as ComEmail,
    SUM(CASE WHEN Email IS NULL OR Email = '' THEN 1 ELSE 0 END) as SemEmail,
    CAST(SUM(CASE WHEN Email IS NOT NULL AND Email != '' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as PercentualComEmail
FROM Users
WHERE IsActive = 1;
```

---

## 💡 Boas Práticas

### Para Desenvolvedores

1. **Sempre verificar email** antes de enviar
2. **Usar try/catch** para não quebrar operação principal
3. **Logs claros** para facilitar debug
4. **Email opcional** - sistema funciona sem
5. **Não aguardar email** - usar catch() assíncrono

### Para Administradores

1. Encorajar usuários a cadastrarem email
2. Monitorar logs de emails não enviados
3. Verificar configuração SMTP periodicamente
4. Revisar templates de email quando necessário

---

## 🎯 Benefícios

### Para o Usuário

✅ Notificação instantânea por email  
✅ Não precisa estar logado para saber  
✅ Link direto para a ação  
✅ Informações resumidas no email  

### Para a Empresa

✅ Maior engagement dos colaboradores  
✅ Feedbacks não passam despercebidos  
✅ Reconhecimentos têm mais impacto  
✅ Objetivos são vistos rapidamente  

---

## 🔄 Integração com Sistema Existente

### Notificações In-App (Já Existe)

O sistema de notificações in-app **continua funcionando** normalmente. Os emails são um **complemento**, não uma substituição.

**Fluxo completo:**
1. ✅ Cria registro no banco
2. ✅ Cria notificação in-app
3. ✅ **Envia email** (novo!)
4. ✅ Retorna sucesso

### Gamificação (Mantida)

Pontos continuam sendo adicionados normalmente:
- Feedback enviado: +10 pontos
- Reconhecimento enviado: +5 pontos
- Reconhecimento recebido: +5 pontos

---

## 📞 Troubleshooting

### Problema: Emails não estão sendo enviados

**Verificar:**
1. Configuração SMTP no `.env`
2. Usuário tem email cadastrado: `SELECT Email FROM Users WHERE Id = X`
3. Logs do backend: procurar por "⚠️" ou "❌"
4. Pasta de spam do destinatário

### Problema: Email enviado mas não chegou

**Verificar:**
1. Email correto no cadastro
2. Servidor SMTP funcionando
3. Pasta de spam
4. Logs: "✅ Email...enviado"

### Problema: Operação falha ao tentar enviar email

**Não deveria acontecer!**  
Todos os emails têm try/catch e não quebram a operação.  
Se acontecer, revisar implementação.

---

## 📊 Resumo

| Evento | Email Enviado | Destinatário | Cor |
|--------|---------------|--------------|-----|
| Feedback criado | ✅ | Quem recebeu | Verde |
| Reconhecimento criado | ✅ | Quem recebeu | Laranja |
| Objetivo criado | ✅ | Todos responsáveis | Azul |

**Implementação:**  
✅ Completa e testada  
✅ Não quebra se email falhar  
✅ Logs detalhados  
✅ Design profissional  

---

**Data de implementação:** 05/11/2025  
**Versão:** 1.0.0  
**Status:** ✅ Pronto para produção

