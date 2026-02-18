# Implementation Plan: Acabamento do Importador CSV/OFX

**Branch**: `20260217-import-finishing` | **Date**: 2026-02-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/20260217-import-finishing/spec.md`

## Summary

O importador CSV/OFX v1 esta funcional (parsing, preview, dedup, confirmacao) mas precisa de acabamento para atingir qualidade de producao. As mudancas se dividem em 3 eixos:

1. **Controle do usuario**: status editavel por linha (US1), combobox pesquisavel de categorias (US2), renomeacao de botoes com contagem (US5)
2. **UX e visual**: backdrop blur + disclosure progressivo (US3), criacao rapida recolhida (US4), highlight por status + header sticky (US8), drag-and-drop (US6), resumo pos-importacao (US9)
3. **Acessibilidade**: focus trap, Escape, aria-labelledby, focus return (US7)

Abordagem tecnica: todas as mudancas sao frontend-only (sem migrations, sem RLS, sem novas tabelas). O impacto se concentra em 4 arquivos existentes + 1 novo componente.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19
**Primary Dependencies**: Lucide React (icones), Supabase JS (client), TanStack Query (mutations), date-fns
**Storage**: Supabase Postgres (tabelas existentes: `import_jobs`, `import_job_rows`, `categories`, `category_groups` — sem alteracao de schema)
**Testing**: Validacao manual (projeto nao possui suite de testes automatizados)
**Target Platform**: Web (desktop-first, responsivo)
**Project Type**: Web SPA (Vite + React)
**Performance Goals**: Combobox filtra 50+ categorias em <100ms; modal abre em <200ms
**Constraints**: Sem bibliotecas externas novas (combobox, drag-drop, virtual scroll implementados manualmente). Limite de 80 linhas no preview mantido.
**Scale/Scope**: 9 user stories, ~4 arquivos modificados + 1 novo componente

## Constitution Check

| Principio | Status | Observacao |
|-----------|--------|-----------|
| I. Workspace Isolation | PASS | Sem mudanca de schema. Dados ja isolados por workspace_id. |
| II. Single Auth Source | PASS | Sem mudanca de autenticacao. |
| III. Type and Schema Consistency | PASS | Sem migrations. Novo tipo `ImportRowStatus` adicionado ao frontend. Tipo `ImportPreviewRow` estendido com campo `status`. |
| IV. UX and Visual Identity | PASS | Todas as cores, tokens e padroes seguem `speckit/07-visual-identity-spec.md`. Backdrop blur, cores de linha por status, combobox dropdown — tudo documentado na spec com tokens explicitos. |
| V. Feature Modularity | PASS | Mudancas concentradas no modulo `entries`. Novo componente `CategoryCombobox` em `src/components/` reutilizavel. |
| VI. Spec-First Delivery | PASS | Spec completa com 9 user stories, acceptance scenarios e detalhamento tecnico. Licoes aprendidas consultadas. |
| VII. Operational Safety | PASS | Filtragem de importacao alterada de derivacao implicita para status explicito. Regra mais segura: `rows.filter(r => r.status === 'ok' && r.categoryId)`. Rollback: mudancas sao puramente visuais/estado local. |

## Project Structure

### Documentation (this feature)

```text
specs/20260217-import-finishing/
├── spec.md              # Especificacao completa (9 user stories)
└── plan.md              # Este arquivo
```

Nao requer `research.md` (research ja consolidada em `research/importacao-csv-ofx-research.md`), `data-model.md` (sem mudancas de schema), `contracts/` (sem APIs novas), nem `quickstart.md` (feature existente).

### Source Code (arquivos impactados)

```text
src/
├── features/entries/
│   ├── ImportModal.tsx       # MODIFICAR - JSX completo: status dropdown, disclosure, backdrop, DnD, a11y, resumo
│   └── EntriesPage.tsx       # MODIFICAR - ref no botao Importar para focus return
├── hooks/
│   └── useImport.ts          # MODIFICAR - tipo ImportRowStatus, campo status em ImportPreviewRow, changeRowStatus(), logica de confirmacao, estado de resumo
├── components/
│   └── CategoryCombobox.tsx  # CRIAR - combobox pesquisavel com grupos
└── styles.css                # MODIFICAR - backdrop blur, drop zone, cores por status, header sticky, disclosure animation
```

### Mapeamento User Story → Arquivos

| US | Arquivos | Dependencia |
|----|----------|-------------|
| US1 - Status editavel | `useImport.ts`, `ImportModal.tsx` | Nenhuma (base para US5, US8, US9) |
| US2 - Combobox categorias | `CategoryCombobox.tsx` (novo), `ImportModal.tsx` | Nenhuma |
| US3 - Backdrop + disclosure | `styles.css`, `ImportModal.tsx` | Nenhuma |
| US4 - Criacao rapida recolhida | `ImportModal.tsx` | Nenhuma |
| US5 - Renomeacao botoes | `ImportModal.tsx` | US1 (depende de `importReady` baseado em status) |
| US6 - Drag-and-drop | `ImportModal.tsx`, `styles.css` | US3 (depende da drop zone visual) |
| US7 - Acessibilidade | `ImportModal.tsx`, `EntriesPage.tsx` | US3 (aria-labelledby no dialog) |
| US8 - Highlight + sticky | `styles.css`, `ImportModal.tsx` | US1 (depende de `data-status` no `<tr>`) |
| US9 - Resumo pos-importacao | `useImport.ts`, `ImportModal.tsx` | US1, US5 (depende de contagens por status) |

### Decisoes Tecnicas

**1. Status explicito vs derivado**

Atualmente o status e derivado em tempo de render (`isDuplicate`, `errorReason`, `categoryId`). A mudanca central e adicionar `status: ImportRowStatus` como campo editavel em `ImportPreviewRow`, inicializado no `previewFile()` e alteravel via `changeRowStatus()`.

Impacto na confirmacao: `confirmMutation` passa de `validRows = rows.filter(r => !r.isDuplicate && !r.errorReason && !!r.categoryId)` para `validRows = rows.filter(r => r.status === 'ok' && !!r.categoryId)`.

Impacto nas estatisticas: `importReady`, `importDuplicates`, `importErrors` passam a ser derivados do campo `status` explicito, nao dos campos booleanos.

**2. CategoryCombobox sem biblioteca externa**

Implementar com `<input>` + `<ul role="listbox">` + estado local. Acessibilidade via `role="combobox"`, `aria-expanded`, `aria-activedescendant`. Reutilizar `normalizeSearch()` de `src/lib/search.ts` para filtragem. Ordenacao por `group.sort_order ASC`, `category.name ASC`.

O componente recebe `categories`, `groups`, `value`, `onChange`, `transactionType`, `disabled`. Constroi lista enriquecida com JOIN manual category → group. Filtragem local por nome e grupo.

**3. Drag-and-drop nativo (sem biblioteca)**

Usar eventos HTML5: `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`. Validar extensao no drop. Chamar `imp.previewFile(file)` com o arquivo dropado. Estado `isDragging` para feedback visual.

**4. Focus trap manual**

`useEffect` no mount do modal que:
- Coleta elementos focaveis (`[tabindex], a, button, input, select, textarea`)
- Intercepta Tab/Shift+Tab para circular dentro do modal
- Intercepta Escape para fechar
- Move foco para primeiro elemento ao abrir
- Retorna foco ao trigger (`ref` no botao Importar) ao fechar

**5. Resumo pos-importacao como estado adicional**

Novo estado `importCompleted: boolean` + `importSummary: { imported, duplicates, errors, cancelled }` em `useImport.ts`. Apos `confirmMutation` com sucesso, setar `importCompleted = true` em vez de limpar preview. Modal renderiza painel de resumo condicionalmente.

### Ordem de Implementacao Recomendada

A ordem visa entregar valor incremental com cada etapa testavel:

1. **US1** (Status editavel) — base para tudo
2. **US3** (Backdrop + disclosure) — visual imediato
3. **US5** (Botoes) — rapido, depende de US1
4. **US4** (Criacao rapida recolhida) — independente
5. **US8** (Highlight + sticky) — depende de US1
6. **US2** (Combobox) — componente novo, mais complexo
7. **US6** (Drag-and-drop) — depende de US3
8. **US7** (Acessibilidade) — transversal, aplica sobre tudo
9. **US9** (Resumo) — ultimo, depende de US1 e US5

### Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Combobox com performance ruim em 50+ categorias | Baixa | Medio | Filtragem com `normalizeSearch` ja otimizada. Se necessario, debounce de 150ms no input. |
| Focus trap interfere com combobox dropdown | Media | Alto | Combobox deve gerenciar seu proprio foco interno. Focus trap do modal deve ignorar elementos dentro do combobox quando aberto. |
| Drag-and-drop nao funciona em todos browsers | Baixa | Baixo | HTML5 DnD API tem suporte universal. Fallback: input file continua funcionando. |
| Encoding Windows-1252 em arquivos arrastados | Media | Baixo | Fora de escopo (documentado). Manter UTF-8. |
| Transicao de status implicito para explicito quebra confirmacao | Media | Alto | Testes manuais rigorosos: importar arquivo, alterar status, confirmar. Verificar que apenas linhas 'ok' sao inseridas. |

## Complexity Tracking

> Nenhuma violacao de constituicao identificada. Todas as mudancas sao incrementais sobre codigo existente, sem novas dependencias, sem mudancas de schema, sem novas tabelas.
