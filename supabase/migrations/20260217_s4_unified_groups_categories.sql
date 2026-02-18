-- Sprint S4: unified taxonomy model
--
-- Model:
--   workspace_id NULL   = global system default
--   workspace_id <uuid> = custom record created by a workspace
--
-- Global groups accept global AND workspace categories.
-- Custom groups only accept categories from the same workspace.
-- Soft delete (deleted_at) for custom records; global records require admin.

begin;

-- ============================================================
-- 1) Soft-delete aware uniqueness indexes
-- ============================================================

-- category_groups: workspace scope
create unique index if not exists uq_category_groups_workspace_code_active
  on public.category_groups(workspace_id, upper(code))
  where workspace_id is not null and deleted_at is null;

create unique index if not exists uq_category_groups_workspace_name_active
  on public.category_groups(workspace_id, lower(name))
  where workspace_id is not null and deleted_at is null;

-- category_groups: global scope
create unique index if not exists uq_category_groups_global_code_active
  on public.category_groups(upper(code))
  where workspace_id is null and deleted_at is null;

create unique index if not exists uq_category_groups_global_name_active
  on public.category_groups(lower(name))
  where workspace_id is null and deleted_at is null;

-- categories: workspace scope
create unique index if not exists uq_categories_workspace_code_active
  on public.categories(workspace_id, lower(code))
  where workspace_id is not null and deleted_at is null;

create unique index if not exists uq_categories_workspace_group_name_active
  on public.categories(workspace_id, group_id, lower(name))
  where workspace_id is not null and deleted_at is null;

-- categories: global scope
create unique index if not exists uq_categories_global_group_code_active
  on public.categories(group_id, lower(code))
  where workspace_id is null and deleted_at is null;

create unique index if not exists uq_categories_global_group_name_active
  on public.categories(group_id, lower(name))
  where workspace_id is null and deleted_at is null;

-- ============================================================
-- 2) Scope integrity (hybrid model)
--
--   custom group  (ws NOT NULL) -> category must be same workspace
--   global group  (ws NULL)     -> category can be global OR any workspace
--   global category             -> must belong to a global group
-- ============================================================
create or replace function public.enforce_category_scope_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_workspace_id uuid;
  v_group_deleted_at timestamptz;
begin
  select g.workspace_id, g.deleted_at
    into v_group_workspace_id, v_group_deleted_at
  from public.category_groups g
  where g.id = new.group_id;

  if not found then
    raise exception 'Invalid group for category.';
  end if;

  if v_group_deleted_at is not null then
    raise exception 'Group is deleted. Select an active group.';
  end if;

  -- Custom group: category must belong to the same workspace
  if v_group_workspace_id is not null
     and new.workspace_id is distinct from v_group_workspace_id then
    raise exception 'Workspace category must belong to the same workspace as its group.';
  end if;

  -- Global category can only belong to a global group
  if new.workspace_id is null and v_group_workspace_id is not null then
    raise exception 'Global category can only belong to a global group.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_categories_enforce_scope on public.categories;
create trigger trg_categories_enforce_scope
before insert or update on public.categories
for each row execute function public.enforce_category_scope_match();

-- ============================================================
-- 3) Global soft delete: admin only
-- ============================================================
create or replace function public.enforce_global_taxonomy_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.workspace_id is null
     and new.deleted_at is distinct from old.deleted_at
     and not public.is_admin() then
    raise exception 'Only global admins can delete/restore global records.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_category_groups_global_soft_delete on public.category_groups;
create trigger trg_category_groups_global_soft_delete
before update on public.category_groups
for each row execute function public.enforce_global_taxonomy_soft_delete();

drop trigger if exists trg_categories_global_soft_delete on public.categories;
create trigger trg_categories_global_soft_delete
before update on public.categories
for each row execute function public.enforce_global_taxonomy_soft_delete();

