# Feature Specification: Credit Card Billing — Lancamentos de Cartao no Regime de Caixa

**Feature Branch**: `20260218-credit-card-billing`
**Created**: 2026-02-18
**Status**: Draft
**Input**: Permitir que despesas de cartao de credito sejam importadas e gerenciadas no regime de caixa, onde cada lancamento individual preserva sua data original de compra e categoria, mas todos os lancamentos de uma mesma fatura sao vinculados a data de pagamento da fatura. A data original da compra fica visivel na lista com badge indicando vinculo ao cartao.

## Contexto e Motivacao

O usuario opera no regime de caixa: cada lancamento e registrado na data em que o dinheiro efetivamente sai ou entra. Para gastos no cartao de credito, a saida de caixa ocorre na data de pagamento da fatura — nao na data da compra individual.

Porem, o usuario precisa manter a granularidade: cada compra com sua categoria e descricao, para fins de estatisticas e controle. A data original da compra deve ser preservada e visivel, mas a data de realizacao para fins de saldos e somatorios e a data de pagamento da fatura.

**Modelo conceitual (regime de caixa)**:

```
Fatura de Fevereiro (paga em 08/02/2026)
──────────────────────────────────────────────────────────────────
Compra          Data compra  Categoria      Valor   Realizacao
Supermercado    15/01        Alimentacao    2.500   08/02 (fatura)
Restaurante     22/01        Alimentacao    1.200   08/02 (fatura)
Combustivel     28/01        Transporte       800   08/02 (fatura)
Farmacia        01/02        Saude            600   08/02 (fatura)
Streaming       02/02        Assinaturas      150   08/02 (fatura)
──────────────────────────────────────────────────────────────────
Total fatura:                              5.250
```

- Cada item preserva sua **data original** (visivel na listagem).
- Todos compartilham a mesma **data de realizacao** (pagamento da fatura).
- Todos pertencem ao **periodo** do pagamento (fevereiro).
- Estatisticas: R$3.700 em Alimentacao, R$800 em Transporte, etc.
- Saldo do periodo: reflete o fluxo de caixa real.

**Relacao com outras specs**:
- `20260218-smart-import` (parcelamento): complementar — parcelas detectadas em CSV de cartao tambem recebem vinculo a fatura.
- `20260217-import-finishing` (importador v1): esta spec estende o importador com campo de data de pagamento da fatura.

---

## User Scenarios & Testing

### User Story 1 — Vincular Lancamentos a uma Fatura de Cartao (Priority: P1)

O usuario importa um CSV de cartao de credito e informa a data de pagamento da fatura. Todos os lancamentos importados sao vinculados a essa fatura: recebem a data de pagamento como `settled_at`, sao alocados no periodo correspondente e carregam um indicador visual de que pertencem a um cartao de credito.

**Why this priority**: Sem esta capacidade, o usuario nao consegue reproduzir no sistema o fluxo de caixa que hoje faz na planilha. E o requisito fundamental da feature.

**Independent Test**: Importar CSV de cartao com 5 lancamentos, informar data de pagamento 08/02/2026. Verificar que todos os lancamentos aparecem no periodo de fevereiro, com `settled_at = 2026-02-08`, badge de cartao visivel e data original preservada.

**Acceptance Scenarios**:

1. **Given** o usuario esta na tela de importacao e selecionou um arquivo CSV de cartao, **When** o sistema detecta que e um arquivo de cartao (pelo nome contendo "fatura", "cartao" ou "card"), **Then** exibe automaticamente o campo "Data de pagamento da fatura" para preenchimento.

2. **Given** o usuario preencheu a data de pagamento como 08/02/2026, **When** confirma a importacao, **Then** todos os lancamentos sao inseridos com `settled_at = 2026-02-08`, `status = 'settled'`, `is_credit_card = true` e `credit_card_bill_date = 2026-02-08`.

3. **Given** o usuario preencheu a data de pagamento 08/02/2026, **When** o periodo do pagamento (fevereiro 2026) nao existe, **Then** o sistema cria automaticamente o periodo fiscal antes de inserir os lancamentos.

4. **Given** o usuario preencheu a data de pagamento 08/02/2026, **When** o periodo existe mas esta fechado (`closed_at` preenchido), **Then** o sistema exibe erro: "O periodo de fevereiro de 2026 esta fechado. Reabra-o antes de importar."

