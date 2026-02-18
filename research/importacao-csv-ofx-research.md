# Research: Importacao CSV/OFX - Melhores Praticas e Analise

> **Objetivo**: Subsidiar a criacao detalhada de uma spec para acabamento da funcionalidade de importacao de arquivos CSV e OFX.
> **Data**: 2026-02-17
> **Fontes**: Smashing Magazine, NN/g, OneSchema, Flatfile, Uploadcare, Filestack, YNAB, Monarch Money, Lunch Money, Firefly III, Maybe Finance, Wave Apps, WCAG 2.2, React Aria, Headless UI, UX Movement, UX Design World

---

## 1. Estado Atual da Implementacao

### Arquivos Envolvidos

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| UI | `src/features/entries/ImportModal.tsx` | Modal com formulario, tabela preview, botoes |
| Hook | `src/hooks/useImport.ts` | Estado, parsing, dedup, mutacoes Supabase |
| Parser | `src/features/entries/importParser.ts` | Parsing CSV/OFX, normalizacao, buildDedupeKey |
| Helpers | `src/utils/importHelpers.ts` | Deteccao de formato, heuristicas de cartao |
| Sugestao | `src/utils/categorySuggestion.ts` | Algoritmo de sugestao de categoria (3 tiers) |
| Schema | `supabase/migrations/20260217_s3_importador_financeiro_v1.sql` | Tabelas import_jobs e import_job_rows |

### Fluxo Atual

```
1. Usuario abre modal → Importador v1 (CSV/OFX)
2. "Formato detectado: CSV" aparece ANTES de selecionar arquivo
3. Seleciona arquivo → parsing → preview com tabela
4. Estatisticas: Total / Prontas / Duplicadas / Com erro / Sem categoria
5. Criacao rapida de categoria: inputs + botao sempre visiveis
6. Tabela preview: # | Descricao | Data | Tipo | Categoria (select) | Valor | Status (pill)
7. Status derivado automaticamente: ok / duplicada / erro / sem categoria
8. Botoes: "Confirmar importacao" | "Limpar preview" | "Fechar"
9. Confirmacao insere em import_jobs, import_job_rows e transactions
```

### Limitacoes Identificadas

| # | Limitacao | Impacto |
|---|-----------|---------|
| L1 | Format chip aparece antes de selecionar arquivo | Confuso - mostra "CSV" sem contexto |
| L2 | Sem drag-and-drop | Padrao esperado pelo mercado nao atendido |
| L3 | Criacao rapida de categoria sempre expandida | Ocupa espaco visual desnecessariamente |
| L4 | Status nao editavel pelo usuario | Impossivel corrigir falso-positivo de duplicata ou excluir linha manualmente |
| L5 | Dropdown de categorias sem busca | Dificil localizar com muitas categorias |
| L6 | Categorias sem contexto de grupo | Nomes ambiguos sem saber a que grupo pertencem |
| L7 | Sem ordenacao de categorias por grupo | Lista desordenada dificulta navegacao |
| L8 | Botao "Confirmar importacao" nome generico | Nao indica a acao com clareza suficiente |
| L9 | Backdrop sem blur/desfoque | Modal nao isola visualmente do conteudo anterior |
| L10 | Limite de 80 linhas sem scroll virtual | Arquivos grandes tem preview truncado |
| L11 | Sem acessibilidade: focus trap, Escape, aria-labelledby | Falha WCAG |
| L12 | Sem deteccao de encoding (Windows-1252) | Acentos corrompidos em arquivos de bancos BR |
| L13 | FITID do OFX nao usado para dedup | Falsos positivos de duplicata em OFX |
| L14 | Sem resumo pos-importacao rico | Apenas texto simples, sem acoes |

---

## 2. Pesquisa de Melhores Praticas

### 2.1 Modal e Overlay

**Consenso do mercado** (Smashing Magazine, Uploadcare, Filestack):
- Backdrop com `backdrop-filter: blur(4-8px)` combinado com overlay semi-transparente (`rgba(0,0,0,0.4-0.6)`)
- Focus trapping obrigatorio (WCAG 2.1.2)
- Fechar com Escape, click no backdrop, botao X
- Retornar foco ao botao que abriu o modal ao fechar
- Auto-focus no primeiro elemento interativo ao abrir

**Recomendacao**: Implementar blur no backdrop. Atualmente o modal usa `.modal-backdrop` com `onClick={imp.closeModal}` mas sem blur CSS nem focus trap.

