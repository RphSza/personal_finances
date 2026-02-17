# Personal Finances - Development Guidelines

## Overview

Aplicacao web de financas pessoais com foco em:
- controle de lancamentos e recorrencias,
- visao analitica (dashboard),
- administracao de configuracoes (grupos, categorias, usuarios),
- backend/data layer em Supabase com RLS.

## Tech Stack

### Frontend
- React 19 + Vite 6 + TypeScript
- TanStack Router (rotas com URL real)
- TanStack Query (cache e estado de dados)
- CSS proprio com design tokens em `src/styles.css`

### Backend/Infra
- Supabase (Postgres, Auth, RLS)

## Project Structure

```text
src/
  features/
    auth/
    dashboard/
    entries/
    settings/
    app/
  layout/
  lib/
  types.ts
speckit/
  *.md (produto, arquitetura, dados, seguranca, roadmap, identidade visual)
LICOES_APRENDIDAS.md
```

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Mandatory Operating Rule

Antes de tarefas relevantes de evolucao funcional, tecnica ou estrategica, consultar:
- `LICOES_APRENDIDAS.md`
- `speckit/README.md`

## Key Rules

1. Nomenclatura tecnica em ingles:
- pastas, arquivos, componentes, hooks e tipos em ingles.

2. Linguagem de produto em portugues:
- textos exibidos para usuario final em pt-BR.

3. Seguranca e dados:
- nao remover isolamento por RLS,
- manter filtros por contexto de workspace/usuario quando aplicavel,
- tratar mutacoes com validacao e tratamento de erro.

4. Arquitetura de frontend:
- `App.tsx` deve orquestrar estado e composicao de tela,
- UI e layout devem ficar em `features/*` e `layout/*`,
- evitar concentrar logica nova em um unico arquivo.

5. Estado remoto:
- preferir TanStack Query para leitura/mutacao de dados,
- usar chaves de query estaveis e invalidao explicita apos mutacao.

6. Router:
- novas telas devem ter rota dedicada quando fizer sentido de navegacao,
- preservar deep link (`/entries`, `/settings/users`, etc.).

7. Qualidade de entrega:
- build deve passar antes de concluir (`npm run build`),
- manter responsividade desktop/mobile,
- atualizar specs em `speckit/` quando a mudanca alterar direcao de produto/arquitetura.

## Skills Available

- `speckit`:
  documentacao e especificacao de produto, arquitetura, dados, seguranca, integracoes e roadmap.

## PR Checklist

Antes de concluir uma entrega relevante, confirmar:
- [ ] `npm run build` executou sem erro.
- [ ] fluxos principais testados em desktop e mobile.
- [ ] nenhuma quebra visual de layout (overflow, header, grids).
- [ ] novas rotas e navegacao validadas (URL direta + voltar/avancar).
- [ ] strings exibidas ao usuario estao em pt-BR.
- [ ] mudancas de produto/arquitetura documentadas em `speckit/` quando aplicavel.
- [ ] aprendizado relevante registrado em `LICOES_APRENDIDAS.md` quando houver risco/erro novo.
