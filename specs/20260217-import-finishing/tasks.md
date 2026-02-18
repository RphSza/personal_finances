# Tasks: Acabamento do Importador CSV/OFX

**Input**: Design documents from `specs/20260217-import-finishing/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in all descriptions

---

## Phase 1: US1 - Controle de Status por Linha (P1) — MVP

**Goal**: Usuario pode alterar status de linhas individuais (ok/duplicada/cancelada) e apenas linhas com status "ok" sao importadas.

**Independent Test**: Importar CSV com duplicatas, alterar status de linhas, confirmar e verificar que apenas linhas "ok" foram inseridas.

**Covers**: FR-001, FR-002, FR-003, FR-004, FR-021, FR-022

### Implementation

- [x] T001 [US1] Definir tipo `ImportRowStatus` e adicionar campo `status` ao tipo `ImportPreviewRow` em `src/hooks/useImport.ts`
  - Novo tipo: `type ImportRowStatus = 'ok' | 'duplicada' | 'erro' | 'sem_categoria' | 'cancelada'`
  - Estender `ImportPreviewRow` com `status: ImportRowStatus`

- [x] T002 [US1] Inicializar `status` automaticamente no `previewFile()` em `src/hooks/useImport.ts`
  - Logica: `errorReason → 'erro'`, `isDuplicate → 'duplicada'`, `!categoryId → 'sem_categoria'`, senao `'ok'`

- [x] T003 [US1] Criar funcao `changeRowStatus()` no hook `src/hooks/useImport.ts`
  - Assinatura: `(rowIndex: number, dedupeKey: string, newStatus: ImportRowStatus) => void`
  - Respeitar regras de transicao (erro nao editavel)

- [x] T004 [US1] Atualizar `changeRowCategory()` para setar `status = 'ok'` quando categoria e atribuida a linha com status `sem_categoria` em `src/hooks/useImport.ts`
  - FR-003: transicao automatica sem_categoria → ok

- [x] T005 [US1] Refatorar derivados de estatisticas (`importReady`, `importDuplicates`, `importErrors`) para usar campo `status` explicito em `src/hooks/useImport.ts`
  - `importReady = rows.filter(r => r.status === 'ok' && r.categoryId).length`
  - `importDuplicates = rows.filter(r => r.status === 'duplicada').length`
  - etc.

- [x] T006 [US1] Atualizar `confirmMutation` para filtrar por `status === 'ok'` em vez de `!isDuplicate && !errorReason` em `src/hooks/useImport.ts`
  - Incluir contagem de `cancelada` no resumo do import_jobs

- [x] T007 [US1] Substituir pill de status por `<select>` editavel na coluna Status da tabela de preview em `src/features/entries/ImportModal.tsx`
  - Opcoes: ok, duplicada, cancelada
  - Desabilitar para linhas com status 'erro'
  - Chamar `imp.changeRowStatus()` no onChange

- [x] T008 [US1] Atualizar estatisticas no topo do modal para refletir status explicito em `src/features/entries/ImportModal.tsx`
  - Usar `imp.importReady`, `imp.importDuplicates`, etc. (ja refatorados em T005)
  - Adicionar contagem de canceladas se > 0

**Checkpoint**: Importar arquivo, alterar status de linhas, confirmar. Apenas linhas "ok" devem ser inseridas. Estatisticas atualizam em tempo real.

---

## Phase 2: US3 - Backdrop Blur e Disclosure Progressivo (P1)

**Goal**: Modal abre com fundo desfocado e mostra apenas area de upload ate arquivo ser selecionado.

**Independent Test**: Abrir modal vazio → so upload visivel. Selecionar arquivo → preview aparece.

**Covers**: FR-008, FR-009

### Implementation

- [x] T009 [P] [US3] Adicionar `backdrop-filter: blur(6px)` e ajustar background do `.modal-backdrop` em `src/styles.css`
  - Incluir `-webkit-backdrop-filter` para Safari
  - Reduzir opacidade de `rgba(18,13,9,0.78)` para `rgba(18,13,9,0.55)`

- [x] T010 [US3] Condicionar renderizacao do chip de formato, quick-category-box e botao Importar a `importPreviewRows.length > 0` em `src/features/entries/ImportModal.tsx`
  - Chip: renderizar somente se `imp.importFileName !== ""`
  - quick-category-box: somente se `importPreviewRows.length > 0`
  - Botao Importar: somente se `importPreviewRows.length > 0`

**Checkpoint**: Modal abre com blur. Sem arquivo: so upload. Com arquivo: chip + stats + tabela + botoes aparecem.

---

## Phase 3: US5 - Renomeacao de Botoes e Contagem (P2)

**Goal**: Botao primario mostra "Importar (N)" com contagem reativa; botao de fechar mostra "Voltar".

**Independent Test**: Abrir modal com preview, verificar textos dos botoes, alterar status e ver contagem atualizar.

**Covers**: FR-011, FR-012

**Depends on**: Phase 1 (T005 — importReady baseado em status)

### Implementation

- [x] T011 [US5] Renomear botao "Confirmar importacao" para `Importar ({importReady})` e "Fechar" para "Voltar" em `src/features/entries/ImportModal.tsx`
  - Desabilitar quando `importReady <= 0`
  - Mostrar "Importando..." com spinner durante submissao
  - "Limpar preview" visivel apenas quando ha preview

**Checkpoint**: Botao mostra "Importar (N)" reativo. "Voltar" no lugar de "Fechar". Desabilita com 0 linhas.

---

## Phase 4: US4 - Criacao Rapida de Categoria Recolhida (P2)

**Goal**: Secao de criacao rapida inicia recolhida com icone Plus, expande ao clicar.

**Independent Test**: Abrir modal com preview → campos ocultos. Clicar Plus → campos aparecem. Criar categoria → recolhe.

**Covers**: FR-010

### Implementation

- [x] T012 [US4] Adicionar estado `quickCategoryOpen` e logica de toggle na secao de criacao rapida em `src/features/entries/ImportModal.tsx`
  - Estado: `const [quickCategoryOpen, setQuickCategoryOpen] = useState(false)`
  - Header clicavel: icone Plus (fechado) / Minus (aberto) + label "Criar categoria rapida"
  - Campos e botao "Criar" visiveis somente quando `quickCategoryOpen === true`
  - Apos `createQuickCategory` com sucesso: `setQuickCategoryOpen(false)`

- [x] T013 [P] [US4] Adicionar estilos de animacao para expand/collapse da secao quick-category em `src/styles.css`
  - Transicao suave para altura (ou max-height com overflow hidden)

**Checkpoint**: Secao inicia recolhida. Plus expande, Minus recolhe. Criar categoria auto-recolhe.

---

## Phase 5: US8 - Highlight Visual por Status e Header Sticky (P2)

**Goal**: Linhas coloridas por status (erro=vermelho, duplicada=amarelo, cancelada=cinza). Header fixo ao scrollar.

**Independent Test**: Importar arquivo com variedade de status, verificar cores e scroll com header fixo.

**Covers**: FR-018, FR-019

**Depends on**: Phase 1 (T007 — `data-status` no `<tr>`)

### Implementation

- [x] T014 [US8] Adicionar atributo `data-status={row.status}` nos `<tr>` da tabela de preview em `src/features/entries/ImportModal.tsx`

- [x] T015 [P] [US8] Adicionar CSS de background por `data-status` e `thead th` sticky em `src/styles.css`
  - `tr[data-status="erro"]` → `#fdf0ee`
  - `tr[data-status="duplicada"]` → `#fdf6e8`
  - `tr[data-status="sem_categoria"]` → `#fdf6e8`
  - `tr[data-status="cancelada"]` → `#f3efea`
  - `tr[data-status="ok"]` → `#fff`
  - `thead th` → `position: sticky; top: 0; z-index: 2; background: var(--surface)`
  - Transicao suave: `transition: background 0.2s ease`

