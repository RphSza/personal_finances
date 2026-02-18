# Feature Specification: Acabamento do Importador CSV/OFX

**Feature Branch**: `20260217-import-finishing`
**Created**: 2026-02-17
**Status**: Implemented
**Sprint**: S3 (continuacao)
**Input**: Research consolidada em `research/importacao-csv-ofx-research.md`, consideracoes do usuario e benchmarks de mercado (YNAB, Monarch Money, Lunch Money, Firefly III, Wave Apps).

---

## Contexto

O importador CSV/OFX v1 esta funcional (parsing, preview, dedup, confirmacao) mas apresenta lacunas de UX, acessibilidade e controle do usuario que impedem a experiencia de uso profissional esperada. Esta spec detalha o acabamento necessario para atingir qualidade de producao.

**Arquivos impactados**:
- `src/features/entries/ImportModal.tsx` - componente principal do modal
- `src/hooks/useImport.ts` - hook de estado e mutacoes
- `src/features/entries/importParser.ts` - parsing CSV/OFX
- `src/styles.css` - estilos do modal e tabela
- Novo componente: `src/components/CategoryCombobox.tsx`

**Referencia de dados**: Tabelas `import_jobs`, `import_job_rows`, `categories`, `category_groups` (schema existente, sem alteracao).

---

## User Scenarios & Testing

### User Story 1 - Controle de status por linha na tabela (Priority: P1)

O usuario importa um arquivo CSV e o sistema detecta 3 linhas como duplicadas. O usuario percebe que uma delas e uma compra legitima que aconteceu no mesmo dia com mesmo valor (ex: dois cafes identicos). Ele precisa mudar o status dessa linha de "duplicada" para "ok" para que ela seja incluida na importacao. Tambem precisa poder marcar uma linha "ok" como "cancelada" quando percebe que e um lancamento que nao quer importar.

**Why this priority**: Sem esta capacidade, o usuario nao tem controle sobre o que importa. E o maior gap funcional identificado na pesquisa. Wave Apps e Maybe Finance oferecem override de status como funcionalidade basica.

**Independent Test**: Pode ser testado importando um arquivo com duplicatas conhecidas, alterando status de linhas individuais, e verificando que apenas linhas com status "ok" sao importadas na confirmacao.

**Acceptance Scenarios**:

1. **Given** o usuario carregou um arquivo e o preview exibe linhas com status automatico (ok, duplicada, erro, sem_categoria), **When** ele clica no dropdown de status de uma linha marcada como "duplicada", **Then** ele ve as opcoes "ok", "duplicada" e "cancelada", e pode selecionar "ok" para incluir a linha na importacao.

2. **Given** o usuario alterou o status de uma linha de "duplicada" para "ok", **When** ele observa as estatisticas no topo, **Then** a contagem de "Prontas" aumenta em 1 e a de "Duplicadas" diminui em 1, refletindo a mudanca em tempo real.

3. **Given** o usuario tem 30 linhas com status "ok" e altera 5 delas para "cancelada", **When** ele clica em "Importar", **Then** apenas 25 lancamentos sao inseridos no banco (as 5 canceladas sao ignoradas).

4. **Given** uma linha tem status "erro" (ex: descricao vazia, pagamento de fatura), **When** o usuario tenta alterar o status, **Then** o dropdown esta desabilitado — erros tecnicos nao sao editaveis pelo usuario.

5. **Given** uma linha tem status "sem_categoria" e o usuario atribui uma categoria via combobox, **When** a categoria e selecionada, **Then** o status muda automaticamente para "ok".

**Detalhamento tecnico**:

Novo tipo explicito no `ImportPreviewRow`:
```typescript
type ImportRowStatus = 'ok' | 'duplicada' | 'erro' | 'sem_categoria' | 'cancelada';
```

Inicializacao automatica em `previewFile`:
```
se errorReason → 'erro'
se isDuplicate → 'duplicada'
se !categoryId → 'sem_categoria'
senao → 'ok'
```

