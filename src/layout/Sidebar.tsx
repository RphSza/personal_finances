import { LayoutDashboard, List, LogOut, Settings } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { AppPage } from "../features/app/types";
import type { UserRole } from "../types";

type SidebarProps = {
  page: AppPage;
  currentEmail: string | null;
  role: UserRole | null;
  onChangePage: (nextPage: AppPage) => void;
  onOpenSettingsHub: () => void;
};

export function Sidebar({ page, currentEmail, role, onChangePage, onOpenSettingsHub }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>PF</h1>
        <p>Personal Finances</p>
      </div>

      <nav className="sidebar-nav">
        <button className={page === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => onChangePage("dashboard")}>
          <LayoutDashboard size={16} />Dashboard
        </button>
        <button className={page === "entries" ? "nav-item active" : "nav-item"} onClick={() => onChangePage("entries")}>
          <List size={16} />Lançamentos
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className={page === "settings" ? "nav-item active" : "nav-item"} onClick={onOpenSettingsHub}>
          <Settings size={16} />Configurações
        </button>
        <p>{currentEmail}</p>
        <span className={`role-chip ${role}`}>{role}</span>
        <button className="nav-item" onClick={() => void supabase?.auth.signOut()}>
          <LogOut size={16} />Logout
        </button>
      </div>
    </aside>
  );
}