-- ============================================================
-- 4) Global taxonomy seed
-- ============================================================
do $$
begin
  if not exists (select 1 from public.category_groups where workspace_id is null limit 1) then

    insert into public.category_groups (workspace_id, code, name, sort_order) values
      (null, 'RECEITAS',       'Receitas',            10),
      (null, 'MORADIA',        'Moradia',             20),
      (null, 'ALIMENTACAO',    'Alimentacao',         30),
      (null, 'TRANSPORTE',     'Transporte',          40),
      (null, 'SAUDE',          'Saude',               50),
      (null, 'EDUCACAO',       'Educacao',            60),
      (null, 'LAZER',          'Lazer e cultura',     70),
      (null, 'FAMILIA',        'Familia e cuidados',  80),
      (null, 'FINANCEIRO',     'Financeiro',          90),
      (null, 'TRABALHO',       'Trabalho e negocio', 100),
      (null, 'IMPOSTOS',       'Impostos e taxas',   110),
      (null, 'INVESTIMENTOS',  'Investimentos',      120);

    insert into public.categories
      (workspace_id, group_id, code, name, default_type, default_is_recurring, sort_order)
    select null, g.id, c.code, c.name, c.default_type::public.transaction_type,
           c.default_is_recurring, c.sort_order
    from (values
      -- RECEITAS
      ('RECEITAS', 'salario',           'Salario',                'income',     true,  10),
      ('RECEITAS', 'pro_labore',        'Pro-labore',             'income',     true,  20),
      ('RECEITAS', 'freelas',           'Freelas e servicos',     'income',     false, 30),
      ('RECEITAS', 'renda_aluguel',     'Renda de aluguel',       'income',     true,  40),
      ('RECEITAS', 'cashback_estorno',  'Cashback e estornos',    'income',     false, 50),
      ('RECEITAS', 'outros_receitas',   'Outros ganhos',          'income',     false, 90),

      -- MORADIA
      ('MORADIA', 'aluguel',            'Aluguel',                     'expense', true,  10),
      ('MORADIA', 'condominio',         'Condominio',                  'expense', true,  20),
      ('MORADIA', 'luz',                'Luz',                         'expense', true,  30),
      ('MORADIA', 'agua_esgoto',        'Agua e esgoto',               'expense', true,  40),
      ('MORADIA', 'gas',                'Gas',                         'expense', true,  50),
      ('MORADIA', 'internet',           'Internet e telefone',         'expense', true,  60),
      ('MORADIA', 'iptu',               'IPTU',                        'expense', false, 70),
      ('MORADIA', 'manutencao_moradia', 'Manutencao da casa',          'expense', false, 80),
      ('MORADIA', 'moveis_eletro',      'Moveis e eletrodomesticos',   'expense', false, 85),
      ('MORADIA', 'outros_moradia',     'Outros moradia',              'expense', false, 90),

      -- ALIMENTACAO
      ('ALIMENTACAO', 'supermercado',        'Supermercado',        'expense', true,  10),
      ('ALIMENTACAO', 'restaurantes',        'Restaurantes',        'expense', false, 20),
      ('ALIMENTACAO', 'delivery',            'Delivery',            'expense', false, 30),
      ('ALIMENTACAO', 'padaria_feira',       'Padaria e feira',     'expense', false, 40),
      ('ALIMENTACAO', 'outros_alimentacao',  'Outros alimentacao',  'expense', false, 90),

      -- TRANSPORTE
      ('TRANSPORTE', 'combustivel',        'Combustivel',                 'expense', true,  10),
      ('TRANSPORTE', 'transporte_app',     'Transporte por app e taxi',   'expense', false, 20),
      ('TRANSPORTE', 'transporte_publico', 'Transporte publico',          'expense', true,  30),
      ('TRANSPORTE', 'manutencao_veiculo', 'Manutencao de veiculo',       'expense', false, 40),
      ('TRANSPORTE', 'seguro_veiculo',     'Seguro do veiculo',           'expense', true,  50),
      ('TRANSPORTE', 'ipva',               'IPVA',                        'expense', true,  60),
      ('TRANSPORTE', 'outros_transporte',  'Outros transporte',           'expense', false, 90),

      -- SAUDE
      ('SAUDE', 'plano_saude',       'Plano de saude',        'expense', true,  10),
      ('SAUDE', 'farmacia',          'Farmacia',              'expense', false, 20),
      ('SAUDE', 'consultas_exames',  'Consultas e exames',    'expense', false, 30),
      ('SAUDE', 'terapias',          'Terapias e bem-estar',  'expense', false, 40),
      ('SAUDE', 'outros_saude',      'Outros saude',          'expense', false, 90),

      -- EDUCACAO
      ('EDUCACAO', 'mensalidades_cursos',    'Mensalidades e cursos',     'expense', true,  10),
      ('EDUCACAO', 'livros_materiais',       'Livros e materiais',        'expense', false, 20),
      ('EDUCACAO', 'idiomas_certificacoes',  'Idiomas e certificacoes',   'expense', false, 30),
      ('EDUCACAO', 'outros_educacao',        'Outros educacao',           'expense', false, 90),

      -- LAZER
      ('LAZER', 'streaming',       'Streaming',          'expense', true,  10),
      ('LAZER', 'viagens',         'Viagens',            'expense', false, 20),
      ('LAZER', 'hobbies',         'Hobbies',            'expense', false, 30),
      ('LAZER', 'eventos_cultura', 'Eventos e cultura',  'expense', false, 40),
      ('LAZER', 'outros_lazer',    'Outros lazer',       'expense', false, 90),

      -- FAMILIA
      ('FAMILIA', 'filhos_escola',      'Filhos e escola',              'expense', true,  10),
      ('FAMILIA', 'pets',               'Pets',                         'expense', true,  20),
      ('FAMILIA', 'presentes_doacoes',  'Presentes e doacoes',          'expense', false, 30),
      ('FAMILIA', 'cuidados_pessoais',  'Cuidados pessoais',            'expense', false, 40),
      ('FAMILIA', 'outros_familia',     'Outros familia e cuidados',    'expense', false, 90),

      -- FINANCEIRO
      ('FINANCEIRO', 'fatura_cartao',        'Fatura de cartao',       'expense', true,  10),
      ('FINANCEIRO', 'juros_multas',         'Juros e multas',         'expense', false, 20),
      ('FINANCEIRO', 'tarifas_bancarias',    'Tarifas bancarias',      'expense', false, 30),
      ('FINANCEIRO', 'seguros_financeiros',  'Seguros financeiros',    'expense', true,  40),
      ('FINANCEIRO', 'outros_financeiro',    'Outros financeiro',      'expense', false, 90),

      -- TRABALHO
      ('TRABALHO', 'ferramentas_software',  'Ferramentas e software',      'expense', true,  10),
      ('TRABALHO', 'marketing_vendas',      'Marketing e vendas',          'expense', false, 20),
      ('TRABALHO', 'impostos_empresa',      'Impostos da empresa',         'expense', true,  30),
      ('TRABALHO', 'servicos_terceiros',    'Servicos de terceiros',       'expense', false, 40),
      ('TRABALHO', 'equipamentos',          'Equipamentos de trabalho',    'expense', false, 50),
      ('TRABALHO', 'outros_trabalho',       'Outros trabalho e negocio',   'expense', false, 90),

      -- IMPOSTOS
      ('IMPOSTOS', 'imposto_renda',    'Imposto de renda',        'expense', true,  10),
      ('IMPOSTOS', 'taxas_cartorio',   'Taxas e cartorios',       'expense', false, 20),
      ('IMPOSTOS', 'taxas_publicas',   'Taxas publicas',          'expense', false, 30),
      ('IMPOSTOS', 'outros_impostos',  'Outros impostos e taxas', 'expense', false, 90),

      -- INVESTIMENTOS
      ('INVESTIMENTOS', 'reserva_emergencia',   'Reserva de emergencia',  'investment', true,  10),
      ('INVESTIMENTOS', 'renda_fixa',           'Renda fixa',             'investment', true,  20),
      ('INVESTIMENTOS', 'acoes',                'Acoes',                  'investment', true,  30),
      ('INVESTIMENTOS', 'fiis',                 'FIIs',                   'investment', true,  40),
      ('INVESTIMENTOS', 'cripto',               'Criptoativos',           'investment', false, 45),
      ('INVESTIMENTOS', 'previdencia',          'Previdencia privada',    'investment', true,  50),
      ('INVESTIMENTOS', 'outros_investimentos', 'Outros investimentos',   'investment', false, 90)
    ) as c(group_code, code, name, default_type, default_is_recurring, sort_order)
    join public.category_groups g on g.code = c.group_code and g.workspace_id is null;

  end if;
end;
$$;

commit;
