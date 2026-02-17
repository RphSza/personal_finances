import { ArrowLeft, ArrowRight, FolderTree, Tags, Trash2, Users } from "lucide-react";
import type { SettingsView } from "../app/types";
import type { CategoryGroupRow, CategoryRow, UserInviteRow, UserProfileRow, UserRole, EntryType } from "../../types";

type SettingsPageProps = {
  settingsView: SettingsView;
  isAdmin: boolean;
  groups: CategoryGroupRow[];
  categories: CategoryRow[];
  users: UserProfileRow[];
  invites: UserInviteRow[];
  groupById: Record<string, CategoryGroupRow>;
  groupName: string;
  groupCode: string;
  categoryName: string;
  categoryCode: string;
  categoryGroupId: string;
  categoryType: EntryType;
  categoryRecurring: boolean;
  inviteEmail: string;
  inviteRole: UserRole;
  onChangeSettingsView: (view: SettingsView) => void;
  onChangeGroupName: (value: string) => void;
  onChangeGroupCode: (value: string) => void;
  onChangeCategoryName: (value: string) => void;
  onChangeCategoryCode: (value: string) => void;
  onChangeCategoryGroupId: (value: string) => void;
  onChangeCategoryType: (value: EntryType) => void;
  onChangeCategoryRecurring: (value: boolean) => void;
  onChangeInviteEmail: (value: string) => void;
  onChangeInviteRole: (value: UserRole) => void;
  onCreateGroup: () => void;
  onDeleteGroup: (id: string) => void;
  onCreateCategory: () => void;
  onDeleteCategory: (id: string) => void;
  onCreateInvite: () => void;
  onChangeUserRole: (userId: string, role: string) => void;
  onToggleUserActive: (userId: string, currentActive: boolean) => void;
};

export function SettingsPage({
  settingsView,
  isAdmin,
  groups,
  categories,
  users,
  invites,
  groupById,
  groupName,
  groupCode,
  categoryName,
  categoryCode,
  categoryGroupId,
  categoryType,
  categoryRecurring,
  inviteEmail,
  inviteRole,
  onChangeSettingsView,
  onChangeGroupName,
  onChangeGroupCode,
  onChangeCategoryName,
  onChangeCategoryCode,
  onChangeCategoryGroupId,
  onChangeCategoryType,
  onChangeCategoryRecurring,
  onChangeInviteEmail,
  onChangeInviteRole,
  onCreateGroup,
  onDeleteGroup,
  onCreateCategory,
  onDeleteCategory,
  onCreateInvite,
  onChangeUserRole,
  onToggleUserActive
}: SettingsPageProps) {
  if (settingsView === "hub") {
    return (
      <main className="settings-hub">
        <button className="settings-nav-card" onClick={() => onChangeSettingsView("groups")}>
          <div className="settings-nav-icon"><FolderTree size={20} /></div>
          <div>
            <h3>Grupos</h3>
            <p>Organize os grandes blocos de classificação financeira do sistema.</p>
          </div>
          <ArrowRight size={18} />
        </button>

        <button className="settings-nav-card" onClick={() => onChangeSettingsView("categories")}>
          <div className="settings-nav-icon"><Tags size={20} /></div>
          <div>
            <h3>Categorias</h3>
            <p>Defina as categorias usadas nos lançamentos e seus padrões.</p>
          </div>
          <ArrowRight size={18} />
        </button>

        <button className="settings-nav-card" onClick={() => onChangeSettingsView("users")}>
          <div className="settings-nav-icon"><Users size={20} /></div>
          <div>
            <h3>Usuários</h3>
            <p>Gerencie convites, permissões e ativação de acesso da equipe.</p>
          </div>
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
              onCreateGroup();
            }}
            className="form-grid"
          >
            <input placeholder="Nome do grupo" value={groupName} onChange={(e) => onChangeGroupName(e.target.value)} disabled={!isAdmin} required />
            <input placeholder="Código opcional" value={groupCode} onChange={(e) => onChangeGroupCode(e.target.value)} disabled={!isAdmin} />
            <button type="submit" className="ghost-button" disabled={!isAdmin}>Criar grupo</button>
          </form>

          <ul className="management-list">
            {groups.map((group) => (
              <li key={group.id}>
                <div>
                  <strong>{group.name}</strong>
                  <small>{group.code}</small>
                </div>
                <button className="danger" disabled={!isAdmin} onClick={() => onDeleteGroup(group.id)}>
                  <Trash2 size={14} />
                </button>
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
              onCreateCategory();
            }}
            className="form-grid"
          >
            <input placeholder="Nome da categoria" value={categoryName} onChange={(e) => onChangeCategoryName(e.target.value)} disabled={!isAdmin} required />
            <input placeholder="Código opcional" value={categoryCode} onChange={(e) => onChangeCategoryCode(e.target.value)} disabled={!isAdmin} />
            <select value={categoryGroupId} onChange={(e) => onChangeCategoryGroupId(e.target.value)} disabled={!isAdmin}>
              <option value="">Selecione o grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <div className="two-col">
              <select value={categoryType} onChange={(e) => onChangeCategoryType(e.target.value as EntryType)} disabled={!isAdmin}>
                <option value="receita">receita</option>
                <option value="despesa">despesa</option>
                <option value="investimento">investimento</option>
              </select>
              <label className="checkbox">
                <input type="checkbox" checked={categoryRecurring} onChange={(e) => onChangeCategoryRecurring(e.target.checked)} disabled={!isAdmin} />
                Recorrente padrão
              </label>
            </div>
            <button type="submit" className="ghost-button" disabled={!isAdmin}>Criar categoria</button>
          </form>

          <ul className="management-list">
            {categories.map((category) => (
              <li key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <small>{groupById[category.group_id]?.name ?? "-"} - {category.default_type}</small>
                </div>
                <button className="danger" disabled={!isAdmin} onClick={() => onDeleteCategory(category.id)}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <section className="panel">
        <div className="panel-header">
          <h3>Usuários</h3>
          <button className="ghost-button" type="button" onClick={() => onChangeSettingsView("hub")}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>

        {isAdmin ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onCreateInvite();
              }}
              className="form-grid"
            >
              <input type="email" placeholder="Email do usuário" value={inviteEmail} onChange={(e) => onChangeInviteEmail(e.target.value)} required />
              <select value={inviteRole} onChange={(e) => onChangeInviteRole(e.target.value as UserRole)}>
                <option value="owner">owner</option>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" className="ghost-button">Adicionar convite</button>
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
                    <select value={user.role} onChange={(e) => onChangeUserRole(user.id, e.target.value)}>
                      <option value="owner">owner</option>
                      <option value="viewer">viewer</option>
                      <option value="admin">admin</option>
                    </select>
                    <button onClick={() => onToggleUserActive(user.id, user.active)}>
                      {user.active ? "Desativar" : "Ativar"}
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
          <p>Somente admin pode gerenciar usuários.</p>
        )}
      </section>
    </main>
  );
}
