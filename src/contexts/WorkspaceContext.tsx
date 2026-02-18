import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type { WorkspaceRole } from "../types";

type WorkspaceState = {
  workspaceId: string | null;
  role: WorkspaceRole | null;
  isAdmin: boolean;
  canWrite: boolean;
  ready: boolean;
};

const WorkspaceContext = createContext<WorkspaceState>({
  workspaceId: null,
  role: null,
  isAdmin: false,
  canWrite: false,
  ready: false,
});

export const useWorkspace = () => useContext(WorkspaceContext);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { userId, email } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [ready, setReady] = useState(false);

  const resolve = useCallback(async () => {
    if (!supabase || !userId) {
      setWorkspaceId(null);
      setRole(null);
      setReady(true);
      return;
    }

    try {
      // Accept pending invites
      if (email) {
        const { data: pendingInvites, error: inviteError } = await supabase
          .from("workspace_invites")
          .select("id, workspace_id, role")
          .is("accepted_at", null)
          .ilike("email", email);
        if (inviteError) console.warn("[workspace] invites query failed:", inviteError.message);

        if (pendingInvites && pendingInvites.length > 0) {
          const memberships = pendingInvites.map((invite) => ({
            workspace_id: invite.workspace_id,
            user_id: userId,
            role: invite.role,
            active: true,
          }));
          const { error: membershipError } = await supabase
            .from("workspace_members")
            .upsert(memberships, { onConflict: "workspace_id,user_id" });
          if (membershipError) console.warn("[workspace] invite membership upsert failed:", membershipError.message);

          const inviteIds = pendingInvites.map((invite) => invite.id);
          const { error: acceptError } = await supabase
            .from("workspace_invites")
            .update({ accepted_at: new Date().toISOString() })
            .in("id", inviteIds);
          if (acceptError) console.warn("[workspace] invite accept failed:", acceptError.message);
        }
      }

      // Find existing membership
      const { data: memberships, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, active")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("[workspace] memberships query failed:", error.message);
        return;
      }

      if (memberships && memberships.length > 0) {
        setWorkspaceId(memberships[0].workspace_id as string);
        setRole(memberships[0].role as WorkspaceRole);
        return;
      }

      // Auto-create workspace for new users via RPC (security definer bypasses RLS)
      const { data: newWorkspaceId, error: rpcError } = await supabase
        .rpc("bootstrap_workspace", { p_name: "Workspace Principal" });
      if (rpcError) {
        console.error("[workspace] bootstrap_workspace RPC failed:", rpcError.message);
        return;
      }

      setWorkspaceId(newWorkspaceId as string);
      setRole("owner");
    } catch (err) {
      console.error("[workspace] unexpected error:", err);
    } finally {
      setReady(true);
    }
  }, [userId, email]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const isAdmin = role === "admin" || role === "owner";
  const canWrite = role === "owner" || role === "admin" || role === "member";

  return (
    <WorkspaceContext.Provider value={{ workspaceId, role, isAdmin, canWrite, ready }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