5. **Given** o CSV contem lancamentos com datas de 02/01 a 03/02, **When** o usuario confirma a importacao com data de fatura 08/02, **Then** todos os lancamentos vao para o periodo de fevereiro (independente da data original de compra), com a data original preservada no campo `planned_date`.

---

### User Story 2 — Exibir Badge de Cartao na Listagem (Priority: P1)

Na lista de lancamentos, transacoes vinculadas a cartao de credito exibem um badge discreto indicando "Cartao" e a data de pagamento da fatura. A data original da compra permanece visivel como a data principal do lancamento.

**Why this priority**: Sem indicacao visual, o usuario nao distingue lancamentos de cartao dos demais, perdendo a rastreabilidade que tinha na planilha.

**Independent Test**: Criar lancamento com `is_credit_card = true` e `credit_card_bill_date = 2026-02-08`. Verificar que na lista aparece a data original da compra e um badge "Cartao - pago em 08/02".

**Acceptance Scenarios**:

1. **Given** a lista de lancamentos contem transacoes normais e de cartao, **When** renderiza, **Then** transacoes de cartao exibem um badge com icone de cartao e texto "pago em DD/MM" ao lado da descricao ou da data.

2. **Given** o usuario filtra por status "settled", **When** existem lancamentos normais realizados e lancamentos de cartao realizados, **Then** ambos aparecem, com o badge diferenciando os de cartao.

3. **Given** a visualizacao esta em modo board, **When** cards de cartao sao exibidos, **Then** o badge de cartao e visivel no card.

---

### User Story 3 — Data de Realizacao para Somatorios (Priority: P1)

Para fins de calculo de saldo do periodo (`period_balances`), lancamentos de cartao usam a data de pagamento da fatura (`settled_at`) como data de realizacao. A data original da compra (`planned_date`) e preservada como referencia mas nao afeta os somatorios do periodo.

**Why this priority**: Este e o mecanismo que garante o regime de caixa — o dinheiro so "sai" no dia do pagamento da fatura.

**Independent Test**: Inserir 3 lancamentos de cartao com datas de compra em janeiro e pagamento em fevereiro. Verificar que `period_balances` de fevereiro inclui esses valores e `period_balances` de janeiro nao.

**Acceptance Scenarios**:

1. **Given** 3 lancamentos de cartao com datas de compra em janeiro e `settled_at = 2026-02-08`, alocados no periodo de fevereiro, **When** `period_balances` e recalculado, **Then** fevereiro inclui os R$5.250 no `expense_total` e janeiro nao.

2. **Given** o usuario visualiza o dashboard do periodo de fevereiro, **When** os totais sao exibidos, **Then** o total de despesas inclui as despesas do cartao somadas as demais despesas do periodo.

3. **Given** lancamento de cartao com status `planned` (fatura prevista mas ainda nao paga), **When** `period_balances` e calculado, **Then** o lancamento e tratado conforme regras existentes para `planned` (nao excluido do periodo, apenas sem `settled_at`).

---

### User Story 4 — Criacao Manual de Lancamento de Cartao (Priority: P2)

O usuario pode criar manualmente um lancamento marcado como cartao de credito, informando a data da compra e a data de pagamento da fatura. Isso permite registrar gastos de cartao sem depender de importacao CSV.

**Why this priority**: Complementa US1 para cenarios onde o usuario nao importa CSV (lancamento manual). Menor prioridade porque o fluxo principal e via importacao.

**Independent Test**: Criar lancamento manual marcando checkbox "Cartao de credito", informar data da compra e data de pagamento. Verificar que o lancamento e salvo com os campos corretos e aparece com badge.

**Acceptance Scenarios**:

1. **Given** o usuario abre o formulario de novo lancamento, **When** marca "Cartao de credito", **Then** aparece campo adicional "Data de pagamento da fatura" (obrigatorio).

2. **Given** o usuario preencheu: descricao "Jantar", valor 200, data da compra 20/01, data de pagamento 08/02, **When** salva, **Then** o lancamento e criado no periodo de fevereiro, com `planned_date = 2026-01-20`, `settled_at = 2026-02-08`, `is_credit_card = true`, `credit_card_bill_date = 2026-02-08`, status `settled`.