### 2.2 Disclosure Progressivo

**Consenso do mercado** (NN/g, Smart Interface Design Patterns):
- Mostrar apenas o file picker inicialmente
- Formato detectado so apos selecao do arquivo
- Estatisticas so apos parsing completo
- Tabela preview so apos processamento
- Botao de confirmacao so quando ha dados validos

**Fluxo ideal para finance app com formatos conhecidos** (single-page com secoes progressivas, nao wizard multi-step):

```
Estado 1 (inicial):
  [Area de drag-and-drop + botao Procurar arquivo]

Estado 2 (apos selecao):
  [Formato detectado: CSV] [Arquivo: extrato.csv]
  [Spinner de parsing...]

Estado 3 (apos parsing):
  [Stats] [Tabela preview] [Criacao rapida] [Botoes acao]
```

**Justificativa contra wizard multi-step** (NN/g): Custo de interacao alto, tedioso quando invocado repetidamente, dificuldade de comparar informacoes entre passos. Para formatos conhecidos (OFX fixo, CSV com auto-detect), single-page progressivo e superior.

### 2.3 Drag-and-Drop

**Consenso do mercado** (Uploadcare, Filestack):
- Oferecer **ambos**: zona de drop como alvo primario + botao "Procurar" como fallback
- Visual feedback ao arrastar arquivo sobre a zona (borda tracejada, cor de destaque)
- Validacao imediata: tipo de arquivo, tamanho, encoding

**Referencia de implementacao**:
```
+---------------------------------------+
|                                       |
|   [icone Upload]                      |
|   Arraste seu arquivo CSV ou OFX      |
|   ou                                  |
|   [Procurar arquivo]                  |
|                                       |
+---------------------------------------+
```

### 2.4 Preview e Edicao na Tabela

**Consenso do mercado** (UX Design World, Pencil & Paper, UX Movement):

| Pratica | Status Atual | Recomendacao |
|---------|-------------|--------------|
| Tabela com todas as colunas relevantes | Implementado | Manter |
| Status pills com cores | Implementado | Manter, adicionar background na row |
| Dropdown de categoria por linha | Implementado | Trocar por combobox pesquisavel |
| Edicao inline de status | **Nao implementado** | Implementar (dropdown ou click-to-toggle) |
| Edicao inline de descricao | Nao implementado | Opcional (nice-to-have) |
| Checkboxes de selecao por linha | Nao implementado | Considerar para v2 |
| Scroll virtual para muitas linhas | Nao implementado | Implementar com @tanstack/react-virtual |
| Header sticky | Nao implementado | Implementar |
| Highlight de linhas com erro/duplicata | Parcial (pill apenas) | Adicionar background-color na `<tr>` |
| Ordenacao de colunas | Nao implementado | Considerar para v2 |

**Edicao de Status - Detalhe**:
- O usuario deve poder alterar o status de uma linha para: `ok`, `duplicada`, `cancelada` (skip)
- Isso permite: corrigir falsos positivos de duplicata, excluir linhas indesejadas, re-incluir linhas marcadas
- Na confirmacao, apenas linhas com status `ok` sao importadas
- Implementacao: `<select>` na coluna Status com as opcoes, ou click no pill para ciclar

### 2.5 Dropdown de Categorias - Combobox Pesquisavel

**Consenso do mercado** (React Aria, Headless UI, YNAB, Monarch):

O `<select>` nativo nao suporta busca. Para listas com mais de ~15 itens, um **combobox pesquisavel** e obrigatorio para boa UX.

**Requisitos funcionais**:
1. Campo de texto para filtrar categorias por nome
2. Lista dropdown com categorias agrupadas por `category_group`
3. Cada opcao mostra: nome da categoria + subtexto com nome do grupo
4. Ordenacao: por grupo (sort_order do grupo), depois por categoria (nome ou sort_order)
5. Opcao "Criar nova..." no final da lista (integra com criacao rapida)
6. Keyboard navigation: setas, Enter para selecionar, Escape para fechar

**Referencia visual**:
```
[Pesquisar categoria...           v]
  --- Moradia ---
  Aluguel                   Moradia
  Condominio                Moradia
  --- Alimentacao ---
  Supermercado          Alimentacao
  Restaurantes          Alimentacao
  --- Transporte ---
  Combustivel            Transporte
  Estacionamento         Transporte
  + Criar nova categoria...
```

