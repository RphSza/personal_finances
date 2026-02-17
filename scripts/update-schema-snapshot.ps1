param(
  [switch]$Local,
  [string]$DbUrl,
  [string]$OutFile = "supabase/schema_snapshot.sql",
  [string]$Schemas = "public",
  [switch]$KeepComments,
  [switch]$DryRun,
  [switch]$NoDocker
)

$ErrorActionPreference = "Stop"

function Assert-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Command '$name' not found. Install it and try again."
  }
}

function Try-SupabaseDump($arguments) {
  & supabase @arguments
  return $LASTEXITCODE
}

function Run-PgDump($url, $schemaItems, $filePath) {
  Assert-Command "pg_dump"
  $pgArgs = @("--schema-only", "--no-owner", "--no-privileges", "--file", $filePath)
  foreach ($schema in $schemaItems) {
    $pgArgs += @("--schema", $schema)
  }
  $pgArgs += $url
  Write-Host "Running fallback: pg_dump $($pgArgs -join ' ')"
  & pg_dump @pgArgs
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE."
  }
}

Assert-Command "supabase"

$schemaList = @()
if ($Schemas) {
  $schemaList = $Schemas.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
}

if ($schemaList.Count -eq 0) {
  throw "Provide at least one schema in -Schemas (e.g. public)."
}

if (-not $DbUrl -and -not $Local) {
  $projectRefFile = "supabase/.temp/project-ref"
  if (-not (Test-Path -Path $projectRefFile)) {
    throw "Supabase project is not linked. Run: supabase login; supabase link --project-ref <project_ref>"
  }
}

$outDir = Split-Path -Path $OutFile -Parent
if ($outDir -and -not (Test-Path -Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$args = @("db", "dump", "--file", $OutFile)
foreach ($schema in $schemaList) {
  $args += @("--schema", $schema)
}

if ($KeepComments) {
  $args += "--keep-comments"
}
if ($DryRun) {
  $args += "--dry-run"
}

if ($DbUrl) {
  $args += @("--db-url", $DbUrl)
} elseif ($Local) {
  $args += "--local"
} else {
  $args += "--linked"
}

Write-Host "Updating schema snapshot: $OutFile"
if ($NoDocker) {
  $resolvedUrl = $DbUrl
  if (-not $resolvedUrl) {
    $resolvedUrl = $env:SUPABASE_DB_URL
  }
  if (-not $resolvedUrl) {
    $resolvedUrl = $env:DATABASE_URL
  }
  if (-not $resolvedUrl) {
    throw "No DB URL provided. Use -DbUrl or set SUPABASE_DB_URL/DATABASE_URL."
  }
  Run-PgDump -url $resolvedUrl -schemaItems $schemaList -filePath $OutFile
  Write-Host "Done. Snapshot updated at $OutFile"
  exit 0
}

Write-Host "Running: supabase $($args -join ' ')"
$code = Try-SupabaseDump -arguments $args
if ($code -ne 0) {
  Write-Warning "supabase db dump failed (exit $code)."
  if ($Local) {
    throw "supabase db dump failed in local mode."
  }

  $resolvedUrl = $DbUrl
  if (-not $resolvedUrl) {
    $resolvedUrl = $env:SUPABASE_DB_URL
  }
  if (-not $resolvedUrl) {
    $resolvedUrl = $env:DATABASE_URL
  }
  if (-not $resolvedUrl) {
    throw "Fallback requires DB URL. Set SUPABASE_DB_URL (or DATABASE_URL), or pass -DbUrl."
  }

  Write-Host "Trying fallback without Docker via pg_dump..."
  Run-PgDump -url $resolvedUrl -schemaItems $schemaList -filePath $OutFile
}

Write-Host "Done. Snapshot updated at $OutFile"
