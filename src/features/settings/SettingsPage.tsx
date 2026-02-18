import { useState } from "react";
import { ArrowLeft, ArrowRight, FolderTree, Pencil, Tags, Trash2, Users } from "lucide-react";
import { Spinner } from "../../components/LoadingState";
import {
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../../hooks/useCategories";
import {
  useWorkspaceUsers,
  useWorkspaceInvites,
  useCreateInvite,
  useUpdateUserRole,
  useToggleUserActive,
} from "../../hooks/useSettings";
import type { SettingsView } from "../app/types";
import type { CategoryGroupRow, CategoryRow, TransactionType, WorkspaceRole } from "../../types";

type SettingsPageProps = {
  settingsView: SettingsView;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  groups: CategoryGroupRow[];
  categories: CategoryRow[];
  groupById: Record<string, CategoryGroupRow>;
  onChangeSettingsView: (view: SettingsView) => void;
};

export function SettingsPage({
  settingsView,
  isAdmin,
  isGlobalAdmin,
  groups,
  categories,
  groupById,
  onChangeSettingsView,
}: SettingsPageProps) {
  // Group form state
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupCode, setEditingGroupCode] = useState("");

  // Category form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryGroupId, setCategoryGroupId] = useState("");
  const [categoryType, setCategoryType] = useState<TransactionType>("expense");
  const [categoryRecurring, setCategoryRecurring] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryCode, setEditingCategoryCode] = useState("");
  const [editingCategoryGroupId, setEditingCategoryGroupId] = useState("");
  const [editingCategoryType, setEditingCategoryType] = useState<TransactionType>("expense");
  const [editingCategoryRecurring, setEditingCategoryRecurring] = useState(false);

  // Users/invites form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("viewer");

  // Mutations
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { data: users = [] } = useWorkspaceUsers();
  const { data: invites = [] } = useWorkspaceInvites();
  const createInvite = useCreateInvite();
  const updateUserRole = useUpdateUserRole();
  const toggleUserActive = useToggleUserActive();

  const canEditGroup = (group: CategoryGroupRow) => (group.workspace_id === null ? isGlobalAdmin : isAdmin);
  const canEditCategory = (category: CategoryRow) => (category.workspace_id === null ? isGlobalAdmin : isAdmin);

  if (settingsView === "hub") {
    return (
      <main className="settings-hub">
        <button className="settings-nav-card" onClick={() => onChangeSettingsView("groups")}>
          <div className="settings-nav-icon"><FolderTree size={20} /></div>
          <div><h3>Grupos</h3><p>Organize os grandes blocos de classificacao financeira do sistema.</p></div>
          <ArrowRight size={18} />
        </button>
        <button className="settings-nav-card" onClick={() => onChangeSettingsView("categories")}>
          <div className="settings-nav-icon"><Tags size={20} /></div>
          <div><h3>Categorias</h3><p>Defina as categorias usadas nos lancamentos e seus padroes.</p></div>
          <ArrowRight size={18} />
        </button>
        <button className="settings-nav-card" onClick={() => onChangeSettingsView("users")}>
          <div className="settings-nav-icon"><Users size={20} /></div>
          <div><h3>Usuarios</h3><p>Gerencie convites, permissoes e ativacao de acesso da equipe.</p></div>
          <ArrowRight size={18} />
        </button>
      </main>
    );
  }

  if (settingsView === "groups") {
    return (
      <main className="settings-page">
        <section className="panel">
          <div className="panel-header">
            <h3>Grupos</h3>
            <button className="ghost-button" type="button" onClick={() => onChangeSettingsView("hub")}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createGroup.mutate(
                { name: groupName.trim(), code: groupCode.trim(), sortOrder: groups.length + 1 },
                { onSuccess: () => { setGroupName(""); setGroupCode(""); } }
              );
            }}
            className="form-grid"
          >
            <input placeholder="Nome do grupo" value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={!isAdmin || createGroup.isPending} required />
            <input placeholder="Codigo opcional" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} disabled={!isAdmin || createGroup.isPending} />
            <button type="submit" className={`ghost-button ${createGroup.isPending ? "is-loading" : ""}`} disabled={!isAdmin || createGroup.isPending}>
              {createGroup.isPending ? <Spinner label="Criando grupo..." compact /> : "Criar grupo"}
            </button>
          </form>
          <ul className="management-list">
            {groups.map((group) => (
              <li key={group.id}>
                {editingGroupId === group.id ? (
                  <div className="form-grid" style={{ width: "100%" }}>
                    <input value={editingGroupName} onChange={(e) => setEditingGroupName(e.target.value)} />
                    <input value={editingGroupCode} onChange={(e) => setEditingGroupCode(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <strong>{group.name}</strong>
                    <small>{group.code} - {group.workspace_id ? "workspace" : "global"}</small>
                  </div>
                )}
                <div className="inline-controls">
                  {editingGroupId === group.id ? (
                    <>
                      <button disabled={!canEditGroup(group)} onClick={() => { updateGroup.mutate({ id: group.id, name: editingGroupName, code: editingGroupCode }); setEditingGroupId(null); }}>Salvar</button>
                      <button type="button" className="ghost-button" onClick={() => setEditingGroupId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" className="ghost-button" disabled={!canEditGroup(group)} onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); setEditingGroupCode(group.code); }}>
                      <Pencil size={14} />
                    </button>
                  )}
                  <button className="danger" disabled={!canEditGroup(group) || deleteGroup.isPending} onClick={() => deleteGroup.mutate(group.id)}>
                    {deleteGroup.isPending ? <Spinner label="..." compact /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  if (settingsView === "categories") {
    return (
      <main className="settings-page">
        <section className="panel">
          <div className="panel-header">
            <h3>Categorias</h3>
            <button className="ghost-button" type="button" onClick={() => onChangeSettingsView("hub")}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCategory.mutate(
                { name: categoryName.trim(), code: categoryCode.trim(), groupId: categoryGroupId, type: categoryType, recurring: categoryRecurring },
                { onSuccess: () => { setCategoryName(""); setCategoryCode(""); setCategoryRecurring(false); } }
              );
            }}
            className="form-grid"
          >
            <input placeholder="Nome da categoria" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} disabled={!isAdmin || createCategory.isPending} required />
            <input placeholder="Codigo opcional" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} disabled={!isAdmin || createCategory.isPending} />
            <select value={categoryGroupId} onChange={(e) => setCategoryGroupId(e.target.value)} disabled={!isAdmin || createCategory.isPending}>
              <option value="">Selecione o grupo</option>
              {groups.map((group) => (<option key={group.id} value={group.id}>{group.name}</option>))}
            </select>
            <div className="two-col">
              <select value={categoryType} onChange={(e) => setCategoryType(e.target.value as TransactionType)} disabled={!isAdmin || createCategory.isPending}>
                <option value="income">income</option>
                <option value="expense">expense</option>
                <option value="investment">investment</option>
              </select>
              <label className="checkbox">
                <input type="checkbox" checked={categoryRecurring} onChange={(e) => setCategoryRecurring(e.target.checked)} disabled={!isAdmin || createCategory.isPending} />
                Recorrente padrao
              </label>
            </div>
            <button type="submit" className={`ghost-button ${createCategory.isPending ? "is-loading" : ""}`} disabled={!isAdmin || createCategory.isPending}>
              {createCategory.isPending ? <Spinner label="Criando categoria..." compact /> : "Criar categoria"}
            </button>
          </form>
          <ul className="management-list">
            {categories.map((category) => (
              <li key={category.id}>
                {editingCategoryId === category.id ? (
                  <div className="form-grid" style={{ width: "100%" }}>
                    <input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} />
                    <input value={editingCategoryCode} onChange={(e) => setEditingCategoryCode(e.target.value)} />
                    <div className="two-col">
                      <select value={editingCategoryGroupId} onChange={(e) => setEditingCategoryGroupId(e.target.value)}>
                        <option value="">Selecione o grupo</option>
                        {groups.map((group) => (<option key={group.id} value={group.id}>{group.name}</option>))}
                      </select>
                      <select value={editingCategoryType} onChange={(e) => setEditingCategoryType(e.target.value as TransactionType)}>
                        <option value="income">income</option>
                        <option value="expense">expense</option>
                        <option value="investment">investment</option>
                      </select>
                    </div>
                    <label className="checkbox">
                      <input type="checkbox" checked={editingCategoryRecurring} onChange={(e) => setEditingCategoryRecurring(e.target.checked)} />
                      Recorrente padrao
                    </label>
                  </div>
                ) : (
                  <div>
                    <strong>{category.name}</strong>
                    <small>{groupById[category.group_id]?.name ?? "-"} - {category.default_type} - {category.workspace_id ? "workspace" : "global"}</small>
                  </div>
                )}
                <div className="inline-controls">
                  {editingCategoryId === category.id ? (
                    <>
                      <button disabled={!canEditCategory(category)} onClick={() => { updateCategory.mutate({ id: category.id, name: editingCategoryName, code: editingCategoryCode, groupId: editingCategoryGroupId, type: editingCategoryType, recurring: editingCategoryRecurring }); setEditingCategoryId(null); }}>Salvar</button>
                      <button type="button" className="ghost-button" onClick={() => setEditingCategoryId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" className="ghost-button" disabled={!canEditCategory(category)} onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); setEditingCategoryCode(category.code); setEditingCategoryGroupId(category.group_id); setEditingCategoryType(category.default_type); setEditingCategoryRecurring(category.default_is_recurring); }}>
                      <Pencil size={14} />
                    </button>
                  )}
                  <button className="danger" disabled={!canEditCategory(category) || deleteCategory.isPending} onClick={() => deleteCategory.mutate(category.id)}>
                    {deleteCategory.isPending ? <Spinner label="..." compact /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  // Users view
  return (
    <main className="settings-page">
      <section className="panel">
        <div className="panel-header">
          <h3>Usuarios</h3>
          <button className="ghost-button" type="button" onClick={() => onChangeSettingsView("hub")}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
        {isAdmin ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createInvite.mutate({ email: inviteEmail, role: inviteRole }, { onSuccess: () => setInviteEmail("") });
              }}
              className="form-grid"
            >
              <input type="email" placeholder="Email do usuario" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={createInvite.isPending} required />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)} disabled={createInvite.isPending}>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
              <button type="submit" className={`ghost-button ${createInvite.isPending ? "is-loading" : ""}`} disabled={createInvite.isPending}>
                {createInvite.isPending ? <Spinner label="Enviando convite..." compact /> : "Adicionar convite"}
              </button>
            </form>
            <h4>Perfis</h4>
            <ul className="management-list">
              {users.map((user) => (
                <li key={user.id}>
                  <div>
                    <strong>{user.email ?? user.id}</strong>
                    <small>{user.active ? "ativo" : "inativo"}</small>
                  </div>
                  <div className="inline-controls">
                    <select value={user.role} onChange={(e) => updateUserRole.mutate({ userId: user.id, role: e.target.value })} disabled={updateUserRole.isPending || toggleUserActive.isPending}>
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button onClick={() => toggleUserActive.mutate({ userId: user.id, currentActive: user.active })} disabled={toggleUserActive.isPending || updateUserRole.isPending}>
                      {toggleUserActive.isPending ? <Spinner label="Atualizando..." compact /> : user.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <h4>Convites</h4>
            <ul className="management-list">
              {invites.map((invite) => (
                <li key={invite.id}>
                  <div>
                    <strong>{invite.email}</strong>
                    <small>{invite.role} - {invite.accepted_at ? "aceito" : "pendente"}</small>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Somente admin pode gerenciar usuarios.</p>
        )}
      </section>
    </main>
  );
}