**Opcoes de implementacao**:
- **React Aria ComboBox**: Mais robusto em acessibilidade, ARIA compliance nativa
- **Headless UI Combobox**: Mais simples, boa integracao com Tailwind/CSS custom
- **Implementacao custom**: Viavel mas requer cuidado com acessibilidade

**Dados necessarios**: O hook `useCategories` ja retorna categorias com `group_id`. Falta fazer JOIN com `category_groups` para exibir o nome do grupo como subtexto. O hook `useCategoryGroups` ja existe.

### 2.6 Criacao Rapida de Categoria

**Estado atual**: Sempre visivel com inputs (nome, tipo, botao Criar).

**Melhores praticas** (Lunch Money, YNAB):
- Disponivel mas **recolhido por padrao**
- Um icone/link "+" ao lado de "Criar categoria" expande os campos
- Apos criacao, recolhe novamente
- Auto-preencher o tipo baseado na transacao sendo editada
- Integrar como opcao no final do combobox de categorias ("+ Criar nova...")

**Recomendacao do usuario**: Icone Lucide `Plus` ao lado do label "Criar categoria rapida", que ao clicar expande os inputs e botao. Alinhado com as melhores praticas.

### 2.7 Deduplicacao

**Estado atual**: `buildDedupeKey = date|amount|type|normalizedDescription`. Verifica contra transacoes existentes no periodo.

**Melhores praticas** (Maybe Finance, Wave Apps, OFX spec):

| Aspecto | Estado Atual | Recomendacao |
|---------|-------------|--------------|
| Chave composta (data+valor+tipo+desc) | Implementado | Manter como fallback |
| FITID para OFX | Extraido mas nao usado | Usar como chave primaria de dedup para OFX |
| Janela de data fuzzy (1-3 dias) | Nao implementado | Considerar para v2 |
| Override pelo usuario | **Nao implementado** | Implementar via edicao de status |
| Comparacao lado-a-lado com existente | Nao implementado | Nice-to-have para v2 |

**FITID**: Cada `<STMTTRN>` no OFX contem um `<FITID>` (Financial Institution Transaction ID) unico. Este e o identificador mais confiavel para dedup de OFX. O parser ja extrai o FITID em `rawPayload` mas nao o utiliza.

### 2.8 Nomenclatura de Botoes

**Estado atual**: "Confirmar importacao" | "Limpar preview" | "Fechar"

**Consideracoes do usuario**: "Importar" e "Fechar" (ou "Voltar")

**Melhores praticas**:
- Botao primario deve usar verbo de acao claro: "Importar" ou "Importar N lancamentos"
- Mostrar contagem no botao: "Importar 23 lancamentos" (feedback imediato)
- Botao secundario: "Voltar" (se fechar o modal) ou "Limpar" (se limpar preview)
- Botao terciario: "Fechar" ou "Cancelar"

**Recomendacao**:
- Primario: **"Importar"** (com contagem: "Importar (23)")
- Secundario: **"Voltar"** (fecha o modal)
- Terciario: Manter "Limpar preview" se necessario, ou remover (o "Voltar" ja serve)

### 2.9 Pos-Importacao

**Estado atual**: Mensagem de texto simples: "Importacao concluida: X lancamentos adicionados."

**Melhores praticas** (Synder, Wave Apps):

```
+------------------------------------------+
|  Importacao concluida com sucesso        |
|                                          |
|  23 lancamentos importados               |
|   5 duplicados ignorados                 |
|   2 erros ignorados                      |
|   1 cancelado pelo usuario               |
|                                          |
|  [Importar outro arquivo]  [Fechar]      |
+------------------------------------------+
```

Os dados ja estao disponiveis em `import_jobs` (total_rows, valid_rows, duplicate_rows, error_rows, imported_rows).

---

## 3. Analise das Consideracoes do Usuario

### 3.1 Backdrop com blur/desfoque

> "O modal deve criar um overlay que impossibilite a visualizacao da pagina anterior mediante desfoque/esfumacado."

**Veredito: ALINHADO com melhores praticas.**

A pesquisa confirma que `backdrop-filter: blur()` e padrao de mercado para modais de foco. A implementacao atual usa apenas `modal-backdrop` sem blur. Adicionar `backdrop-filter: blur(4-8px)` ao CSS do `.modal-backdrop` resolve.