Regras de transicao permitidas:
| De | Para |
|----|------|
| ok | cancelada |
| ok | duplicada |
| duplicada | ok |
| duplicada | cancelada |
| cancelada | ok |
| cancelada | duplicada |
| sem_categoria | (automatico para 'ok' ao atribuir categoria) |
| erro | (nao editavel) |

Filtragem na confirmacao: `rows.filter(r => r.status === 'ok' && r.categoryId)`.

---

### User Story 2 - Combobox pesquisavel de categorias com grupos (Priority: P1)

O usuario importou um extrato com 50 linhas. Precisa ajustar a categoria de uma linha para "Estacionamento", mas a lista de categorias tem 50+ itens e ele nao consegue encontrar rapidamente. Ele quer digitar "estac" e ver apenas as opcoes que correspondem, com o subtexto indicando que "Estacionamento" pertence ao grupo "Transporte".

**Why this priority**: Com muitas categorias, o `<select>` nativo e inutilizavel. Todas as apps de financas pesquisadas (YNAB, Monarch, Lunch Money) oferecem busca. A pesquisa classifica esta melhoria como "fortemente recomendada".

**Independent Test**: Pode ser testado abrindo o modal com preview carregado, clicando no campo de categoria de qualquer linha, digitando parte do nome e verificando a filtragem e o subtexto de grupo.

**Acceptance Scenarios**:

1. **Given** o usuario clica no campo de categoria de uma linha do preview, **When** o combobox abre, **Then** ele ve um campo de texto para pesquisa e a lista de categorias agrupadas, com cada opcao mostrando o nome da categoria e o subtexto com o nome do grupo.

2. **Given** o combobox esta aberto com todas as categorias visiveis, **When** o usuario digita "super", **Then** a lista filtra para mostrar apenas categorias cujo nome contem "super" (ex: "Supermercado"), mantendo o subtexto do grupo ("Alimentacao").

3. **Given** o combobox esta aberto, **When** o usuario navega com setas do teclado e pressiona Enter, **Then** a categoria destacada e selecionada e o combobox fecha.

4. **Given** existem categorias dos grupos "Moradia" (sort_order 1), "Alimentacao" (sort_order 2) e "Transporte" (sort_order 3), **When** o combobox abre sem filtro de busca, **Then** as categorias aparecem ordenadas por grupo (sort_order ASC) e dentro de cada grupo por nome da categoria (ASC).

5. **Given** a linha sendo editada e do tipo "expense", **When** o combobox abre, **Then** as categorias do tipo "expense" aparecem primeiro, seguidas das demais categorias ativas.

6. **Given** o combobox esta aberto, **When** o usuario pressiona Escape, **Then** o combobox fecha sem alterar a selecao.

**Detalhamento tecnico**:

Novo componente `CategoryCombobox`:
```
Props:
  - categories: CategoryRow[]
  - groups: CategoryGroupRow[]
  - value: string (categoryId)
  - onChange: (categoryId: string) => void
  - transactionType: TransactionType
  - disabled: boolean

Comportamento:
  - Constroi lista enriquecida: { id, name, groupName, groupSortOrder, type }
  - JOIN: category.group_id → group via useCategoryGroups existente
  - Ordenacao: groupSortOrder ASC, categoryName ASC
  - Filtragem: normalizeSearch(query) contra normalizeSearch(name) e normalizeSearch(groupName)
  - Renderizacao: nome em texto principal, grupo em texto secundario (font-size menor, cor muted)
```

Nao usar biblioteca externa — implementar com `<input>` + `<ul role="listbox">` + gerenciamento de estado local. Manter acessibilidade com `role="combobox"`, `aria-expanded`, `aria-activedescendant`.

---

### User Story 3 - Backdrop com blur e disclosure progressivo (Priority: P1)

O usuario clica em "Importar" na pagina de lancamentos. O modal abre com o fundo esfumacado/desfocado, impossibilitando a visualizacao da pagina anterior. Inicialmente, ele ve apenas a area de selecao de arquivo. So apos selecionar um arquivo, o formato detectado, as estatisticas e a tabela de preview aparecem.

**Why this priority**: Backdrop blur e padrao de mercado para modais de foco (Smashing Magazine, Uploadcare). Disclosure progressivo e unanime na pesquisa (NN/g, Smart Interface Design Patterns). Ambos tem implementacao trivial.

