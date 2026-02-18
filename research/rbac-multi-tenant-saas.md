# Pesquisa: RBAC Multi-Tenant para SaaS Financeiro

**Data**: 2026-02-18
**Contexto**: Avaliar se a arquitetura de papeis proposta (internal/client + owner/admin/viewer) segue boas praticas e padrao profissional de mercado.

---

## 1. Padrao da industria: como provedores maduros fazem

### Clerk (Organizations)
- Modelo **dois niveis** como conceito nativo
- **Sistema**: usuario existe globalmente
- **Organizacao**: usuario tem role scopado por org (`org:admin`, `org:member`)
- Roles customizaveis: `org:<role_name>` (ex: `org:billing_manager`)
- Permissoes seguem `org:<feature>:<action>` (ex: `org:invoices:create`)

### Auth0 (Organizations)
- Atribuicao de role por organizacao
- Usuario pode ter roles diferentes em organizacoes diferentes
- Recomenda avaliar se RBAC puro e suficiente ou se precisa ABAC/ReBAC

### WorkOS (Roles + FGA)
- Duas camadas: RBAC (roles em tokens) + FGA (Fine-Grained Authorization baseado no Google Zanzibar)
- Roles pertencem a organizacoes, nao a usuarios individuais
- Permissoes fluem pela hierarquia de recursos

### Supabase
- Nao tem RBAC nativo — fornece building blocks (RLS, JWT claims, auth hooks)
- Padrao recomendado: Custom Access Token Hook para injetar roles no JWT
- RLS policies leem claims do JWT em vez de subqueries

### Consenso entre provedores
Todo provedor maduro **separa autenticacao de autorizacao** e scopa roles ao contexto do tenant/organizacao. O modelo dois niveis e o padrao dominante.

---

## 2. Hierarquia dois niveis: e boa pratica?

**Sim, e o padrao dominante em SaaS multi-tenant moderno.**

- **Tier 1 — Roles de plataforma**: controle de operacoes globais (config, gestao de tenants, suporte)
  - Tipicamente 2-3 valores: `platform_admin` / `user`
- **Tier 2 — Roles de workspace**: controle de dados scopados ao tenant
  - Tipicamente 3-5 valores: `owner`, `admin`, `member`, `viewer`

### Alternativas ao RBAC puro

| Modelo | Quando usar | Relevancia para nos |
|--------|------------|---------------------|
| **RBAC** | Acessos diretos baseados em papel | Nosso caso primario |
| **ABAC** | Regras condicionais (horario, IP, plano) | Futuro: restricoes por plano |
| **ReBAC** | Acesso por relacionamento (Google Zanzibar) | Nao necessario agora |

**Para financas pessoais, RBAC e o modelo correto.** Padroes de acesso sao diretos (ler/escrever dados no workspace). ABAC pode ser adicionado depois para refinamentos.

---

## 3. Convencao de nomes para roles globais

### O que plataformas maduras usam

| Plataforma | Nomes de role global |
|------------|---------------------|
| Clerk | Sem role global explicito (permissoes de sistema vs custom) |
| Stripe | `super_administrator`, `administrator`, `developer`, `analyst` |
| Linear | Tudo scopado ao workspace |
| Notion | `workspace_owner`, `membership_admin`, `member`, `guest` |

### Analise das opcoes

| Opcao | Pro | Contra |
|-------|-----|--------|
| `admin` / `user` (atual) | Simples | Ambiguo com `admin` do workspace |
| `internal` / `client` | Descreve a relacao de negocio | Pode ser confuso se houver API clients |
| `platform_admin` / `user` | Tecnico e claro | `user` e vago |
| `staff` / `user` | Simples, claro | Menos profissional |
| `operator` / `customer` | Orientado a negocio | Verboso |

### Recomendacao
**`internal` / `client`** e uma boa escolha:
- Descreve a relacao de negocio, nao um nivel tecnico
- Evita ambiguidade com `admin` do workspace
- Auto-documentado: `role = 'internal'` → operador do sistema

---

## 4. Granularidade de roles no workspace

### O que SaaS reais usam

| Plataforma | Roles do workspace |
|------------|-------------------|
| **Notion** | `owner`, `membership_admin`, `member`, `guest` (4) |
| **Linear** | `owner`, `admin`, `member`, `guest` (4) |
| **Slack** | `primary_owner`, `owner`, `admin`, `member`, `guest` (5) |
| **Stripe** | 7+ roles funcionais (developer, analyst, support, etc) |
| **Figma** | `owner`, `admin`, `editor`, `viewer` (4) |
| **Power BI** | `admin`, `member`, `contributor`, `viewer` (4) |

### Gap identificado no nosso schema
Atualmente temos `owner` / `admin` / `viewer`. Falta um **role intermediario** entre "pode gerenciar tudo" e "so pode ver":

- `owner` e `admin` podem tudo (escrever dados E gerenciar workspace)
- `viewer` so pode ler
- **Nao ha role para quem precisa criar/editar transacoes mas nao deve gerenciar workspace**

### Recomendacao: adicionar `member`