**Checkpoint**: Linhas com cores distintas por status. Header fixo ao scrollar. Transicao suave ao mudar status.

---

## Phase 6: US2 - Combobox Pesquisavel de Categorias (P1)

**Goal**: Substituir `<select>` nativo por combobox com busca por texto e subtexto de grupo.

**Independent Test**: Clicar na categoria de uma linha, digitar parte do nome, ver filtragem e grupo.

**Covers**: FR-005, FR-006, FR-007

### Implementation

- [x] T016 [US2] Criar componente `CategoryCombobox` em `src/components/CategoryCombobox.tsx`
  - Props: `categories`, `groups`, `value`, `onChange`, `transactionType`, `disabled`
  - Construir lista enriquecida com JOIN category → group (`groupName`, `groupSortOrder`)
  - Ordenar por `groupSortOrder ASC`, `categoryName ASC`
  - Priorizar categorias do `transactionType` correspondente
  - Input de busca com filtragem via `normalizeSearch()` de `src/lib/search.ts`
  - Renderizar nome principal + subtexto de grupo (font-size menor, cor muted)
  - Filtrar por nome E grupo (match em ambos)
  - Excluir categorias com `deleted_at` preenchido

- [x] T017 [US2] Implementar navegacao por teclado no `CategoryCombobox` em `src/components/CategoryCombobox.tsx`
  - Setas Up/Down para navegar opcoes
  - Enter para selecionar opcao destacada
  - Escape para fechar sem alterar
  - Atributos ARIA: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"` na lista