3. **Given** o usuario quer registrar uma despesa de cartao prevista (fatura nao paga ainda), **When** marca "Cartao de credito" e nao preenche data de pagamento, **Then** o lancamento e criado com status `planned`, `is_credit_card = true`, sem `settled_at`.

---

### User Story 5 — Importar Extrato Bancario com Deteccao de Pagamento de Fatura (Priority: P2)

Ao importar um extrato bancario (nao de cartao), o sistema detecta linhas que representam pagamento de fatura de cartao (por padroes no nome como "FATURA", "CARTAO", "VISA", "MASTERCARD", "NUBANK") e sugere marca-las como `transfer` para evitar double-counting.

**Why this priority**: Previne o problema de contagem dupla quando ambos os CSVs (banco e cartao) sao importados. Menor prioridade porque o usuario pode fazer manualmente, e muitos usuarios so importam o CSV do cartao.

**Independent Test**: Importar CSV bancario contendo linha "PGTO FATURA NUBANK R$5.250". Verificar que na preview a linha e sugerida como `transfer` com badge de aviso.

**Acceptance Scenarios**:

1. **Given** CSV bancario com linha "PGTO FATURA NUBANK" valor R$5.250, **When** preview e gerada, **Then** a linha aparece com tipo sugerido `transfer` e status `warning` com mensagem "Detectado como pagamento de fatura de cartao. Marcar como transferencia evita contagem dupla."

2. **Given** o usuario discorda da sugestao, **When** altera o tipo manualmente para `expense`, **Then** o sistema aceita a alteracao e importa como despesa normal.

3. **Given** CSV bancario sem nenhum padrao de pagamento de cartao, **When** preview e gerada, **Then** nenhuma linha recebe sugestao de `transfer`.

---

### User Story 6 — Tipo de Transacao `transfer` (Priority: P2)

O sistema suporta um novo tipo de transacao `transfer` que representa movimentacao entre contas proprias (como pagamento de fatura de cartao). Transacoes do tipo `transfer` sao excluidas dos somatorios de receita, despesa e saldo.

**Why this priority**: Necessario para US5, mas tambem util como infra para futuras funcionalidades (transferencia entre contas, pagamento de emprestimo, etc.). P2 porque no regime de caixa puro com importacao apenas de cartao, o `transfer` nao e estritamente necessario — so quando ambos CSVs sao importados.

**Independent Test**: Criar transacao do tipo `transfer`. Verificar que `period_balances` nao a inclui em nenhum total. Verificar que a view `v_period_totals` a ignora.

**Acceptance Scenarios**:

1. **Given** transacao do tipo `transfer` com valor R$5.250 no periodo de fevereiro, **When** `period_balances` e recalculado, **Then** `income_total`, `expense_total` e `net_result` permanecem inalterados.

2. **Given** lista de lancamentos com filtro de tipo, **When** usuario filtra por "Transferencias", **Then** apenas transacoes do tipo `transfer` aparecem.

3. **Given** dashboard com grafico de receitas vs despesas, **When** existem transacoes `transfer`, **Then** elas nao aparecem no grafico.

---

### Edge Cases

- **CSV de cartao sem data de pagamento informada**: O sistema DEVE bloquear a importacao e exibir mensagem pedindo a data. Nao importar sem vinculo a fatura.
- **Data de pagamento anterior a data de compra**: Valido — pode ocorrer quando o usuario paga a fatura antes do vencimento ou quando ha estorno.
- **Fatura com valor zero**: Valido — o usuario pode ter creditos que anulam as compras.
- **Multiplas faturas no mesmo periodo**: Valido — usuario pode ter 2+ cartoes, cada um com sua data de pagamento. Lancamentos de faturas diferentes coexistem no mesmo periodo.
- **Edicao da data de pagamento apos importacao**: O usuario PODE alterar a data de pagamento de lancamentos ja importados. Isso DEVE reavaliar o periodo e mover lancamentos se necessario.
- **Lancamento de cartao sem categoria**: Segue o fluxo existente — status `sem_categoria` na preview, bloqueado ate categorizar.
- **Periodo da fatura vs periodo da compra**: No regime de caixa, se a compra e em janeiro e o pagamento em fevereiro, o lancamento fica em fevereiro. Se o usuario mudar para regime de competencia no futuro, a `planned_date` (data da compra) permitira realocar.
- **Import de extrato bancario com pagamento de fatura quando nao existe cartao vinculado**: O sistema sugere `transfer` mas o usuario decide; nao bloqueia.
- **Cancelamento/estorno de compra no cartao**: Importado como lancamento de tipo `income` (credito) vinculado ao cartao e a mesma fatura.