**Independent Test**: Pode ser testado abrindo o modal vazio e verificando: (a) fundo desfocado, (b) ausencia do chip de formato e estatisticas, (c) apos selecionar arquivo, aparecimento progressivo dos elementos.

**Acceptance Scenarios**:

1. **Given** o usuario esta na pagina de lancamentos, **When** clica em "Importar", **Then** o modal abre com backdrop que desfoca o conteudo por tras (blur CSS) e escurece o fundo.

2. **Given** o modal acabou de abrir e nenhum arquivo foi selecionado, **When** o usuario olha o conteudo do modal, **Then** ele ve apenas o titulo, o botao de fechar e a area de selecao de arquivo. Nao ha chip de formato, estatisticas, tabela de preview nem secao de criacao de categoria.

3. **Given** o usuario selecionou um arquivo CSV valido, **When** o parsing termina, **Then** o chip "Formato detectado: CSV" aparece, seguido pelas estatisticas e pela tabela de preview.

4. **Given** o usuario selecionou um arquivo e esta vendo o preview, **When** clica em "Limpar preview", **Then** o modal retorna ao estado inicial (somente area de selecao de arquivo).

**Detalhamento tecnico**:

CSS do backdrop:
```css
.modal-backdrop {
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  background: rgba(18, 13, 9, 0.55);
}
```

Condicoes de renderizacao no JSX:
```
chip de formato: renderizar somente se importFileName !== ""
import-stats: renderizar somente se importPreviewRows.length > 0 (ja implementado)
quick-category-box: renderizar somente se importPreviewRows.length > 0
tabela preview: renderizar somente se importPreviewRows.length > 0 (ja implementado)
botao Importar: renderizar somente se importPreviewRows.length > 0
```

---

### User Story 4 - Criacao rapida de categoria recolhida (Priority: P2)

O usuario importou um extrato e percebe que precisa criar uma nova categoria que nao existe. Ele ve o icone "+" ao lado de "Criar categoria rapida" e clica nele. Os campos de nome, tipo e o botao "Criar" aparecem. Apos criar a categoria, a secao recolhe novamente.

**Why this priority**: Reduz ruido visual. YNAB e Lunch Money usam criacao inline recolhida. Implementacao simples com estado booleano de toggle.

**Independent Test**: Pode ser testado abrindo o modal com preview, verificando que os campos de criacao estao ocultos, clicando no icone "+", preenchendo nome e tipo, criando a categoria, e verificando que a secao recolheu.

**Acceptance Scenarios**:

1. **Given** o preview esta carregado e a secao de criacao rapida esta visivel, **When** o usuario olha para ela, **Then** ele ve apenas um botao/link com icone Plus (Lucide) e o texto "Criar categoria rapida" — sem campos de input nem botao "Criar".

2. **Given** a secao esta recolhida, **When** o usuario clica no icone Plus, **Then** os campos de nome da categoria, select de tipo (income/expense/investment) e o botao "Criar" aparecem com animacao suave.

3. **Given** os campos estao expandidos e o usuario preenche o nome "Streaming" e seleciona tipo "expense", **When** clica em "Criar", **Then** a categoria e criada, as linhas do tipo correspondente sem categoria recebem a nova categoria, e a secao recolhe automaticamente.

4. **Given** os campos estao expandidos, **When** o usuario clica novamente no icone (agora Minus ou ChevronUp), **Then** os campos sao ocultados sem perder o conteudo digitado.

**Detalhamento tecnico**:

Estado local no ImportModal:
```typescript
const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
```

Icone: `Plus` quando fechado, `Minus` ou `ChevronUp` quando aberto (Lucide).

Apos `createQuickCategory` com sucesso: `setQuickCategoryOpen(false)`.

---

### User Story 5 - Renomeacao de botoes e contagem (Priority: P2)

O usuario carregou um arquivo com 45 linhas, das quais 38 estao com status "ok". Ele ve claramente o botao "Importar (38)" indicando quantas serao importadas, e o botao "Voltar" para fechar o modal.

