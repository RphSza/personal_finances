# Lições Aprendidas

Este arquivo deve ser consultado antes de mudanças relevantes no produto, arquitetura, dados e UX.

## Regra de uso

- Sempre ler este arquivo no início de qualquer tarefa de evolução.
- Ao final de cada tarefa relevante, registrar:
  - contexto,
  - erro/risco observado,
  - causa raiz,
  - ação preventiva.

## Histórico

## 2026-02-15 - Acentuação quebrada na UI
- Contexto: termos em português apareciam com caracteres corrompidos.
- Causa raiz: texto com encoding inconsistente em partes dos arquivos e cache de bundle no navegador.
- Ação preventiva:
  - padronizar UTF-8 em todos os arquivos de frontend,
  - rodar busca por caracteres corrompidos (`Ã`, `�`) antes de release,
  - instruir hard refresh após mudanças de texto.
  - evitar scripts/shell que salvem com code page local sem forçar UTF-8.

## 2026-02-15 - Projeções recorrentes dependentes de ação manual
- Contexto: usuário esperava que recorrências aparecessem automaticamente no mês seguinte.
- Causa raiz: projeção inicialmente dependia de botão manual.
- Ação preventiva:
  - materializar recorrências automaticamente ao abrir competência,
  - manter operações idempotentes para evitar duplicidade.

## 2026-02-15 - Gestão de usuários e layout de configurações com overflow
- Contexto: seção de usuários extrapolava o card em telas específicas.
- Causa raiz: grid sem `min-width: 0` e controles sem wrap.
- Ação preventiva:
  - sempre testar responsividade desktop/mobile,
  - aplicar padrões de overflow seguro em grids administrativos.

## 2026-02-15 - Falhas em automação de skill por dependência ausente
- Contexto: `init_skill.py` falhou por ausência de `pyyaml`.
- Causa raiz: dependência não instalada no ambiente local.
- Ação preventiva:
  - fallback manual para criação de skill,
  - checklist de dependências para scripts utilitários.

## 2026-02-16 - Roadmap sem granularidade operacional entre specs
- Contexto: revisao e evolucao das especificacoes em `speckit/`, com foco inicial no roadmap/backlog.
- Erro/risco observado: backlog em alto nivel sem detalhamento por sprint, dependencias e criterios verificaveis, gerando risco de execucao desalinhada.
- Causa raiz: roadmap anterior priorizava visao macro e nao explicitava impactos em dados, seguranca e operacao para cada entrega.
- Acao preventiva:
  - definir roadmap trimestral com sprints de 8-10 semanas detalhadas,
  - anexar criterios de aceite, riscos e mitigacoes por sprint,
  - manter seções de alinhamento em `01` a `05` sempre que `06-roadmap-backlog.md` for evoluido.

## 2026-02-17 - Inconsistencia visual por ausencia de design tokens
- Contexto: adequacao de layout para nova identidade visual no login e nas paginas principais.
- Erro/risco observado: tema anterior sem sistema de tokens favorecia divergencia de cores, bordas e tipografia entre modulos.
- Causa raiz: estilos crescidos organicamente sem especificacao visual centralizada.
- Acao preventiva:
  - formalizar identidade em `speckit/07-visual-identity-spec.md`,
  - padronizar tokens no CSS global,
  - exigir validacao desktop/mobile em toda alteracao visual relevante.

## 2026-02-17 - Monolito de interface em `App.tsx` dificultando evolucao
- Contexto: refatoracao estrutural do frontend para separar layout e features em pastas modulares.
- Erro/risco observado: componente unico concentrava autenticacao, navegacao, dashboard, lancamentos e configuracoes, aumentando risco de regressao em cada alteracao.
- Causa raiz: crescimento incremental sem particionamento por dominio.
- Acao preventiva:
  - manter estrutura por feature (`auth`, `dashboard`, `entries`, `settings`) e `layout` compartilhado,
  - limitar `App.tsx` a orquestracao de estado e composicao de telas,
  - exigir build apos cada extracao para validar contratos de props/tipos.

## 2026-02-17 - Navegacao por estado sem URL compartilhavel
- Contexto: evolucao da arquitetura frontend para suporte a rotas reais e melhor usabilidade.
- Erro/risco observado: navegacao interna por estado (`page`) impedia deep links, historico confiavel e compartilhamento de paginas.
- Causa raiz: ausencia de roteador dedicado e de padrao para mapeamento de tela em URL.
- Acao preventiva:
  - adotar TanStack Router com rotas explicitas (`/dashboard`, `/entries`, `/settings/...`, `/auth/login`),
  - manter redirecionamentos de sessao (nao autenticado -> login; autenticado em auth -> dashboard),
  - validar layout de header em estados sem controles mensais para evitar espaco visual residual.

## 2026-02-17 - Importacao financeira sem trilha de lote e deduplicacao fraca
- Contexto: implementacao do Sprint S3 (importador CSV/OFX).
- Erro/risco observado: sem registro por lote e sem deduplicacao consistente, importacoes podem gerar retrabalho, baixa rastreabilidade e duplicidade de lancamentos.
- Causa raiz: fluxo inicial de importacao sem tabelas dedicadas de auditoria e sem chave de dedupe reutilizavel no preview.
- Acao preventiva:
  - registrar cada upload em `import_jobs` e cada linha em `import_job_rows`,
  - aplicar dedupe por chave derivada (`data|valor|tipo|descricao`) contra base existente e dentro do proprio arquivo,
  - manter RLS por `workspace_id` para proteger dados de importacao entre tenants.

## 2026-02-17 - Preview de importacao sem categoria por linha bloqueando confirmacao
- Contexto: evolucao do modal de importacao apos testes com OFX real.
- Erro/risco observado: confirmacao ficava indisponivel sem explicitar causa e sem permitir ajuste fino por registro.
- Causa raiz: categoria unica global e ausencia de edicao por linha no preview.
- Acao preventiva:
  - adotar categoria por linha com sugestao automatica e fallback para \"outros\",
  - permitir criacao rapida de categoria dentro do modal,
  - expor contadores claros (`prontas`, `duplicadas`, `sem categoria`, `erro`) para destravar a decisao do usuario.

## 2026-02-17 - Onboarding sem taxonomia padrao aumenta friccao inicial
- Contexto: necessidade de cobrir casos comuns sem depender de cadastro manual inicial de grupos/categorias.
- Erro/risco observado: usuarios novos ficavam com fluxo de importacao e categorizacao bloqueado/limitado.
- Causa raiz: base inicial vazia de taxonomia por workspace.
- Acao preventiva:
  - manter seed idempotente de grupos/categorias default por workspace,
  - executar backfill em workspaces existentes via migration,
  - criar trigger para aplicar automaticamente em novos workspaces.

## 2026-02-17 - Migracao para catalogo global exige limpeza conservadora
- Contexto: adocao de `template_groups`/`template_categories` com legado em tabelas locais por workspace.
- Erro/risco observado: limpeza agressiva pode apagar personalizacoes ou quebrar historico referenciado por lancamentos/recorrencias.
- Causa raiz: coexistencia temporaria de taxonomia global e local apos backfill.
- Acao preventiva:
  - remover apenas duplicatas locais sem uso operacional e com match exato ao template,
  - preservar registros customizados e todos os que tenham referencia em `entries` ou `recurrence_rules`,
  - executar preview de impacto antes da limpeza efetiva.