- [x] T018 [P] [US2] Adicionar estilos do combobox dropdown em `src/styles.css`
  - Container: `background: var(--surface-strong)`, `border: 1px solid var(--line)`, `border-radius: var(--radius-sm)`
  - Opcao hover/active: background accent-soft
  - Subtexto grupo: `font-size: 0.72rem`, `color: var(--ink-muted)`
  - Max-height com scroll interno
  - Posicionamento absoluto abaixo do input

- [x] T019 [US2] Substituir `<select>` nativo por `<CategoryCombobox>` na tabela de preview em `src/features/entries/ImportModal.tsx`
  - Passar `categories`, `groups` (obter groups das props — pode precisar adicionar ao ImportModalProps)
  - Manter logica de `categoryOptionsByType` dentro do combobox

**Checkpoint**: Combobox abre com busca. Digitar filtra. Setas navegam. Enter seleciona. Grupo aparece como subtexto. Escape fecha.

---

## Phase 7: US6 - Drag-and-Drop para Selecao de Arquivo (P2)

**Goal**: Usuario pode arrastar arquivo CSV/OFX para a area de upload em vez de clicar no seletor.

**Independent Test**: Arrastar .csv sobre a zona de drop e verificar que o parsing inicia.

**Covers**: FR-013, FR-014

**Depends on**: Phase 2 (T010 — area de upload reestruturada com disclosure)

### Implementation

- [x] T020 [US6] Reestruturar area de upload como drop zone com eventos DnD em `src/features/entries/ImportModal.tsx`
  - Substituir input file visivel por zona de drop com icone Upload (Lucide, size=32)
  - Texto: "Arraste seu arquivo CSV ou OFX aqui"
  - Link/botao "Procurar arquivo" que aciona `<input type="file" hidden>`
  - Eventos: `onDragOver` (preventDefault), `onDragEnter` (setState isDragging), `onDragLeave` (unset), `onDrop` (extrair file, validar extensao, chamar `imp.previewFile`)
  - Validar extensao: rejeitar com feedback "Formato nao suportado. Use arquivos CSV ou OFX."
  - Desabilitar drop zone quando `!canWrite || monthClosed`
  - Ignorar arquivos alem do primeiro em drops multiplos

- [x] T021 [P] [US6] Adicionar estilos da drop zone (normal, drag-over, disabled) em `src/styles.css`
  - Normal: `border: 2px dashed var(--line)`, padding generoso, text-align center
  - Drag-over: `border-color: var(--accent)`, `background: var(--accent-soft)`
  - Disabled: `opacity: 0.5`, `pointer-events: none`
  - Icone Upload: `color: var(--ink-muted)`

**Checkpoint**: Drop zone visivel com icone e texto. Arrastar arquivo destaca zona. Soltar inicia parsing. Extensao invalida mostra erro.

---

## Phase 8: US7 - Acessibilidade do Modal (P2)

**Goal**: Focus trap, Escape para fechar, aria-labelledby, focus return ao botao trigger.

**Independent Test**: Navegar modal inteiro com Tab/Shift+Tab/Escape sem foco escapar.

**Covers**: FR-015, FR-016, FR-017

**Depends on**: Phase 2 (T010 — estrutura do modal com dialog/aria)

### Implementation

- [x] T022 [US7] Adicionar `role="dialog"`, `aria-modal="true"` e `aria-labelledby="import-modal-title"` no container do modal em `src/features/entries/ImportModal.tsx`
  - Atualizar `<h3>` com `id="import-modal-title"` e texto "Importador CSV/OFX"
  - Envolver feedback em `aria-live="polite"` region

- [x] T023 [US7] Implementar focus trap com `useEffect` no mount do modal em `src/features/entries/ImportModal.tsx`
  - Coletar elementos focaveis dentro do modal
  - Tab no ultimo → volta para primeiro
  - Shift+Tab no primeiro → vai para ultimo
  - Mover foco para primeiro elemento ao abrir

- [x] T024 [US7] Adicionar handler Escape para fechar modal em `src/features/entries/ImportModal.tsx`
  - `onKeyDown` no container: `if (e.key === 'Escape') imp.closeModal()`

- [x] T025 [US7] Adicionar ref no botao "Importar" e focus return ao fechar modal em `src/features/entries/EntriesPage.tsx`
  - Criar `importButtonRef` com `useRef`
  - Passar ref para o botao Importar
  - No cleanup do modal (ou callback de close): `importButtonRef.current?.focus()`

**Checkpoint**: Tab circula dentro do modal. Escape fecha. Foco retorna ao botao Importar. Screen reader anuncia titulo.

---

## Phase 9: US9 - Resumo Pos-Importacao (P3)

**Goal**: Apos importacao, modal mostra painel de resumo com contagens em vez de apenas texto.

**Independent Test**: Completar importacao e verificar painel com contagens e botoes "Importar outro" / "Voltar".

**Covers**: FR-020