**Why this priority**: Nomenclatura clara e feedback imediato no botao primario. Baixa complexidade, alto impacto em clareza.

**Independent Test**: Pode ser testado abrindo o modal com preview e verificando o texto dos botoes.

**Acceptance Scenarios**:

1. **Given** o preview tem 38 linhas com status "ok", **When** o usuario olha os botoes de acao, **Then** o botao primario mostra "Importar (38)" e o botao de fechar mostra "Voltar".

2. **Given** o usuario altera 5 linhas de "ok" para "cancelada", **When** olha o botao primario, **Then** ele mostra "Importar (33)" — a contagem atualiza em tempo real.

3. **Given** nenhuma linha tem status "ok", **When** o usuario olha o botao primario, **Then** o botao mostra "Importar (0)" e esta desabilitado.

4. **Given** a importacao esta em andamento, **When** o usuario olha o botao primario, **Then** ele mostra o spinner com "Importando..." e esta desabilitado.

**Detalhamento tecnico**:

Botoes atuais → novos:
| Atual | Novo |
|-------|------|
| "Confirmar importacao" | "Importar ({importReady})" |
| "Fechar" | "Voltar" |
| "Limpar preview" | Manter (exibir apenas quando ha preview) |

---

### User Story 6 - Drag-and-drop para selecao de arquivo (Priority: P2)

O usuario quer importar um extrato e arrasta o arquivo CSV diretamente da pasta do computador para a area de upload no modal, em vez de clicar em "Procurar arquivo".

**Why this priority**: Padrao esperado pelo mercado para upload de arquivos (Uploadcare, Filestack). Melhora significativamente a experiencia em desktop.

**Independent Test**: Pode ser testado arrastando um arquivo .csv sobre a area de drop e verificando que o parsing e acionado.

**Acceptance Scenarios**:

1. **Given** o modal esta aberto sem arquivo selecionado, **When** o usuario olha a area de upload, **Then** ele ve uma zona de drop com icone Upload (Lucide), texto "Arraste seu arquivo CSV ou OFX aqui" e um botao/link "Procurar arquivo".

2. **Given** o usuario arrasta um arquivo sobre a zona de drop, **When** o arquivo entra na area, **Then** a borda da zona muda para tracejada com cor accent e o fundo ganha destaque sutil, indicando que o drop e possivel.

3. **Given** o usuario solta o arquivo na zona de drop, **When** o arquivo e um .csv ou .ofx valido, **Then** o parsing e iniciado (mesmo comportamento de selecionar via input file).

4. **Given** o usuario solta um arquivo com extensao nao suportada (ex: .xlsx, .pdf), **When** o drop acontece, **Then** uma mensagem de feedback aparece: "Formato nao suportado. Use arquivos CSV ou OFX."

5. **Given** o periodo esta fechado ou o usuario nao tem permissao de escrita, **When** o usuario tenta arrastar um arquivo, **Then** a zona de drop esta desabilitada visualmente (opacity reduzida) e o drop nao aciona nenhuma acao.

**Detalhamento tecnico**:

Eventos: `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` no container.

`onDrop`: extrair `e.dataTransfer.files[0]`, validar extensao, chamar `imp.previewFile(file)`.

O `<input type="file">` existente fica `hidden` dentro do label "Procurar arquivo".

---

### User Story 7 - Acessibilidade do modal (Priority: P2)

O usuario navega exclusivamente por teclado. Ao abrir o modal, o foco e capturado dentro dele. Ele pode navegar entre os campos com Tab, fechar com Escape, e ao fechar, o foco retorna ao botao "Importar" da pagina.

**Why this priority**: Conformidade WCAG basica para modais. Requisito de acessibilidade documentado em `speckit/07-visual-identity-spec.md` (secao 7).

**Independent Test**: Pode ser testado navegando pelo modal exclusivamente com teclado (Tab, Shift+Tab, Escape, Enter).

**Acceptance Scenarios**:

1. **Given** o usuario clica em "Importar" para abrir o modal, **When** o modal abre, **Then** o foco e movido para o primeiro elemento interativo dentro do modal (a area de upload / input file).

