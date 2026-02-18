# Feature Specification: Smart Import — Sugestao por Historico e Parcelamento

**Feature Branch**: `20260217-import-finishing`
**Created**: 2026-02-18
**Status**: Draft
**Input**: Melhorar sugestao de categoria com base no historico de transacoes do usuario e detectar parcelamentos no CSV para lancar parcelas em meses futuros.

## Contexto e Motivacao

Hoje o importador sugere categorias usando `suggestCategoryId()`, que compara tokens do nome/codigo da categoria com a descricao da transacao. Esse metodo falha quando:
- A descricao nao contem tokens da categoria (ex.: "TmkLocacoesLtda" nao bate com "Restaurantes").
- O usuario ja categorizou transacoes identicas no passado, mas esse historico e ignorado.

Alem disso, faturas de cartao frequentemente trazem compras parceladas (ex.: "Globo Combo RJ BRA PARC 03/12"). Hoje cada parcela e importada individualmente no mes corrente, sem projecao das parcelas vincendas nos meses subsequentes.

---

## User Scenarios & Testing

### User Story 1 — Sugestao de Categoria por Historico (Priority: P1)

Ao importar um arquivo CSV/OFX, o sistema consulta as transacoes anteriores do workspace para encontrar descricoes identicas ou muito similares. Se encontrar, sugere a mesma categoria que o usuario atribuiu anteriormente — prevalecendo sobre a sugestao por tokens.

**Why this priority**: Resolve diretamente o problema reportado (TmkLocacoesLtda sugerida como "Outros transporte" quando o usuario ja a classificou como "Restaurantes"). Impacto imediato na precisao da categorizacao automatica, menos trabalho manual no preview.

**Independent Test**: Criar uma transacao manual com descricao "TmkLocacoesLtda" na categoria "Restaurantes". Importar CSV com mesma descricao. Verificar que a categoria sugerida e "Restaurantes" e nao a inferida por tokens.

**Acceptance Scenarios**:

1. **Given** o workspace tem 3 transacoes passadas com descricao normalizada "dl uberrides sao paulo bra" na categoria "Transporte por aplicativo", **When** importa CSV com linha "DL UberRides Sao Paulo BRA", **Then** a categoria sugerida e "Transporte por aplicativo".

2. **Given** o workspace nao tem transacoes passadas com descricao similar, **When** importa CSV com linha "Nova Loja XYZ", **Then** o fallback continua sendo a sugestao por tokens (`suggestCategoryId` atual).

3. **Given** o workspace tem transacoes passadas para "Globo Combo" com categorias diferentes (2x "Streaming", 1x "Outros"), **When** importa CSV com "Globo Combo RJ BRA", **Then** a categoria sugerida e "Streaming" (maioria / mais recente).

4. **Given** o workspace tem uma transacao passada na categoria "Alimentacao" que foi soft-deleted (`deleted_at` preenchido), **When** importa CSV com mesma descricao, **Then** o sistema ignora essa categoria e usa o proximo melhor match.

---

### User Story 2 — Deteccao de Parcelamento na Preview (Priority: P1)

O parser de importacao detecta padroes de parcelamento na descricao (ex.: "PARC 03/12", "PARCELA 3 DE 12", "3/12") e exibe na preview a informacao de parcela atual e total.

**Why this priority**: Pre-requisito para US3 (lancamento de parcelas futuras). Sem a deteccao, nao ha o que projetar.

**Independent Test**: Importar CSV com linha contendo "Globo Combo RJ BRA PARC 03/12". Verificar que a preview mostra "3/12" na coluna de parcela e que as parcelas sao agrupadas visualmente.

**Acceptance Scenarios**:

1. **Given** CSV com linha "Globo Combo RJ BRA PARC 03/12 R$ 59,90", **When** preview e gerada, **Then** a linha mostra `parcela: 3`, `totalParcelas: 12` e a descricao limpa e "Globo Combo RJ BRA".

2. **Given** CSV com linha "Supermercado Atacadao R$ 150,00" (sem padrao de parcela), **When** preview e gerada, **Then** `installmentNumber` e `installmentTotal` sao `null`.

3. **Given** CSV com linha "MAPFRE SEGUROS SAO PAULO BRA 05/10", **When** preview e gerada, **Then** detecta parcela 5 de 10.

4. **Given** CSV com linha "Pagamento pix 12/02/2026", **When** preview e gerada, **Then** nao detecta como parcelamento (e uma data, nao parcela). O sistema distingue datas de parcelamentos pelo contexto (posicao no texto, presenca de palavras-chave, formato).

---

### User Story 3 — Lancamento de Parcelas Vincendas (Priority: P2)