**Depends on**: Phase 1 (T006 — contagens por status), Phase 3 (T011 — botoes renomeados)

### Implementation

- [x] T026 [US9] Adicionar estado `importCompleted` e `importSummary` ao hook em `src/hooks/useImport.ts`
  - `importCompleted: boolean` (default false)
  - `importSummary: { imported: number, duplicates: number, errors: number, cancelled: number }`
  - Setar no sucesso de `confirmMutation` em vez de limpar preview
  - Funcao `resetImport()`: limpa `importCompleted`, limpa preview, volta ao estado inicial

- [x] T027 [US9] Renderizar painel de resumo condicional no modal em `src/features/entries/ImportModal.tsx`
  - Se `imp.importCompleted`: esconder tabela e botoes de acao, mostrar painel de resumo
  - Painel: 4 metricas (importados, duplicados ignorados, erros ignorados, cancelados)
  - Botoes: "Importar outro arquivo" (chama `imp.resetImport()`) e "Voltar" (fecha modal)

**Checkpoint**: Apos importacao bem-sucedida, painel de resumo aparece com contagens corretas. "Importar outro" reseta. "Voltar" fecha.

---

## Phase 10: Polish e Validacao Final

**Purpose**: Verificacao cruzada de todos os requisitos e edge cases.

- [x] T028 Verificar todos os edge cases documentados na spec em `src/features/entries/ImportModal.tsx` e `src/hooks/useImport.ts`
  - Arquivo vazio: feedback "Arquivo vazio ou sem dados validos"
  - Todas linhas duplicadas: botao "Importar (0)" desabilitado
  - Todas linhas canceladas: botao "Importar (0)" desabilitado
  - Drop de multiplos arquivos: apenas primeiro
  - Combobox com 0 categorias para o tipo: fallback para todas

- [x] T029 Validar build do projeto (sem erros TypeScript)

- [x] T030 Verificar conformidade visual com tokens de `speckit/07-visual-identity-spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (US1) ──────────┬──→ Phase 3 (US5) ───→ Phase 9 (US9)
                         ├──→ Phase 5 (US8)
                         └──→ Phase 9 (US9)

Phase 2 (US3) ──────────┬──→ Phase 7 (US6)
                         └──→ Phase 8 (US7)

Phase 4 (US4) ──────────── independente
Phase 6 (US2) ──────────── independente

Phase 10 (Polish) ──────── depende de todas as fases anteriores
```

### User Story Dependencies

| User Story | Depende de | Motivo |
|-----------|-----------|--------|
| US1 | — | Base: define tipo ImportRowStatus |
| US2 | — | Componente novo independente |
| US3 | — | Apenas CSS + condicoes de render |
| US4 | — | Estado local, sem dependencia |
| US5 | US1 | Usa `importReady` derivado de status |
| US6 | US3 | Usa drop zone da area de upload |
| US7 | US3 | Usa aria-labelledby no dialog |
| US8 | US1 | Usa `data-status` no `<tr>` |
| US9 | US1, US5 | Usa contagens por status e botoes |

### Parallel Opportunities

**Grupo A** (sem dependencias entre si — podem comecar simultaneamente):
- Phase 1 (US1) — `useImport.ts` + `ImportModal.tsx`
- Phase 2 (US3) — `styles.css` + `ImportModal.tsx` (area diferente do JSX)
- Phase 4 (US4) — `ImportModal.tsx` (secao quick-category, area isolada)
- Phase 6 (US2) — `CategoryCombobox.tsx` (arquivo novo)

**Grupo B** (apos Phase 1):
- Phase 3 (US5) — botoes em `ImportModal.tsx`
- Phase 5 (US8) — CSS + data-status

**Grupo C** (apos Phase 2):
- Phase 7 (US6) — DnD em `ImportModal.tsx`
- Phase 8 (US7) — a11y em `ImportModal.tsx` + `EntriesPage.tsx`

**Grupo D** (apos tudo):
- Phase 9 (US9) — resumo
- Phase 10 (Polish)

---

## Rastreabilidade FR → Task

| Requisito | Task(s) |
|-----------|---------|
| FR-001 | T003, T007 |
| FR-002 | T003, T007 |
| FR-003 | T004 |
| FR-004 | T006 |
| FR-005 | T016, T019 |
| FR-006 | T016 |
| FR-007 | T016 |
| FR-008 | T009 |
| FR-009 | T010 |
| FR-010 | T012, T013 |
| FR-011 | T011 |
| FR-012 | T011 |
| FR-013 | T020 |
| FR-014 | T021 |
| FR-015 | T023 |
| FR-016 | T024 |
| FR-017 | T022 |
| FR-018 | T014, T015 |
| FR-019 | T015 |
| FR-020 | T026, T027 |
| FR-021 | T005, T008 |
| FR-022 | T005 |
