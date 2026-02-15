# Personal Finances Frontend

Frontend em React 19 + Vite 6 para gerenciar finanças pessoais com Supabase (PostgreSQL).

## Stack

- React 19
- Vite 6
- TypeScript
- Supabase JS

## Setup

1. Instale dependências:

```bash
npm install
```

2. Configure variáveis:

```bash
cp .env.example .env.local
```

Preencha:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Garanta que o DDL foi executado no Supabase:

- `supabase_ddl.sql`

4. Rode o projeto:

```bash
npm run dev
```

## Funcionalidades iniciais

- Seleção de competência mensal.
- KPIs de receita, despesa, investimento e resultado.
- CRUD de lançamentos (`entries`) com status previsto/realizado/cancelado.
- Cadastro rápido de grupos e categorias.
- Projeção automática do próximo mês a partir de `recurrence_rules`.

## Observações de produção

- Crie políticas RLS para `months`, `category_groups`, `categories`, `entries`, `recurrence_rules` e `monthly_balances`.
- Para multiusuário, adicione `user_id` nas tabelas principais e filtre por usuário em todas as queries/policies.
