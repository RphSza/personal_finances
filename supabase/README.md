# Supabase Workspace

Esta pasta centraliza artefatos locais do Supabase usados neste projeto.

## Estrutura

- `.temp/`: arquivos temporários locais (não versionar conteúdo sensível).
- `edge-functions/`: funções edge por domínio.
- `migrations/`: migrations SQL versionadas.
- `seed/`: scripts/dados para popular ambiente local.
- `config.toml`: configuração local do Supabase CLI.
- `schema_snapshot.sql`: snapshot de referência de schema.

## Convenções

1. Toda mudança de schema deve entrar em `migrations/`.
2. Atualize `schema_snapshot.sql` após mudanças relevantes de dados.
3. Evite duplicar arquivos SQL de produção; mantenha referência ao arquivo canônico.

## Atualizando o snapshot direto do Supabase

Use o script do projeto para gerar o snapshot direto do banco remoto/local:

1. Faça login e link do projeto (uma vez):
   - `supabase login`
   - `supabase link --project-ref <project_ref>`
2. Rode:
   - Remoto (linked): `npm run db:snapshot`
   - Local: `npm run db:snapshot:local`
   - Incluindo schemas extras: `npm run db:snapshot:all`
   - Sem Docker (fallback via `pg_dump`): `npm run db:snapshot:nodocker`

Opcional: usar URL direta do banco:
- `powershell -ExecutionPolicy Bypass -File scripts/update-schema-snapshot.ps1 -DbUrl "<postgres_url>"`

## Observação sobre Docker

O comando `supabase db dump` pode exigir Docker Desktop para montar a imagem de dump.
Se Docker não estiver disponível, use o modo `-NoDocker` com `SUPABASE_DB_URL` e `pg_dump` instalado.
