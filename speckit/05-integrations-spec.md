# Integrations Specification (Speckit)

## 1. Objetivo

Padronizar integrações com bancos/cartões, canais de entrada e billing.

## 2. Estratégia de integração (fases)

## Fase 1 - Importação manual confiável
- CSV/OFX/XLSX de extrato e fatura.
- Mapeamento de colunas assistido.
- Deduplicação por hash (`workspace_id + date + amount + description`).

## Fase 2 - Conectores Open Finance
- Via agregadores (ex.: Pluggy, Belvo, Quanto).
- Sincronização incremental.
- Reprocessamento idempotente.

## Fase 3 - Automatização avançada
- Categorização assistida por regras.
- Conciliação automática.
- Alertas de divergência.

## 3. Cartão de crédito (muito prioritário)

## Requisitos
- Importar faturas por ciclo.
- Associar transações ao cartão.
- Identificar parcelamentos.
- Fechamento por mês de competência e por data real de compra.

## Modelo sugerido
- `cards`, `card_cycles`, `card_transactions`, `card_installments`.

## 4. WhatsApp como canal de lançamento

## Fluxo
1. Usuário envia mensagem (texto/áudio/foto).
2. Webhook recebe evento.
3. Parser extrai entidade financeira.
4. Sistema responde com resumo para confirmação.
5. Confirmado: grava lançamento.

## Requisitos técnicos
- endpoint webhook seguro com assinatura.
- fila assíncrona para parsing/OCR.
- fallback manual quando confiança baixa.

## 5. Billing e add-ons (futuro próximo)

- Integração com Asaas/PagBank via webhook.
- Estados de assinatura: `trial`, `active`, `past_due`, `canceled`.
- Add-ons:
  - integração bancária,
  - WhatsApp,
  - relatórios avançados,
  - múltiplos usuários extras.

## 6. Contratos de integração

Para cada conector, definir:
- SLA esperado,
- limites de rate,
- política de retry,
- tratamento de indisponibilidade,
- telemetria e alertas.

## 7. Entregas de integracao no curto prazo

Sprint S3 - Importador manual v1:
- suportar CSV e OFX com template de mapeamento reutilizavel.
- incluir preview com classificacao sugerida e dedupe antes de confirmar.
- registrar rejeicoes por linha com motivo tecnico.

Sprint S4 - Cartao v1 (escopo minimo):
- importar fatura e identificar parcelamentos simples.
- consolidar valor por ciclo para conciliacao com ledger.

Pre-condicoes de evolucao para Open Finance (Q3):
- importador manual com taxa de erro operacional < 2%.
- modelo de contas/cartoes estabilizado.
- observabilidade pronta para sincronizacao incremental.

Controles tecnicos obrigatorios:
- idempotencia por hash de transacao + workspace.
- retries com backoff exponencial.
- feature flag por workspace para conectores externos.
