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

No PowerShell (Windows), você pode usar:

```powershell
Copy-Item .env.example .env.local
```

Preencha:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Garanta que os DDLs foram executados no Supabase:

- `supabase_ddl.sql`
- `supabase_auth_rbac.sql`

4. Rode o projeto:

```bash
npm run dev
```

## Funcionalidades atuais

- Auth com Supabase (login e signup).
- Perfis `admin` e `viewer` (viewer = somente leitura).
- Sidebar com Dashboard, Lançamentos e Configurações.
- Navegação mensal rápida com faixa de meses (inspirada em abas).
- KPIs de receita, despesa, investimento e resultado.
- CRUD de lançamentos com edição, status e exclusão.
- Visualização em lista e em grade por grupos.
- Gestão de grupos, categorias e usuários na área de Configurações.
- Projeção automática de recorrências ao abrir a competência.

## Bootstrap de admin

Após executar `supabase_auth_rbac.sql`, rode no SQL Editor:

```sql
update public.user_profiles
set role = 'admin'
where id = 'SEU_AUTH_USER_UUID';
```