2. **Given** o foco esta no ultimo elemento interativo do modal (botao "Voltar"), **When** o usuario pressiona Tab, **Then** o foco volta para o primeiro elemento interativo do modal (focus trap).

3. **Given** o modal esta aberto, **When** o usuario pressiona Escape, **Then** o modal fecha e o foco retorna ao botao "Importar" da pagina de lancamentos.

4. **Given** o modal esta aberto, **When** um screen reader le o modal, **Then** ele anuncia "Importador CSV/OFX" como titulo do dialogo (via `aria-labelledby` apontando para o `<h3>`).

5. **Given** uma mensagem de feedback aparece (sucesso ou erro), **When** a mensagem e renderizada, **Then** ela esta dentro de um `aria-live="polite"` region para que o screen reader a anuncie automaticamente.

**Detalhamento tecnico**:

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
  <h3 id="import-modal-title">Importador CSV/OFX</h3>
  ...
</div>
```

Focus trap: `useEffect` no mount que captura elementos focaveis e intercepta Tab/Shift+Tab.

Escape: `onKeyDown` no container do modal, `if (e.key === 'Escape') imp.closeModal()`.

Return focus: ref no botao trigger, `triggerRef.current?.focus()` no cleanup do modal.

---

### User Story 8 - Highlight visual de linhas por status e header sticky (Priority: P2)

O usuario importou um extrato com 60 linhas. Ao scrollar a tabela, ele percebe que linhas com erro tem fundo vermelho claro, duplicadas tem fundo amarelo claro, canceladas tem fundo cinza, e linhas ok tem fundo branco. O header da tabela permanece visivel ao scrollar.

**Why this priority**: Feedback visual por cor de fundo em linhas melhora drasticamente a legibilidade (Pencil & Paper, UX Design World). Header sticky e basico para tabelas scrollaveis.

**Independent Test**: Pode ser testado importando um arquivo com variedade de status e verificando as cores de fundo e o comportamento do header ao scrollar.

**Acceptance Scenarios**:

1. **Given** a tabela de preview esta renderizada, **When** o usuario observa as linhas, **Then** linhas com status "erro" tem background vermelho claro (`#fdf0ee`), "duplicada" tem amarelo claro (`#fdf6e8`), "cancelada" tem cinza claro (`#f3efea`), e "ok" tem background branco.

2. **Given** a tabela tem mais linhas do que o viewport permite, **When** o usuario scrolla verticalmente dentro da tabela, **Then** o `<thead>` permanece fixo no topo da area visivel da tabela.

3. **Given** uma linha tem status "duplicada" com fundo amarelo, **When** o usuario muda o status para "ok", **Then** o fundo da linha transiciona suavemente para branco.

**Detalhamento tecnico**:

CSS das linhas:
```css
.import-preview-table tr[data-status="erro"]        { background: #fdf0ee; }
.import-preview-table tr[data-status="duplicada"]    { background: #fdf6e8; }
.import-preview-table tr[data-status="cancelada"]    { background: #f3efea; }
.import-preview-table tr[data-status="ok"]           { background: #fff; }
.import-preview-table tr[data-status="sem_categoria"]{ background: #fdf6e8; }
```

Header sticky:
```css
.import-preview-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--surface);
}
```

Atributo `data-status` na `<tr>`: `<tr data-status={row.status}>`.

---

### User Story 9 - Resumo pos-importacao (Priority: P3)

Apos confirmar a importacao, o usuario ve um resumo detalhado do resultado em vez de apenas uma mensagem de texto.

**Why this priority**: Melhora o feedback ao usuario mas nao e bloqueante para operacao. Dados ja disponiveis em `import_jobs`.

**Independent Test**: Pode ser testado completando uma importacao e verificando o painel de resumo.

**Acceptance Scenarios**:

1. **Given** o usuario clicou em "Importar" e a operacao foi concluida com sucesso, **When** o modal atualiza, **Then** a tabela de preview e os botoes de acao sao substituidos por um painel de resumo mostrando: quantidade de lancamentos importados, duplicados ignorados, erros ignorados e cancelados pelo usuario.

