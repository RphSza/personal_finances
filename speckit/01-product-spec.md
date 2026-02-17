# Product Specification (Speckit)

## 1. Objetivo do produto

Construir uma plataforma SaaS de gestão financeira pessoal/familiar com:
- controle de receitas e despesas,
- planejamento (previsto x realizado),
- módulo completo de investimentos,
- módulo de orçamento,
- integrações financeiras,
- multi-tenant por workspace,
- governança e conformidade LGPD.

## 2. Problema que resolve

Usuários hoje operam em planilhas com:
- pouca rastreabilidade,
- baixa segurança,
- dificuldade de colaboração,
- baixa escalabilidade para histórico + previsão + investimentos.

## 3. Personas

1. `Owner/Admin do Workspace`
- controla assinaturas/add-ons,
- gerencia usuários/perfis,
- cria categorias, regras e automações.

2. `Viewer`
- consulta dados e relatórios,
- não altera dados.

3. `Usuário final investidor`
- precisa de visão consolidada de caixa + patrimônio + metas.

## 4. Escopo funcional (target)

## 4.1 Núcleo financeiro
- lançamentos (`previsto`, `realizado`, `cancelado`),
- recorrências automáticas,
- fechamento mensal,
- dashboard com tendências e comparativos,
- gestão de categorias e grupos.
- visualização alternativa de lançamentos em estrutura espacial por grupos (estilo board, não-kanban linear).

## 4.2 Investimentos (novo módulo)
- classes: renda fixa, renda variável, fundos, cripto, previdência (extensível),
- cadastro de ativos e contas de custódia,
- operações: aporte, compra, venda, resgate, juros/dividendos, taxas, impostos,
- posição consolidada por ativo, classe e conta,
- custo médio, PnL (realizado e não realizado), rentabilidade por período,
- conciliação com lançamentos financeiros.

## 4.3 Orçamento (novo módulo)
- orçamento por mês/categoria,
- orçamento por envelope/meta,
- acompanhamento de execução (`orçado`, `realizado`, `desvio`),
- alertas de estouro.

## 4.4 Gestão SaaS
- workspaces (contas de cliente),
- membros e papéis (owner/admin/viewer),
- add-ons por workspace,
- trilha para cobrança futura (Asaas/PagBank).

## 4.5 Integrações
- importação manual: CSV/OFX/XLSX,
- integração Open Finance (via agregador),
- ingestão de fatura/cartão,
- entrada via WhatsApp com confirmação.

## 4.6 Board de Lançamentos (feature audaciosa)
- estrutura visual que lembra kanban, mas com foco em organização por grupo/categoria, não em fluxo esquerda-direita.
- áreas/grupos contendo cards de lançamentos.
- drag-and-drop de lançamento entre:
  - áreas/grupos (com reclassificação automática de grupo),
  - categorias (com recategorização ao soltar).
- CRUD completo de cards diretamente no board.
- CRUD completo de áreas/grupos visuais.
- redimensionamento horizontal e vertical de áreas.
- rearranjo (drag-and-drop) de grupos inteiros no board.
- zoom in/out do board.
- rolagem horizontal e vertical interna.
- código de cores por status do lançamento (`previsto`, `realizado`, `cancelado`).

Observação:
- essa feature deve preservar coerência com o modelo financeiro formal (ledger), evitando divergência entre visual e dado contábil.

## 5. Requisitos funcionais prioritários

## RF-01: Multi-tenant real
- todo dado de negócio deve ter `workspace_id`;
- RLS obrigatório por workspace.

## RF-02: RBAC
- `owner/admin`: CRUD completo;
- `viewer`: leitura.

## RF-03: Lançamentos + recorrências
- recorrências devem materializar automaticamente no mês-alvo sem duplicação.

## RF-04: Investimentos
- CRUD de operações;
- cálculo de posição e retorno.

## RF-05: Orçamento
- CRUD de orçamento mensal;
- comparativo orçamento x realizado.

## RF-06: Relatórios essenciais
- série temporal mensal,
- previsto x realizado,
- top despesas,
- evolução patrimonial.

## RF-07: Gestão de usuários
- convite por email,
- ativação/inativação,
- alteração de perfil.

## RF-08: Board de Lançamentos
- oferecer modo de visualização `lista` e `board` para o mesmo conjunto de lançamentos.
- permitir mover lançamentos com reclassificação e recategorização persistidas no banco.
- permitir redimensionar e reposicionar grupos visuais.
- suportar edição/exclusão/criação no próprio board.
- manter comportamento idempotente e auditável para operações de drag-and-drop.

## RF-09: Experiência semelhante à planilha, porém profissional
- permitir visão ampla por grupos e cards em uma superfície navegável.
- manter consistência de totais e dashboards ao alterar dados no board.
- garantir usabilidade desktop e mobile.

## 6. Requisitos não funcionais

- Segurança by default (RLS, least privilege).
- Performance: consultas de dashboard < 2s (P95).
- Disponibilidade alvo: 99.5% (fase inicial).
- Auditoria de alterações sensíveis.
- Responsividade mobile-first para uso diário.
- Interações de drag-and-drop com fallback acessível para touch/mobile.
- Suporte a zoom e pan sem degradação severa de performance.

## 7. KPIs de produto

- % de usuários ativos semanais (WAU/MAU).
- % de lançamentos com categoria correta.
- diferença média previsto x realizado.
- taxa de fechamento mensal.
- adesão ao módulo de investimentos.
- adesão ao modo board de lançamentos.
- taxa de reclassificação via drag-and-drop sem erro de dados.

## 8. Critérios de sucesso

- usuário consegue operar sem planilha em 30 dias;
- geração de relatório mensal sem ajuste manual externo;
- suporte a múltiplos clientes em workspaces isolados.

## 9. Proximas entregas priorizadas (12 semanas)

Objetivo:
- garantir operacao financeira mensal sem planilha externa, com isolamento multi-tenant e governanca basica.

Escopo de produto:
- S1: multi-tenant + RBAC completo.
- S2: recorrencia automatica idempotente + fechamento mensal robusto.
- S3: importador CSV/OFX com preview e dedupe.
- S4: orcamento v1 e dashboard basico.

Nao-escopo neste ciclo:
- automacao completa via Open Finance.
- billing em producao.
- investimentos v1 completo.

Criterios de sucesso do ciclo:
- 95% dos fechamentos de mes sem ajuste manual externo.
- 0 incidente de acesso cruzado entre workspaces.
- taxa de dedupe >= 99% no importador.