**Cuidado**: Nem todos os navegadores antigos suportam `backdrop-filter`, mas para o publico-alvo (app pessoal moderno), a cobertura e suficiente (>95% em 2026).

### 3.2 Formato detectado so apos selecao

> "Formato detectado: CSV nao deve aparecer inicialmente, porque nenhum arquivo foi selecionado."

**Veredito: ALINHADO com melhores praticas.**

Disclosure progressivo e unanime na pesquisa. Mostrar formato antes de selecionar arquivo e confuso e contra-intuitivo. O chip deve aparecer somente apos `importFileName` estar preenchido.

**Implementacao**: Condicionar renderizacao do chip a `imp.importFileName !== ""`.

### 3.3 Criacao rapida de categoria recolhida

> "Somente um icone de plus ao lado do label 'Criar categoria rapida', que ao clicar exiba os inputs e o botao."

**Veredito: ALINHADO com melhores praticas.**

Tanto YNAB quanto Lunch Money usam criacao inline recolhida. A expansao sob demanda reduz ruido visual e e padrao em formularios com secoes opcionais.

**Implementacao**: Estado booleano `quickCategoryExpanded`, toggle com icone Lucide `Plus` / `Minus`. Campos visiveis apenas quando expandido.

### 3.4 Status editavel na tabela

> "A tabela deveria possibilitar edicao do campo Status, permitindo mudanca de duplicado para ok, ok para cancelado, etc. Somente registros ok seriam importados."

**Veredito: ALINHADO com melhores praticas e ALTAMENTE RECOMENDADO.**

Esta e uma das lacunas mais criticas da implementacao atual. A pesquisa confirma:
- Wave Apps e Maybe Finance permitem override de status de duplicata
- UX Movement recomenda edicao inline para conjuntos limitados de dados
- O modelo de status explicito (`ok | duplicada | cancelada`) e mais claro que o derivado automaticamente

**Impacto**:
1. Adicionar campo `status` explicito ao `ImportPreviewRow` (novo campo, nao derivado)
2. Inicializar status baseado na analise automatica (erro→erro, duplicada→duplicada, sem cat→sem_categoria, ok→ok)
3. Permitir edicao via `<select>` na coluna Status (opcoes: ok, duplicada, cancelada)
4. No `confirmImport`, filtrar apenas `status === 'ok'` com `categoryId` preenchido
5. Manter status de `erro` como nao-editavel (erro de parse e tecnico)

**Opcoes de status recomendadas**: `ok`, `duplicada`, `cancelada` (skip manual)

### 3.5 Dropdown de categorias com busca e subtexto de grupo

> "O dropdown deveria ter possibilidade de pesquisar. Categorias listadas deveriam vir com subtexto do grupo relacionado. Ordenacao por grupo e depois por categoria."

**Veredito: ALINHADO com melhores praticas e FORTEMENTE RECOMENDADO.**

Todos os apps de financas pesquisados (YNAB, Monarch, Lunch Money) usam alguma forma de busca em categorias. Combobox pesquisavel com agrupamento e padrao.

**Detalhamento**:
1. Substituir `<select>` nativo por combobox pesquisavel
2. Fazer JOIN de categorias com `category_groups` para obter nome do grupo
3. Renderizar opcoes com `nome_categoria` e subtexto `nome_grupo`
4. Ordenar: `group.sort_order ASC, category.name ASC`
5. Filtro de busca por texto normalizado (sem acentos, lowercase)

### 3.6 Nomenclatura dos botoes

> "'Confirmar importacao' deveria se chamar apenas 'Importar'. E 'Fechar' deveria ser 'Voltar'."

**Veredito: ALINHADO com melhores praticas.**

"Importar" e mais direto e segue a convencao de verbos de acao em botoes primarios. "Voltar" e adequado quando o modal e uma etapa intermediaria que retorna ao contexto anterior.

**Recomendacao adicional da pesquisa**: Mostrar contagem no botao primario - "Importar (23)" - para dar feedback imediato sobre quantos registros serao importados.

---

## 4. Recomendacoes Consolidadas por Prioridade

### P0 - Criticas (devem estar na spec)

