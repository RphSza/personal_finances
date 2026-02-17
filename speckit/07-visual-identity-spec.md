# Visual Identity Specification

## 1. Objetivo

Definir identidade visual consistente para o sistema, inspirada nos screenshots de referencia (1-9 para linguagem visual e 10 para estrutura desktop), com aplicacao em login e paginas principais.

## 2. Direcao visual

- Linguagem: financeira premium, limpa e acolhedora.
- Tom: neutro claro com acentos terrosos.
- Contraste: priorizar legibilidade e hierarquia clara de informacao.
- Forma: cantos arredondados, superficies suaves e espacamento arejado.

## 3. Design tokens

## 3.1 Cores

- Fundo principal: `#f2efea`
- Fundo secundario: `#e8e1d8`
- Superficie principal: `#fcfaf7`
- Superficie forte: `#ffffff`
- Superficie suave: `#f6efe6`
- Texto principal: `#1f1914`
- Texto secundario: `#6f6257`
- Borda padrao: `#ddd2c3`
- Acento principal: `#7b3f12`
- Acento forte: `#60310f`
- Acento suave: `#f1e4d8`
- Sucesso: `#147346`
- Erro: `#a0362b`

## 3.2 Tipografia

- Fonte base: `Manrope`.
- Numeros monetarios e colunas de valor: `IBM Plex Mono`.
- Escala recomendada:
  - h1: 2.0rem a 2.8rem
  - h2: 1.4rem a 2.2rem
  - h3: 1.1rem a 1.3rem
  - corpo: 0.95rem a 1rem
  - suporte: 0.75rem a 0.85rem

## 3.3 Raios, sombras e espacamento

- Radius XL: `28px`
- Radius LG: `20px`
- Radius MD: `14px`
- Radius SM: `10px`
- Sombra suave: `0 14px 40px rgba(79,56,33,0.08)`
- Sombra de painel: `0 12px 24px rgba(78,55,33,0.07)`

## 4. Componentes-base

- Botao primario: gradiente marrom (`accent -> accent-strong`), texto branco, canto arredondado.
- Botao secundario: fundo `accent-soft`, texto `accent-strong`.
- Input: fundo branco, borda `line`, foco com anel do `accent`.
- Pills/status: fundos claros por semantica (receita, despesa, investimento, previsto, realizado, cancelado).
- Cards e paineis: superficie clara, borda suave, sombra leve.

## 5. Layout de login

Padrao implementado:
- Desktop: split em duas colunas.
  - esquerda: formulario (modo entrar/criar conta).
  - direita: painel visual de marca com cards de contexto financeiro.
- Mobile: colunas empilhadas, mantendo hierarquia.

Regras:
- nao usar azul predominante da referencia original.
- manter acento terroso para CTA e elementos de destaque.

## 6. Layout das paginas principais

Padrao implementado:
- Estrutura desktop tipo workspace (sidebar + area principal), inspirado no screenshot 10.
- Tema claro e quente (sem preto predominante).
- Cards de KPI, paineis de analise, tabelas e board com linguagem unificada.

Regras:
- manter consistencia de tokens em dashboard, lancamentos e configuracoes.
- preservar responsividade (breakpoints 1200, 980 e 720).

## 7. Acessibilidade e UX

- foco visivel em inputs e controles.
- contraste minimo adequado para texto principal e interacoes.
- targets de clique confortaveis em mobile.
- fallback para layouts empilhados em telas pequenas.

## 8. Governanca de evolucao

Ao criar novos componentes:
- reutilizar tokens definidos.
- evitar novas cores fora da paleta sem justificativa.
- validar aparencia desktop/mobile antes de release.