```
owner   — Controle total: deletar workspace, transferir ownership
admin   — Gerenciar workspace: convidar usuarios, categorias, fechar periodos
member  — Operacoes do dia a dia: criar/editar transacoes, importar
viewer  — Somente leitura: ver dashboard, relatorios
```

Isso mapeia cenarios reais:
- Familia: titular (`owner`), conjuge que lanca gastos (`member`), filho que so visualiza (`viewer`)
- Equipe: contador com acesso total (`admin`), assistente que lanca (`member`)

---

## 5. Padroes Supabase-especificos

### O que temos de bom
- `workspace_id` em toda tabela de dados
- `has_workspace_role()` como helper centralizado
- `is_admin()` para checks de plataforma
- `security definer` nas functions
- Convencao de nomes nas policies (`tabela.role:operacao`)

### Melhorias recomendadas

**Performance: JWT Claims via Custom Access Token Hook**

Hoje `has_workspace_role()` faz uma subquery por linha avaliada. O padrao recomendado pela Supabase e injetar roles no JWT:

```sql
-- Hook que injeta roles no token
CREATE FUNCTION custom_access_token_hook(event jsonb) RETURNS jsonb AS $$
  -- Injeta platform_role e workspace_roles no app_metadata
  -- RLS le do JWT em vez de fazer subquery
$$;
```

**Seguranca: usar `app_metadata` (nao `user_metadata`)**

Supabase docs alertam: `user_metadata` pode ser modificado pelo usuario. Usar sempre `app_metadata` para dados de autorizacao.

**Index para RLS**

```sql
CREATE INDEX idx_workspace_members_user_active
  ON workspace_members (user_id, active) INCLUDE (workspace_id, role);
```

---

## 6. Seguranca: OWASP + LGPD

### OWASP Top 10 2025: Broken Access Control (#1)

| Vulnerabilidade | Mitigacao no nosso sistema |
|----------------|--------------------------|
| Tenant Impersonation | RLS + JWT-bound workspace_id |
| Broken Tenant Isolation | RLS habilitado em todas tabelas |
| IDOR | Queries filtradas por workspace_id via RLS |
| Privilege Escalation | workspace_members scopado por workspace |
| Tenant Context Injection | Contexto derivado de auth.uid(), nao do cliente |

### LGPD (Arts. 46-49)
- RLS fornece medida tecnica para segregacao de dados (Art. 46)
- RBAC implementa principio do menor privilegio
- Audit events suportam accountability
- Cascade delete em workspace permite direito a exclusao
- Considerar: funcionalidade de exportacao de dados (portabilidade)

---

## 7. Resultado: validacao da proposta

### Decisoes validadas (manter)

| Decisao | Status | Evidencia |
|---------|--------|-----------|
| Modelo dois niveis (plataforma + workspace) | Validado | Padrao universal (Clerk, Auth0, WorkOS) |
| RLS em toda tabela com `workspace_id` | Validado | OWASP + Supabase best practices |
| `internal` / `client` como nomes de role global | Validado | Evita ambiguidade, auto-documentado |
| Audit events com scoping por workspace | Validado | GDPR/LGPD aligned |

### Mudancas recomendadas

| Area | Atual | Recomendado | Prioridade |
|------|-------|-------------|------------|
| Workspace roles | `owner/admin/viewer` | `owner/admin/member/viewer` | Alta |
| Naming global | `admin/user` | `internal/client` | Alta |
| RLS performance | Subquery via function | JWT claims via Auth Hook | Media |
| Index para RLS | Ausente | `idx_workspace_members_user_active` | Media |

---

## Fontes

### Padroes da industria
- [WorkOS: Top RBAC Providers for Multi-Tenant SaaS 2025](https://workos.com/blog/top-rbac-providers-for-multi-tenant-saas-2025)
- [Permit.io: Best Practices for Multi-Tenant Authorization](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization)
- [Auth0: How to Choose Authorization Model for Multi-Tenant SaaS](https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/)
- [Enterprise Ready SaaS: RBAC Guide](https://www.enterpriseready.io/features/role-based-access-control/)

### Provedores
- [Clerk: Organizations Roles and Permissions](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions)
- [WorkOS: Fine-Grained Authorization (FGA)](https://workos.com/docs/fga)
- [Stripe: Roles and Permissions](https://docs.stripe.com/get-started/account/teams/roles)
- [Supabase: Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Exemplos reais
- [Linear: Members and Roles](https://linear.app/docs/members-roles)
- [Notion: Sharing and Permissions](https://www.notion.com/help/sharing-and-permissions)
- [Slack: Types of Roles](https://slack.com/help/articles/360018112273-Types-of-roles-in-Slack)
- [Power BI: Workspace Roles](https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-roles-new-workspaces)

### Seguranca
- [OWASP Top 10 2025: Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/)
- [OWASP: Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [GDPR Article 32](https://gdpr-info.eu/art-32-gdpr/)

### RBAC vs ABAC vs ReBAC
- [Permit.io: RBAC vs ABAC vs ReBAC](https://www.permit.io/blog/rbac-vs-abac-and-rebac-choosing-the-right-authorization-model)
- [Oso: RBAC vs ABAC vs PBAC 2025](https://www.osohq.com/learn/rbac-vs-abac-vs-pbac)