| # | Melhoria | Justificativa | Complexidade |
|---|----------|---------------|-------------|
| 1 | **Status editavel na tabela** | Sem isso, usuario nao controla o que importa. Maior gap funcional. | Media |
| 2 | **Combobox pesquisavel com grupos** | `<select>` com muitas categorias e inutilizavel. Categorias sem grupo sao ambiguas. | Media-Alta |
| 3 | **Backdrop com blur** | Alinhamento visual com padroes modernos + isolamento de contexto. | Baixa |
| 4 | **Format chip condicional** | Disclosure progressivo basico. Trivial de implementar. | Baixa |
| 5 | **Criacao rapida recolhida** | Reduz ruido visual. Icone Plus com toggle. | Baixa |
| 6 | **Renomear botoes** | "Importar" + "Voltar" mais claros. | Baixa |

### P1 - Importantes (recomendadas na spec)

| # | Melhoria | Justificativa | Complexidade |
|---|----------|---------------|-------------|
| 7 | **Drag-and-drop zone** | Padrao de mercado para upload de arquivos. | Media |
| 8 | **Focus trap + Escape + aria-labelledby** | Conformidade WCAG basica para modais. | Media |
| 9 | **Resumo pos-importacao** | Feedback rico ao usuario sobre resultado. | Baixa |
| 10 | **Highlight de linhas por status** | Background-color nas `<tr>` por status (vermelho erro, amarelo duplicada). | Baixa |
| 11 | **Contagem no botao Importar** | "Importar (23)" em vez de apenas "Importar". | Baixa |
| 12 | **Header sticky na tabela** | Usabilidade em tabelas longas. | Baixa |

### P2 - Evolucoes Futuras (nao bloquear spec atual)

| # | Melhoria | Justificativa | Complexidade |
|---|----------|---------------|-------------|
| 13 | FITID para dedup OFX | Reduz falsos positivos dramaticamente | Media |
| 14 | Deteccao de encoding (Windows-1252) | Acentos em extratos de bancos BR | Media |
| 15 | Scroll virtual (@tanstack/react-virtual) | Remover limite de 80 linhas | Media |
| 16 | Checkboxes por linha / bulk actions | Selecao granular de linhas | Media-Alta |
| 17 | Auto-categorization rules (payee→category) | Aprendizado a partir de atribuicoes manuais | Alta |
| 18 | Edicao inline de descricao/data | Correcao de dados antes de importar | Media |
| 19 | Manual column mapping fallback | Quando auto-detect de CSV falha | Alta |
| 20 | Mobile card view | Responsividade em telas pequenas | Media |

---

## 5. Analise Tecnica de Implementacao (P0)

### 5.1 Status Editavel

**Modelo de dados**:
```typescript
// Novo enum explicito
type ImportRowStatus = 'ok' | 'duplicada' | 'erro' | 'sem_categoria' | 'cancelada';

// Adicionar ao ImportPreviewRow
export type ImportPreviewRow = ParsedImportRow & {
  dedupeKey: string;
  isDuplicate: boolean;    // manter para inicializacao
  categoryId: string;
  errorReason: string | null;
  status: ImportRowStatus; // NOVO - editavel pelo usuario
};
```

**Inicializacao do status** (em `previewFile`):
```
if (errorReason) → status = 'erro'
else if (isDuplicate) → status = 'duplicada'
else if (!categoryId) → status = 'sem_categoria'
else → status = 'ok'
```

**Edicao**: `<select>` na coluna Status com opcoes `ok | duplicada | cancelada`. Status `erro` e `sem_categoria` nao devem ser opcionaveis pelo usuario (derivados automaticamente). Quando o usuario muda de `duplicada` para `ok`, o registro passa a ser importavel. Quando muda de `ok` para `cancelada`, o registro e excluido da importacao.

**Filtragem na confirmacao**: `validRows = rows.filter(r => r.status === 'ok' && r.categoryId)`

### 5.2 Combobox Pesquisavel com Grupos

**Dados necessarios**:
```typescript
// Tipo para opcao renderizada
type CategoryOption = {
  id: string;
  name: string;
  groupName: string;
  groupSortOrder: number;
  type: TransactionType;
};
```

**Query/JOIN**: Usar os hooks existentes `useCategories` + `useCategoryGroups` para construir a lista enriquecida. Mapear `category.group_id` → `group.name`.

**Ordenacao**: `groupSortOrder ASC, categoryName ASC`

**Componente**: Implementar como componente reutilizavel `CategoryCombobox` que recebe `categories`, `groups`, `value`, `onChange`, `transactionType`.

### 5.3 Backdrop Blur

