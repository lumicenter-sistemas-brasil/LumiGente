# Sistema de Tratamento de Erros Oracle

## Problema Identificado

O sistema estava apresentando erros de conectividade com o Oracle linked server (`ORACLE_PROD_SJP`) durante a execução dos jobs de avaliações:

```
RequestError: Cannot get the data of the row from the OLE DB provider "OraOLEDB.Oracle" for linked server "ORACLE_PROD_SJP".
```

## Soluções Implementadas

### 1. Helper de Conectividade Oracle (`utils/oracleConnectionHelper.js`)

- **Retry Logic**: Implementa tentativas automáticas com backoff exponencial
- **Fallback Strategy**: Executa query alternativa quando Oracle falha
- **Error Detection**: Identifica especificamente erros do Oracle linked server

### 2. Monitor de Conectividade (`services/oracleMonitor.js`)

- **Monitoramento Contínuo**: Verifica saúde do Oracle a cada 5 minutos
- **Alertas Inteligentes**: Notifica apenas após múltiplas falhas consecutivas
- **Status Tracking**: Mantém histórico de conectividade

### 3. Melhorias no AvaliacoesManager

- **Fallback Automático**: Usa dados locais (`Users.created_at`) quando Oracle falha
- **Tratamento Robusto**: Não interrompe o sistema em caso de erro Oracle
- **Logging Detalhado**: Registra tentativas e fallbacks

### 4. Jobs Resilientes (`jobs/schedule.js`)

- **Error Handling**: Captura e trata erros Oracle sem crash do sistema
- **Monitoramento Integrado**: Verifica saúde Oracle antes de executar jobs
- **Continuidade**: Sistema continua funcionando mesmo com Oracle indisponível

### 5. Endpoints de Monitoramento (`routes/healthRoutes.js`)

- `GET /api/health` - Status geral do sistema
- `GET /api/oracle-status` - Status detalhado do Oracle
- `POST /api/test-oracle` - Força teste de conectividade
- `POST /api/reset-oracle-status` - Reset do monitor (admin)

## Como Funciona

### Fluxo Normal
1. Sistema tenta conectar ao Oracle
2. Se sucesso, executa operação normalmente
3. Monitor registra sucesso

### Fluxo com Falha Oracle
1. Sistema detecta erro Oracle
2. Executa retry com backoff exponencial (2 tentativas)
3. Se falha persiste, usa query de fallback
4. Monitor registra falha e atualiza status
5. Após 3 falhas consecutivas, marca Oracle como "down"
6. Sistema continua funcionando com limitações

### Recuperação Automática
1. Monitor continua testando Oracle a cada 5 minutos
2. Quando Oracle volta, status é automaticamente resetado
3. Sistema volta ao funcionamento normal

## Benefícios

- ✅ **Zero Downtime**: Sistema nunca para por problemas Oracle
- ✅ **Fallback Inteligente**: Usa dados locais quando necessário
- ✅ **Monitoramento Proativo**: Detecta e alerta sobre problemas
- ✅ **Recuperação Automática**: Volta ao normal quando Oracle reconecta
- ✅ **Visibilidade**: Endpoints para monitorar saúde do sistema

## Monitoramento

### Logs do Sistema
```bash
# Oracle funcionando
✅ Conexão Oracle bem-sucedida

# Oracle com problema
⚠️ Erro Oracle detectado (tentativa 1/2): Cannot get the data...
🔄 Usando query de fallback...
✅ Fallback executado com sucesso

# Oracle indisponível
⚠️ Oracle linked server indisponível após múltiplas tentativas
```

### Health Check
```bash
# Verificar status geral
curl http://localhost:3057/api/health

# Verificar apenas Oracle
curl http://localhost:3057/api/oracle-status

# Forçar teste Oracle
curl -X POST http://localhost:3057/api/test-oracle
```

## Configuração

O sistema funciona automaticamente, mas pode ser configurado via variáveis de ambiente:

```env
# Intervalo de verificação Oracle (padrão: 5 minutos)
ORACLE_CHECK_INTERVAL=*/5 * * * *

# Máximo de falhas antes de marcar como down (padrão: 3)
ORACLE_MAX_FAILURES=3

# Timeout para queries Oracle (padrão: 30s)
ORACLE_QUERY_TIMEOUT=30000
```

## Impacto nas Funcionalidades

### Com Oracle Funcionando
- Avaliações criadas com dados precisos da TAB_HIST_SRA
- Hierarquia completa disponível
- Sincronização total de funcionários

### Com Oracle Indisponível
- Avaliações criadas com dados locais (Users.created_at)
- Hierarquia limitada (sem gestores automáticos)
- Sistema continua operacional com funcionalidades essenciais

## Próximos Passos

1. **Notificações**: Implementar alertas por email/Slack quando Oracle fica indisponível
2. **Dashboard**: Criar painel visual para monitorar conectividade
3. **Métricas**: Coletar estatísticas de uptime/downtime Oracle
4. **Cache**: Implementar cache de dados Oracle para reduzir dependência