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