---

## Design e Visual Identity

### Badge de Cartao de Credito

- **Formato**: Pill compacta ao lado da descricao ou abaixo da data.
- **Conteudo**: Icone de cartao (SVG inline, 14px) + texto "pago em DD/MM".
- **Cores**: Fundo `var(--accent-soft)` (#f1e4d8), texto `var(--accent)` (#7b3f12), borda `var(--line)` (#ddd2c3).
- **Tipografia**: `0.75rem`, font-weight 500.
- **Radius**: `var(--radius-sm)` (10px).

### Campo de Data de Pagamento na Importacao

- **Posicao**: Abaixo do seletor de arquivo, visivel apenas quando detectado como CSV de cartao.
- **Label**: "Data de pagamento da fatura".
- **Input**: Date picker nativo (`<input type="date">`), com placeholder "DD/MM/AAAA".
- **Validacao**: Campo obrigatorio quando importando CSV de cartao. Borda `var(--danger)` (#a0362b) se nao preenchido ao tentar confirmar.

### Checkbox de Cartao no Formulario Manual

- **Posicao**: Abaixo do campo de tipo (income/expense).
- **Label**: "Lancamento de cartao de credito".
- **Comportamento**: Quando marcado, exibe campo de data de pagamento da fatura.
- **Visual**: Checkbox padrao do sistema com label inline.

### Indicador de Transfer na Preview

- **Formato**: Pill com icone de setas bidirecionais + texto "Transferencia".
- **Cores**: Fundo `var(--surface-soft)` (#f6efe6), texto `var(--ink-secondary)` (#6f6257).

---

## Requirements

### Functional Requirements

#### Modelo de Dados

- **FR-001**: A tabela `transactions` DEVE receber novos campos: `is_credit_card boolean DEFAULT false NOT NULL` e `credit_card_bill_date date NULL`.
- **FR-002**: O campo `credit_card_bill_date` DEVE ser NOT NULL quando `is_credit_card = true` e `status = 'settled'`. Constraint CHECK: `NOT (is_credit_card AND status = 'settled' AND credit_card_bill_date IS NULL)`.
- **FR-003**: O enum `transaction_type` DEVE ser estendido com o valor `'transfer'`.
- **FR-004**: Os campos novos DEVEM ser nullable/defaulted de forma a nao impactar transacoes existentes.
- **FR-005**: O `schema_snapshot.sql` DEVE ser atualizado com os novos campos e constraints.

#### Calculo de Saldos

- **FR-006**: A funcao `refresh_period_balances()` DEVE excluir transacoes do tipo `transfer` de todos os somatorios (income_total, expense_total, investment_total, net_result).
- **FR-007**: A view `v_period_totals` DEVE excluir transacoes do tipo `transfer` dos calculos.
- **FR-008**: A view `v_period_totals_by_status` DEVE excluir transacoes do tipo `transfer`.

#### Importacao de CSV de Cartao

- **FR-009**: O importador DEVE detectar CSVs de cartao pelo nome do arquivo (padroes: "fatura", "cartao", "card", "credit") e exibir o campo de data de pagamento da fatura.
- **FR-010**: Ao confirmar importacao de CSV de cartao, todos os lancamentos DEVEM receber: `is_credit_card = true`, `credit_card_bill_date = <data informada>`, `settled_at = <data informada>`, `status = 'settled'`.
- **FR-011**: A data original da compra (do CSV) DEVE ser armazenada no campo `planned_date` do lancamento.
- **FR-012**: O `period_id` dos lancamentos importados DEVE ser o periodo que contem a data de pagamento da fatura, nao o periodo da data da compra.
- **FR-013**: Se o periodo da fatura nao existir, o sistema DEVE cria-lo automaticamente.
- **FR-014**: Se o periodo da fatura estiver fechado, o sistema DEVE exibir erro e bloquear a importacao.

#### Importacao de Extrato Bancario

- **FR-015**: Ao importar extrato bancario (nao-cartao), o sistema DEVE detectar linhas com padroes de pagamento de fatura (regex: `/fatura|pgto\s*cart|nubank|visa\s*payment|mastercard|pagamento.*cartao/i`) e sugerir tipo `transfer`.
- **FR-016**: O usuario PODE aceitar ou rejeitar a sugestao de `transfer` por linha.

#### Exibicao

- **FR-017**: A lista de lancamentos DEVE exibir badge de cartao de credito para transacoes com `is_credit_card = true`, contendo a data de pagamento formatada.
- **FR-018**: O board DEVE exibir badge de cartao nos cards de transacoes vinculadas.
- **FR-019**: A data principal exibida na lista para lancamentos de cartao DEVE ser a data original da compra (`planned_date`), nao a `settled_at`.

#### Formulario Manual

- **FR-020**: O formulario de criacao/edicao de lancamento DEVE incluir checkbox "Lancamento de cartao de credito" visivel para lancamentos do tipo `expense`.
- **FR-021**: Quando o checkbox esta marcado, o campo "Data de pagamento da fatura" DEVE aparecer e ser obrigatorio para status `settled`.
- **FR-022**: Ao salvar lancamento de cartao com status `settled`, o sistema DEVE atribuir `period_id` ao periodo da data de pagamento da fatura.

#### Seguranca e Multi-tenant

- **FR-023**: Todos os novos campos DEVEM respeitar as policies RLS existentes — nenhuma policy adicional e necessaria pois os campos sao colunas da tabela `transactions` ja protegida.
- **FR-024**: O auto-create de periodo fiscal (FR-013) DEVE respeitar `workspace_id` e verificar permissao de escrita.

### Key Entities

- **Credit Card Transaction**: Transacao com `is_credit_card = true`. Preserva `planned_date` como data original da compra e `settled_at`/`credit_card_bill_date` como data de pagamento. Pertence ao periodo fiscal do pagamento.
- **Transfer**: Novo tipo de transacao (`type = 'transfer'`) excluido de todos os somatorios. Representa movimentacao entre contas proprias (ex.: pagamento de fatura no extrato bancario).
- **Fatura (conceito logico)**: Agrupamento de transacoes de cartao com mesma `credit_card_bill_date`. Nao e uma entidade persistida — e um agrupamento derivado por query. Pode se tornar entidade propria em evolucao futura (quando houver gestao de multiplos cartoes).

---

## Implementation Order

1. **Migracao SQL** (FR-001 a FR-005): adicionar campos e enum value. Base para tudo.
2. **Calculo de saldos** (FR-006 a FR-008): ajustar trigger e views. Essencial antes de inserir dados.
3. **Importacao de cartao** (FR-009 a FR-014): fluxo principal da feature.
4. **Exibicao** (FR-017 a FR-019): badge e ajustes visuais.
5. **Formulario manual** (FR-020 a FR-022): criacao/edicao manual.
6. **Deteccao de transfer no extrato** (FR-015 a FR-016): complemento para double-counting.

---

## Out of Scope

- **Gestao de multiplos cartoes**: Nesta versao, nao ha cadastro de cartoes como entidades. O vinculo e apenas pela data de pagamento. Cartoes como entidade ficam para evolucao futura.
- **Regime de competencia**: Nesta versao, apenas regime de caixa. Suporte a competencia e evolucao futura (a estrutura de `planned_date` + `settled_at` ja facilita).
- **Conciliacao automatica banco x cartao**: Matching automatico entre pagamento no extrato e total da fatura nao faz parte deste escopo.
- **Limite de credito e saldo do cartao**: Nao ha controle de limite ou saldo devedor do cartao.
- **Fatura como entidade persistida**: A fatura e um agrupamento logico, nao uma tabela.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Lancamentos importados de CSV de cartao devem aparecer no periodo correto (periodo do pagamento da fatura), com 100% de acuracia na alocacao de periodo.
- **SC-002**: A soma de lancamentos de cartao vinculados a uma fatura deve ser igual ao valor total pago, verificavel por query `SUM(amount) WHERE credit_card_bill_date = X`.
- **SC-003**: Transacoes do tipo `transfer` devem ter impacto zero nos totais de `period_balances` (income, expense, investment, net_result).
- **SC-004**: O badge de cartao deve ser visivel em 100% dos lancamentos com `is_credit_card = true` tanto em modo lista quanto board.
- **SC-005**: O build do projeto deve passar sem erros TypeScript apos todas as alteracoes.
- **SC-006**: A importacao de CSV de cartao com 100+ linhas deve completar em menos de 5 segundos.
