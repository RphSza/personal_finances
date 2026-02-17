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