Ao confirmar a importacao de uma linha com parcelamento detectado, o sistema pergunta se o usuario deseja projetar as parcelas restantes nos meses subsequentes. Se sim, cria transacoes com status "planned" nos periodos futuros correspondentes.

**Why this priority**: Depende de US2 para deteccao. Envolve criacao de periodos futuros e insercao cross-period, aumentando a complexidade. Entrega alto valor ao eliminar trabalho repetitivo mensal.

**Independent Test**: Importar CSV com "Globo Combo PARC 03/12". Confirmar importacao com projecao ativada. Verificar que os meses 04 a 12 recebem transacoes "planned" com a mesma categoria e valor.

**Acceptance Scenarios**:

1. **Given** importacao com parcelamento 3/12, data 2026-01-15, valor R$ 59,90, categoria "Streaming", **When** usuario confirma com projecao, **Then** o sistema cria 9 transacoes (parcelas 4 a 12) distribuidas nos 9 meses seguintes (2026-02 a 2026-10), cada uma com status "planned", mesmo valor e categoria, descricao indicando o numero da parcela.

2. **Given** importacao com parcelamento 3/12, **When** usuario confirma SEM projecao (opt-out), **Then** apenas a parcela corrente (3/12) e importada normalmente sem efeito colateral.

3. **Given** importacao com parcelamento 10/10, **When** preview e gerada, **Then** nao oferece projecao (e a ultima parcela, nao ha vincendas).

4. **Given** projecao de parcelas 4-12, onde o periodo 2026-05 ja esta fechado (`closed_at` preenchido), **When** confirma projecao, **Then** cria parcelas em todos os periodos abertos e reporta quais periodos foram ignorados por estarem fechados.

5. **Given** projecao de parcelas, **When** periodos futuros nao existem, **Then** o sistema auto-cria os periodos (`fiscal_periods.insert`) antes de inserir as transacoes.

---

### User Story 4 — Coluna de Parcela na Preview (Priority: P2)

A tabela de preview do importador mostra uma nova coluna "Parcela" que exibe "N/T" quando a linha tem parcelamento detectado, e um toggle global para ativar/desativar a projecao de vincendas.

**Why this priority**: Complemento visual para US2/US3. O usuario precisa ver o que foi detectado e controlar a projecao antes de confirmar.

**Independent Test**: Importar CSV misto (com e sem parcelamento). Verificar coluna "Parcela" visivel com valores corretos. Toggle de projecao funcional.

**Acceptance Scenarios**:

1. **Given** preview com 5 linhas normais e 2 com parcelamento, **When** tabela e renderizada, **Then** coluna "Parcela" mostra "3/12" e "5/10" nas linhas de parcelamento e "-" nas demais.

2. **Given** toggle de projecao esta ON, **When** usuario desliga, **Then** contagem de "Importar (N)" nao muda (parcelas correntes continuam sendo importadas), mas parcelas vincendas nao serao criadas.

3. **Given** todas as linhas com parcelamento sao a ultima parcela (ex.: 12/12), **When** preview e renderizada, **Then** toggle de projecao fica oculto (nao ha parcelas a projetar).

---

### Edge Cases

- **Descricoes muito curtas**: Descricoes com 3 ou menos caracteres devem ser ignoradas pelo historico (risco de false positives como "PIX").
- **Workspace sem historico**: Se nao ha transacoes passadas, o comportamento e identico ao atual (fallback para tokens).
- **Parcela 1/1**: Nao e parcelamento — ignorar.
- **Formatos de parcela variados**: Suportar ao menos: `PARC N/T`, `PARCELA N/T`, `PARCELA N DE T`, `N/T` no final da descricao, `(N/T)`.
- **Descricao com data E parcela**: "Globo Combo 12/02/2026 PARC 03/12" — deve detectar ambos corretamente.
- **Multiplas linhas do mesmo parcelamento**: Se o CSV traz parcela 3/12 e 4/12 do mesmo produto, projetar apenas parcelas nao presentes no arquivo (5/12 em diante).
- **Periodos fechados**: Parcelas futuras em periodos fechados sao ignoradas com aviso no resumo.
- **Volume de historico**: A consulta de historico deve ser limitada (ex.: ultimas 500 transacoes ou ultimos 6 meses) para performance.

---

## Requirements

### Functional Requirements

#### Sugestao por Historico