**CSS**:
```css
.modal-backdrop {
  backdrop-filter: blur(6px);
  background-color: rgba(0, 0, 0, 0.45);
}
```

### 5.4 Format Chip Condicional

**Antes** (ImportModal.tsx:75):
```tsx
<div className="modal-format-chip">Formato detectado: <strong>{imp.importFormat.toUpperCase()}</strong></div>
```

**Depois**:
```tsx
{imp.importFileName && (
  <div className="modal-format-chip">Formato detectado: <strong>{imp.importFormat.toUpperCase()}</strong></div>
)}
```

### 5.5 Criacao Rapida Toggle

**Estado**: `const [quickCategoryOpen, setQuickCategoryOpen] = useState(false)`

**Renderizacao**:
```tsx
<div className="quick-category-box">
  <button onClick={() => setQuickCategoryOpen(!quickCategoryOpen)}>
    <Plus size={16} /> Criar categoria rapida
  </button>
  {quickCategoryOpen && (
    <div className="quick-category-grid">
      {/* inputs e botao existentes */}
    </div>
  )}
</div>
```

---

## 6. Referencias Completas

### UX e Design de Importacao
- [Designing An Attractive And Usable Data Importer](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/) - Smashing Magazine
- [How To Design Bulk Import UX](https://smart-interface-design-patterns.com/articles/bulk-ux/) - Smart Interface Design Patterns
- [Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/) - NN/g
- [UX best practices for file uploader](https://uploadcare.com/blog/file-uploader-ux-best-practices/) - Uploadcare
- [Building a Modern Drag-and-Drop Upload UI](https://blog.filestack.com/building-modern-drag-and-drop-upload-ui/) - Filestack

### CSV/OFX Parsing
- [5 Best Practices for Building a CSV Uploader](https://www.oneschema.co/blog/building-a-csv-uploader) - OneSchema
- [10 Advanced CSV Import Features](https://www.oneschema.co/blog/advanced-csv-import-features) - OneSchema
- [Inside CSVBox: How Column Mapping Really Works](https://blog.csvbox.io/inside-csvbox-column-mapping/) - CSVBox
- [OFX Banking Specification v2.3](https://financialdataexchange.org/common/Uploaded%20files/OFX%20files/OFX%20Banking%20Specification%20v2.3.pdf) - Financial Data Exchange
- [Open Financial Exchange](https://en.wikipedia.org/wiki/Open_Financial_Exchange) - Wikipedia

### Tabelas e Edicao Inline
- [UX Pattern Analysis: Enterprise Data Tables](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) - Pencil & Paper
- [Best Practices for Inline Editing in Table Design](https://uxdworld.com/inline-editing-in-tables-design/) - UX Design World
- [The Best Bulk Edit UI for Data Tables](https://uxmovement.substack.com/p/the-best-bulk-edit-ui-for-data-tables) - UX Movement

### Apps de Financas (benchmark)
- [Categorizing Transactions](https://support.ynab.com/en_us/categorizing-transactions-a-guide-HyRl60sks) - YNAB
- [Import Transaction History Manually](https://help.monarch.com/hc/en-us/articles/4409682789908-Import-Transaction-History-Manually) - Monarch Money
- [Auto-Categorization](https://support.lunchmoney.app/setup/categories/auto-categorization) - Lunch Money
- [Data Importer](https://github.com/firefly-iii/data-importer) - Firefly III
- [Duplicate Transaction Detection for CSV](https://github.com/maybe-finance/maybe/issues/1214) - Maybe Finance
- [Resolve Duplicate Transactions](https://support.waveapps.com/hc/en-us/articles/115000423886) - Wave Apps

### Acessibilidade
- [How to Build Accessible Modals with Focus Traps](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/) - UXPin
- [Accessible Modals & Dialogs](https://www.thewcag.com/examples/modals-dialogs) - WCAG 2.2 Guide
- [ComboBox](https://react-spectrum.adobe.com/react-aria/ComboBox.html) - React Aria
- [Combobox](https://headlessui.com/react/combobox) - Headless UI

### Responsividade em Tabelas
- [Mobile Tables](https://www.nngroup.com/articles/mobile-tables/) - NN/g
- [5 Practical Solutions for Responsive Data Tables](https://medium.com/appnroll-publication/5-practical-solutions-to-make-responsive-data-tables-ff031c48b122) - Medium/AppnRoll