2. **Given** o resumo esta sendo exibido, **When** o usuario olha os botoes disponiveis, **Then** ele ve "Importar outro arquivo" (que limpa o estado e volta ao inicio) e "Voltar" (que fecha o modal).

**Detalhamento tecnico**:

Novo estado: `importCompleted: boolean` + `importSummary: { imported, duplicates, errors, cancelled }`.

Apos `confirmMutation` com sucesso: setar `importCompleted = true` com os dados de resumo em vez de limpar o preview imediatamente.

Botao "Importar outro arquivo": reseta `importCompleted`, limpa preview, volta ao estado inicial do modal.

---

### Edge Cases

- **Arquivo vazio**: Sistema deve exibir feedback "Arquivo vazio ou sem dados validos" e nao renderizar tabela nem estatisticas.
- **Todas as linhas duplicadas**: Botao "Importar (0)" desabilitado. Estatisticas mostram 100% de duplicatas. Usuario pode alterar status de linhas individuais para "ok" se desejar importar mesmo assim.
- **Categoria deletada (soft-delete) atribuida a uma linha**: O combobox nao deve exibir categorias com `deleted_at` preenchido. Se uma linha tinha categoria que foi deletada durante a sessao, o status volta a "sem_categoria".
- **Usuario altera todas as linhas para "cancelada"**: Botao "Importar (0)" desabilitado. Mensagem informativa nao bloqueante.
- **Arquivo com encoding Windows-1252**: Acentos aparecem corrompidos. Para esta spec, manter comportamento atual (UTF-8). Melhoria de encoding detection e P2 no roadmap futuro (research item #14).
- **Combobox com 0 categorias para o tipo**: Mostrar todas as categorias ativas como fallback (comportamento atual mantido).
- **Drop de multiplos arquivos simultaneos**: Considerar apenas o primeiro arquivo. Ignorar os demais silenciosamente.

---

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que o usuario altere o status de linhas individuais na tabela de preview entre `ok`, `duplicada` e `cancelada` via dropdown na coluna Status.
- **FR-002**: O sistema DEVE manter o status `erro` como nao-editavel (desabilitar dropdown para linhas com erro tecnico).
- **FR-003**: O sistema DEVE atualizar automaticamente o status de `sem_categoria` para `ok` quando o usuario atribuir uma categoria a linha.
- **FR-004**: O sistema DEVE importar apenas linhas com `status === 'ok'` e `categoryId` preenchido ao confirmar.
- **FR-005**: O sistema DEVE substituir o `<select>` nativo de categorias por um combobox pesquisavel que suporte filtragem por texto.
- **FR-006**: O combobox DEVE exibir cada categoria com subtexto contendo o nome do grupo ao qual pertence.
- **FR-007**: O combobox DEVE ordenar categorias por `group.sort_order ASC` e depois por `category.name ASC`.
- **FR-008**: O modal DEVE renderizar backdrop com `backdrop-filter: blur` para desfoque do conteudo da pagina.
- **FR-009**: O chip "Formato detectado" DEVE ser renderizado somente apos a selecao de um arquivo.
- **FR-010**: A secao de criacao rapida de categoria DEVE iniciar recolhida, exibindo apenas um icone Plus com label. Os campos e botao de criacao DEVEM aparecer somente apos clique no icone.
- **FR-011**: O botao primario de confirmacao DEVE exibir "Importar ({N})" onde N e a contagem de linhas com status "ok", atualizando em tempo real.
- **FR-012**: O botao de fechar o modal DEVE exibir "Voltar" em vez de "Fechar".
- **FR-013**: O modal DEVE suportar drag-and-drop de arquivos CSV/OFX como metodo alternativo ao seletor de arquivo.
- **FR-014**: A zona de drop DEVE exibir feedback visual (borda e fundo) quando um arquivo esta sendo arrastado sobre ela.
- **FR-015**: O modal DEVE implementar focus trap (Tab/Shift+Tab circulam dentro do modal).
- **FR-016**: O modal DEVE fechar ao pressionar Escape.
- **FR-017**: O modal DEVE ter `aria-labelledby` apontando para o titulo do dialogo.
- **FR-018**: Linhas da tabela de preview DEVEM ter background-color diferenciado por status (erro=vermelho claro, duplicada/sem_categoria=amarelo claro, cancelada=cinza claro, ok=branco).
- **FR-019**: O `<thead>` da tabela de preview DEVE ser sticky (fixo ao scrollar).
- **FR-020**: Apos importacao bem-sucedida, o modal DEVE exibir um painel de resumo com contagens de lancamentos importados, duplicados ignorados, erros ignorados e cancelados.
- **FR-021**: As estatisticas no topo do modal (Total, Prontas, Duplicadas, Com erro) DEVEM refletir em tempo real as alteracoes de status feitas pelo usuario.
- **FR-022**: O sistema DEVE recalcular estatisticas considerando o status explicito (editado pelo usuario), nao o status derivado automaticamente.

### Key Entities

- **ImportPreviewRow** (modificacao): Adicionar campo `status: ImportRowStatus` como propriedade explicita e editavel, em vez de derivar status implicitamente a partir de `isDuplicate`, `errorReason` e `categoryId`.
- **ImportRowStatus** (novo): Enum `'ok' | 'duplicada' | 'erro' | 'sem_categoria' | 'cancelada'`.
- **CategoryOption** (novo, apenas UI): Tipo para opcao renderizada no combobox: `{ id, name, groupName, groupSortOrder, type }`.

---

## Design e Visual Identity

Todas as alteracoes visuais DEVEM respeitar os tokens definidos em `speckit/07-visual-identity-spec.md`:

| Elemento | Token/Valor |
|----------|-------------|
| Backdrop blur | `backdrop-filter: blur(6px)` + `rgba(18,13,9,0.55)` |
| Zona de drop (borda normal) | `border: 2px dashed var(--line)` |
| Zona de drop (drag over) | `border-color: var(--accent)`, `background: var(--accent-soft)` |
| Linha erro (bg) | `#fdf0ee` (derivado de `--danger` com baixa opacidade) |
| Linha duplicada/sem_cat (bg) | `#fdf6e8` (derivado de `--accent-soft` com tom amarelado) |
| Linha cancelada (bg) | `#f3efea` (derivado de `--bg-alt`) |
| Combobox dropdown | `background: var(--surface-strong)`, `border: 1px solid var(--line)`, `border-radius: var(--radius-sm)` |
| Grupo header no combobox | `font-size: 0.75rem`, `font-weight: 700`, `color: var(--ink-muted)`, `text-transform: uppercase` |
| Subtexto de grupo | `font-size: 0.72rem`, `color: var(--ink-muted)` |
| Icone Plus/Minus (criacao rapida) | Lucide, `size={16}`, `color: var(--accent)` |
| Icone Upload (drop zone) | Lucide, `size={32}`, `color: var(--ink-muted)` |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuario consegue alterar o status de uma linha e confirmar importacao com resultado correto (apenas linhas "ok" importadas) em 100% dos cenarios testados.
- **SC-002**: Usuario consegue localizar uma categoria pelo nome digitando no maximo 4 caracteres no combobox, em menos de 2 segundos.
- **SC-003**: Modal abre com backdrop blur e somente a area de upload visivel, sem elementos de preview pre-renderizados.
- **SC-004**: Secao de criacao rapida inicia recolhida e expande/recolhe corretamente em 100% dos cliques.
- **SC-005**: Botao primario reflete contagem correta de linhas importaveis em tempo real apos cada alteracao de status.
- **SC-006**: Navegacao por teclado (Tab, Shift+Tab, Escape) funciona corretamente dentro do modal sem escape de foco.
- **SC-007**: Drag-and-drop de arquivo aciona o parsing com o mesmo resultado que a selecao via input file.
- **SC-008**: Linhas da tabela sao visualmente distinguiveis por status (cores de fundo diferentes) sem necessidade de ler o texto do pill.

---

## Implementacao Sugerida (Ordem de Execucao)

A ordem recomendada visa entregar valor incremental, com cada etapa testavel independentemente:

1. **Status editavel** (US1) — Altera `ImportPreviewRow`, `useImport.ts`, `ImportModal.tsx`
2. **Backdrop blur + disclosure progressivo** (US3) — Altera `styles.css`, `ImportModal.tsx`
3. **Renomeacao de botoes** (US5) — Altera `ImportModal.tsx`
4. **Criacao rapida recolhida** (US4) — Altera `ImportModal.tsx`
5. **Highlight de linhas + header sticky** (US8) — Altera `styles.css`, `ImportModal.tsx`
6. **Combobox pesquisavel** (US2) — Cria `CategoryCombobox.tsx`, altera `ImportModal.tsx`
7. **Drag-and-drop** (US6) — Altera `ImportModal.tsx`, `styles.css`
8. **Acessibilidade** (US7) — Altera `ImportModal.tsx`, `EntriesPage.tsx`
9. **Resumo pos-importacao** (US9) — Altera `useImport.ts`, `ImportModal.tsx`

---

## Fora de Escopo (Documentado para Futuro)

Os seguintes itens da pesquisa ficam explicitamente fora desta spec:

| Item | Motivo | Referencia |
|------|--------|-----------|
| FITID para dedup OFX | Requer alteracao no parser e no schema de dedup | Research P2 #13 |
| Deteccao de encoding | Requer heuristica robusta para fallback | Research P2 #14 |
| Scroll virtual (@tanstack/react-virtual) | Limite de 80 linhas e aceitavel para v1 | Research P2 #15 |
| Checkboxes por linha / bulk actions | Complexidade alta, status editavel cobre 80% do caso | Research P2 #16 |
| Auto-categorization rules | Feature separada, requer novo schema | Research P2 #17 |
| Edicao inline de descricao/data | Nice-to-have, nao prioritario | Research P2 #18 |
| Manual column mapping | Fallback raro, auto-detect funciona para maioria | Research P2 #19 |
| Mobile card view | Responsividade basica mantida, card view e evolucao | Research P2 #20 |

---

## Post-Implementation Notes

### Bug Fix: Spinner infinito ao confirmar importacao (2026-02-18)

**Problema**: Ao clicar "Importar (N)", o spinner ficava em "Importando..." indefinidamente sem parar, mesmo em caso de erro. O console mostrava 5x erros 404 do Supabase.

**Causa raiz**: Duas falhas no `confirmMutation` de `src/hooks/useImport.ts`:

1. **Sem timeout de seguranca** — O `fetch` nativo do browser nao possui timeout. Se qualquer chamada Supabase (insert em `import_jobs`, `import_job_rows` ou `transactions`) travasse no nivel de rede (CORS preflight, servidor sem resposta, conexao perdida), o `await` nunca resolvia, o bloco `finally` nunca executava, e `setImportSubmitting(false)` nunca era chamado.

2. **Mensagem de erro opaca** — O catch block usava `error instanceof Error` para extrair a mensagem, mas `PostgrestError` do Supabase nao extende `Error`. O resultado era sempre a mensagem generica "Falha ao confirmar importacao" sem nenhum detalhe sobre o que falhou. Nenhum `console.error` era emitido.

**Correcao** (commit `56ffeb0`):

- Adicionado `setTimeout` de 60s como safety net: se a mutacao nao completar em 60 segundos, forca `setImportSubmitting(false)` e mostra mensagem de timeout
- Extraido `message` de objetos que nao sao `Error` (como `PostgrestError`) via duck-typing
- Adicionado `console.error("[useImport] confirmImport failed:", error)` para diagnostico no DevTools
- O `clearTimeout` no `finally` garante que o timer e limpo em caso de sucesso ou erro tratado

**Observacao sobre os 404s no console**: As 5 linhas de `Failed to load resource: 404` apontavam para URLs com padrao `order=sort_order.asc,name.asc`, provavelmente de queries de categorias/grupos refetchadas pelo `qc.invalidateQueries()` apos algum sucesso parcial. Esses erros de background nao afetam o fluxo principal mas podem indicar um problema no Supabase (tabela sem a coluna `sort_order`, migracao nao aplicada, ou cache de schema do PostgREST desatualizado).