- **FR-001**: O sistema DEVE consultar transacoes passadas do workspace para encontrar descricoes que, quando normalizadas com `normalizeSearch()`, sejam identicas a descricao da linha importada.
- **FR-002**: A sugestao por historico DEVE ter prioridade sobre a sugestao por tokens (`suggestCategoryId`), mas menor prioridade que `categoryHint` do CSV.
- **FR-003**: O sistema DEVE agrupar as categorias historicas por frequencia e, em caso de empate, preferir a mais recente.
- **FR-004**: Categorias soft-deleted (`deleted_at IS NOT NULL`) DEVEM ser excluidas do historico.
- **FR-005**: A consulta de historico DEVE ser limitada as ultimas 500 transacoes do workspace para garantir performance.
- **FR-006**: A funcao `suggestCategoryId` DEVE receber o mapa de historico como parametro opcional, mantendo retrocompatibilidade.
- **FR-007**: O historico DEVE ser carregado uma unica vez ao abrir a preview (nao por linha), e reutilizado para todas as linhas do arquivo.

#### Deteccao de Parcelamento

- **FR-008**: O parser DEVE extrair `installmentNumber` e `installmentTotal` de descricoes contendo padroes como `PARC N/T`, `PARCELA N DE T`, `N/T` (quando no final da descricao e N < T).
- **FR-009**: O parser DEVE limpar a descricao removendo o trecho do parcelamento (ex.: "Globo Combo RJ BRA PARC 03/12" → "Globo Combo RJ BRA").
- **FR-010**: O parser NAO DEVE confundir datas (dd/mm/aaaa, dd/mm) com parcelamento. Heuristica: `N/T` so e parcelamento quando N <= T, T <= 72, e nao ha 4 digitos apos a barra.
- **FR-011**: `ParsedImportRow` DEVE ser estendido com campos opcionais `installmentNumber: number | null` e `installmentTotal: number | null`.

#### Lancamento de Parcelas Vincendas

- **FR-012**: O sistema DEVE oferecer um toggle "Projetar parcelas vincendas" na preview quando houver ao menos uma linha com parcelamento cuja parcela nao seja a ultima.
- **FR-013**: Ao confirmar importacao com projecao ativada, o sistema DEVE calcular quantas parcelas faltam (`installmentTotal - installmentNumber`) e criar transacoes nos periodos futuros.
- **FR-014**: Cada transacao projetada DEVE ter: mesma categoria, mesmo valor, descricao contendo o numero da parcela (ex.: "Globo Combo RJ BRA (parcela 4/12)"), status "planned", `planned_date` = primeiro dia do mes correspondente.
- **FR-015**: Se o periodo futuro nao existir, o sistema DEVE cria-lo automaticamente (insert em `fiscal_periods`).
- **FR-016**: Periodos futuros com `closed_at` preenchido DEVEM ser ignorados, e o resumo pos-importacao DEVE reportar quantas parcelas foram omitidas por periodo fechado.
- **FR-017**: Se o arquivo contem multiplas parcelas do mesmo parcelamento (ex.: 3/12 e 4/12), a projecao DEVE comecar da maior parcela + 1 e evitar duplicatas.
- **FR-018**: O toggle de projecao DEVE ser opt-in (default OFF) para evitar surpresas.

#### Migracao de Dados

- **FR-019**: DEVE ser criada migracao SQL adicionando `installment_number integer`, `installment_total integer` e `installment_group text` a tabela `transactions`.
- **FR-020**: O campo `installment_group` DEVE ser um identificador derivado (descricao normalizada + valor + total parcelas) para agrupar parcelas do mesmo parcelamento.
- **FR-021**: Os novos campos DEVEM ser nullable e nao impactar transacoes existentes.
- **FR-022**: O `schema_snapshot.sql` DEVE ser atualizado com os novos campos.

### Key Entities

- **CategoryHistory**: Mapa `normalizedDescription → { categoryId, count, lastUsedAt }` derivado das transacoes existentes do workspace. Nao e uma entidade persistida — e computado em runtime.
- **InstallmentInfo**: Dados extraidos do parser: `{ installmentNumber, installmentTotal, cleanDescription }`. Adicionado ao `ParsedImportRow`.
- **ProjectedInstallment**: Transacao criada em periodo futuro com referencia ao parcelamento original via `installment_group`.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Ao importar CSV com descricoes que ja foram categorizadas pelo usuario, 80%+ das sugestoes devem corresponder a categoria historica do usuario.
- **SC-002**: O parse de parcelamento deve detectar corretamente os formatos "PARC N/T", "PARCELA N DE T" e "N/T" trailing, com zero false positives em datas.
- **SC-003**: A projecao de parcelas vincendas deve criar o numero correto de transacoes futuras em periodos auto-criados, sem insercoes em periodos fechados.
- **SC-004**: A consulta de historico deve completar em menos de 200ms para workspaces com ate 2000 transacoes.
- **SC-005**: O build do projeto deve passar sem erros TypeScript apos todas as alteracoes.
