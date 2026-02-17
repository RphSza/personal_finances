# Security and LGPD Specification (Speckit)

## 1. Objetivo

Garantir confidencialidade, integridade, disponibilidade e conformidade LGPD para dados financeiros.

## 2. Controles de segurança mandatórios

## 2.1 Identidade e acesso
- Auth com MFA opcional para admins.
- RBAC por workspace.
- Princípio de menor privilégio em políticas RLS.

## 2.2 Banco de dados
- RLS em 100% das tabelas de negócio.
- Políticas sempre baseadas em:
  - `auth.uid()`
  - vínculo em `workspace_members`.
- Segredos e chaves fora do frontend.

## 2.3 Criptografia
- Em trânsito: TLS 1.2+.
- Em repouso: criptografia gerenciada pelo provedor.
- Campos sensíveis opcionais com criptografia de aplicação.

## 2.4 Auditoria
- Log de ações críticas:
  - alteração de papéis,
  - exclusão de dados,
  - importações,
  - integrações externas.

## 2.5 Segurança de aplicação
- Sanitização e validação de input.
- Rate limiting para login e endpoints sensíveis.
- Proteções CSRF/XSS/SQLi conforme stack.

## 3. LGPD - requisitos práticos

## 3.1 Base legal e transparência
- Termos e política de privacidade claros.
- Consentimento explícito para integrações bancárias.

## 3.2 Minimização
- Coletar apenas dados necessários por funcionalidade.
- Evitar persistência de dados irrelevantes em logs.

## 3.3 Direitos do titular
- Exportação de dados.
- Correção de dados.
- Exclusão/anonimização (quando aplicável).
- Portabilidade.

## 3.4 Retenção e descarte
- Política por tipo de dado.
- Rotina de purge/anonymization em dados expurgáveis.

## 3.5 Gestão de incidentes
- Playbook de incidente:
  - detecção,
  - classificação,
  - contenção,
  - comunicação,
  - lições aprendidas.

## 4. Contratos e terceiros

- DPA com provedores (infra, Open Finance, WhatsApp, billing).
- Registro de suboperadores e finalidade de uso.
- Avaliação de risco por fornecedor.

## 5. Checklist de go-live

- [ ] RLS revisado e testado.
- [ ] Segredos rotacionáveis.
- [ ] Logs de auditoria ativos.
- [ ] Política de privacidade publicada.
- [ ] Processo de atendimento LGPD documentado.

## 6. Plano de seguranca para proximas entregas

S1 - Multi-tenant e RBAC:
- executar matriz de autorizacao por papel e por recurso.
- validar RLS com testes de negacao explicita.
- revisar privilegios de service role para minimo necessario.

S2 - Recorrencia e fechamento:
- proteger jobs com escopo de workspace e trilha de auditoria.
- alertar para tentativas de reprocessamento fora da janela esperada.

S3 - Importador:
- validacao de mime type e tamanho de arquivo.
- sanitizacao de campos livres antes de persistir preview.
- rate limit por workspace para upload e confirmacao.

S4 - Orcamento e dashboard:
- controle de acesso de leitura para `viewer` sem privilegios de escrita.
- mascaramento de campos sensiveis em logs de erro.

Evidencias obrigatorias por release:
- relatorio de testes de RLS.
- checklist LGPD atualizado com impacto das novas features.
- registro de riscos e plano de resposta.
