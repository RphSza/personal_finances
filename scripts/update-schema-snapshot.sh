#!/usr/bin/env bash
set -euo pipefail

LOCAL=0
NO_DOCKER=0
KEEP_COMMENTS=0
DRY_RUN=0
DB_URL=""
OUT_FILE="supabase/schema_snapshot.sql"
SCHEMAS="public"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local|-Local)
      LOCAL=1
      shift
      ;;
    --no-docker|-NoDocker)
      NO_DOCKER=1
      shift
      ;;
    --keep-comments|-KeepComments)
      KEEP_COMMENTS=1
      shift
      ;;
    --dry-run|-DryRun)
      DRY_RUN=1
      shift
      ;;
    --db-url|-DbUrl)
      DB_URL="${2:-}"
      shift 2
      ;;
    --out-file|-OutFile)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --schemas|-Schemas)
      SCHEMAS="${2:-public}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

command -v supabase >/dev/null 2>&1 || { echo "supabase not found"; exit 1; }

IFS=',' read -r -a SCHEMA_LIST <<< "$SCHEMAS"
if [[ ${#SCHEMA_LIST[@]} -eq 0 ]]; then
  echo "Provide at least one schema in --schemas"
  exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

if [[ $NO_DOCKER -eq 1 ]]; then
  RESOLVED_URL="${DB_URL:-${SUPABASE_DB_URL:-${DATABASE_URL:-}}}"
  [[ -n "$RESOLVED_URL" ]] || { echo "No DB URL provided. Use --db-url or SUPABASE_DB_URL/DATABASE_URL"; exit 1; }
  command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found"; exit 1; }
  PG_ARGS=(--schema-only --no-owner --no-privileges --file "$OUT_FILE")
  for schema in "${SCHEMA_LIST[@]}"; do
    schema="$(echo "$schema" | xargs)"
    [[ -n "$schema" ]] && PG_ARGS+=(--schema "$schema")
  done
  PG_ARGS+=("$RESOLVED_URL")
  echo "Running fallback: pg_dump ${PG_ARGS[*]}"
  pg_dump "${PG_ARGS[@]}"
  echo "Done. Snapshot updated at $OUT_FILE"
  exit 0
fi

ARGS=(db dump --file "$OUT_FILE")
for schema in "${SCHEMA_LIST[@]}"; do
  schema="$(echo "$schema" | xargs)"
  [[ -n "$schema" ]] && ARGS+=(--schema "$schema")
done
[[ $KEEP_COMMENTS -eq 1 ]] && ARGS+=(--keep-comments)
[[ $DRY_RUN -eq 1 ]] && ARGS+=(--dry-run)

if [[ -n "$DB_URL" ]]; then
  ARGS+=(--db-url "$DB_URL")
elif [[ $LOCAL -eq 1 ]]; then
  ARGS+=(--local)
else
  [[ -f "supabase/.temp/project-ref" ]] || { echo "Supabase project is not linked. Run supabase link --project-ref <project_ref>"; exit 1; }
  ARGS+=(--linked)
fi

echo "Updating schema snapshot: $OUT_FILE"
echo "Running: supabase ${ARGS[*]}"
if supabase "${ARGS[@]}"; then
  echo "Done. Snapshot updated at $OUT_FILE"
  exit 0
fi

[[ $LOCAL -eq 1 ]] && { echo "supabase db dump failed in local mode"; exit 1; }

RESOLVED_URL="${DB_URL:-${SUPABASE_DB_URL:-${DATABASE_URL:-}}}"
[[ -n "$RESOLVED_URL" ]] || { echo "Fallback requires DB URL. Set SUPABASE_DB_URL/DATABASE_URL or --db-url"; exit 1; }
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found"; exit 1; }
PG_ARGS=(--schema-only --no-owner --no-privileges --file "$OUT_FILE")
for schema in "${SCHEMA_LIST[@]}"; do
  schema="$(echo "$schema" | xargs)"
  [[ -n "$schema" ]] && PG_ARGS+=(--schema "$schema")
done
PG_ARGS+=("$RESOLVED_URL")
echo "Trying fallback without Docker via pg_dump..."
pg_dump "${PG_ARGS[@]}"
echo "Done. Snapshot updated at $OUT_FILE"
