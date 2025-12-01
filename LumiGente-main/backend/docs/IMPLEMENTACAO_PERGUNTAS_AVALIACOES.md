# Implementação: Nova Pergunta e Edição de Templates de Avaliações

## Resumo
Sistema completo para gerenciamento de perguntas nos templates de avaliações (45 e 90 dias), permitindo criar, editar, reordenar e excluir perguntas com suporte a múltiplos tipos.

## Tipos de Perguntas Suportados

### 1. Texto Livre
- Resposta aberta em formato de texto
- Sem validações específicas

### 2. Múltipla Escolha
- Lista de opções pré-definidas
- Usuário seleciona uma opção
- Opções armazenadas no banco

### 3. Escala
- Valores numéricos de mínimo a máximo
- Labels personalizáveis para extremos
- Exemplo: 1 (Discordo totalmente) a 5 (Concordo totalmente)

### 4. Sim/Não
- Resposta binária
- Interface simplificada

## Backend

### Rotas Implementadas

```javascript
// Buscar perguntas do template
GET /api/avaliacoes/templates/:tipo/perguntas

// Adicionar nova pergunta
POST /api/avaliacoes/templates/:tipo/perguntas

// Atualizar pergunta existente
PUT /api/avaliacoes/templates/:tipo/perguntas/:id

// Excluir pergunta
DELETE /api/avaliacoes/templates/:tipo/perguntas/:id

// Reordenar perguntas
PUT /api/avaliacoes/templates/:tipo/perguntas/reordenar
```

### Estrutura de Dados

```javascript
{
  pergunta: string,           // Texto da pergunta
  tipoPergunta: string,       // 'texto', 'multipla_escolha', 'escala', 'sim_nao'
  obrigatoria: boolean,       // Se a pergunta é obrigatória
  escalaMinima: number,       // Apenas para tipo 'escala'
  escalaMaxima: number,       // Apenas para tipo 'escala'
  escalaLabelMinima: string,  // Label do valor mínimo
  escalaLabelMaxima: string   // Label do valor máximo
}
```

### Tabela do Banco de Dados

```sql
TemplatesPerguntasAvaliacao
- Id (PK)
- TipoAvaliacaoId (FK) -- 1 = 45 dias, 2 = 90 dias
- Pergunta (NTEXT)
- TipoPergunta (VARCHAR)
- Ordem (INT)
- Obrigatoria (BIT)
- EscalaMinima (INT)
- EscalaMaxima (INT)
- EscalaLabelMinima (NVARCHAR)
- EscalaLabelMaxima (NVARCHAR)
- Ativa (BIT)
- CriadoEm (DATETIME)
```

## Frontend

### Arquivos Modificados

1. **index.html**
   - Modal de Nova/Editar Pergunta
   - Campos dinâmicos para cada tipo

2. **avaliacoes-templates.js**
   - Gerenciamento completo de perguntas
   - Drag & drop para reordenação
   - CRUD de perguntas

3. **avaliacoes.css**
   - Estilos para modal e lista de perguntas
   - Visual drag & drop

4. **event-handlers.js**
   - Delegação de eventos para ações

### Funcionalidades do Frontend

#### Modal de Pergunta
- Campos:
  - Texto da pergunta (textarea)
  - Tipo de pergunta (select)
  - Obrigatória (select)
  - Campos de escala (condicionais)

#### Lista de Perguntas
- Visualização ordenada
- Badges coloridos por tipo
- Ações: Editar e Excluir
- Drag & drop para reordenar

#### Validações
- Texto da pergunta obrigatório
- Escala: mínimo < máximo
- Confirmação antes de excluir

## Fluxo de Uso

### Criar Nova Pergunta
1. Clicar em "Editar Templates"
2. Selecionar template (45 ou 90 dias)
3. Clicar em "Nova Pergunta"
4. Preencher formulário
5. Salvar

### Editar Pergunta
1. Clicar no ícone de edição
2. Modificar campos
3. Salvar alterações

### Reordenar Perguntas
1. Arrastar pergunta pela handle
2. Soltar na nova posição
3. Ordem salva automaticamente

### Excluir Pergunta
1. Clicar no ícone de lixeira
2. Confirmar exclusão
3. Lista atualizada automaticamente

## Segurança

### Controle de Acesso
- Apenas RH, T&D e DEPARTAMENTO ADM/RH/SESMT
- Validação no backend via middleware
- Função: `verificarPermissaoAvaliacoesAdmin()`

### Validações
- Sanitização de inputs
- Validação de tipos
- Proteção contra SQL Injection (parametrização)

## Melhorias Futuras

1. **Opções de Múltipla Escolha**
   - Interface para gerenciar opções
   - Tabela separada: `OpcoesTemplatesPerguntasAvaliacao`

2. **Pré-visualização**
   - Visualizar como a pergunta aparecerá
   - Testar diferentes tipos

3. **Duplicação de Perguntas**
   - Copiar pergunta existente
   - Facilitar criação de variações

4. **Histórico de Alterações**
   - Rastrear modificações
   - Auditoria de mudanças

5. **Templates Personalizados**
   - Criar templates além de 45/90 dias
   - Templates por departamento

## Testes Recomendados

### Backend
- [ ] Criar pergunta de cada tipo
- [ ] Editar pergunta existente
- [ ] Excluir pergunta
- [ ] Reordenar perguntas
- [ ] Validar permissões de acesso

### Frontend
- [ ] Abrir modal de nova pergunta
- [ ] Alternar entre tipos de pergunta
- [ ] Campos de escala aparecem/desaparecem
- [ ] Drag & drop funciona
- [ ] Validações de formulário
- [ ] Mensagens de erro/sucesso

### Integração
- [ ] Perguntas aparecem nas avaliações
- [ ] Respostas são salvas corretamente
- [ ] Ordem das perguntas é respeitada
- [ ] Perguntas obrigatórias são validadas

## Notas Técnicas

- Utiliza Lucide Icons para ícones
- Drag & drop nativo HTML5
- API RESTful
- Validação client-side e server-side
- Responsivo para mobile

## Contato
Para dúvidas ou suporte: ti.sistemas@lumicenter.com
