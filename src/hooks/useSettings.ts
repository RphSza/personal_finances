import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspace } from "../contexts/WorkspaceContext";
import type { UserProfileRow, WorkspaceInviteRow, WorkspaceRole } from "../types";

export function useWorkspaceUsers() {
  const { workspaceId, isAdmin } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.workspaceUsers(workspaceId!),
    enabled: !!supabase && !!workspaceId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("workspace_members")
        .select("workspace_id, user_id, role, active, created_at, user_profiles(email)")
        .eq("workspace_id", workspaceId!)
        .order("created_at");
      if (error) throw error;
      return ((data as Array<{
        user_id: string;
        role: string;
        active: boolean;
        created_at: string;
        user_profiles: Array<{ email: string | null }> | null;
      }>) ?? []).map((row): UserProfileRow => ({
        id: row.user_id,
        email: row.user_profiles?.[0]?.email ?? null,
        role: row.role,
        active: row.active,
        created_at: row.created_at,
      }));
    },
  });
}

export function useWorkspaceInvites() {
  const { workspaceId, isAdmin } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.workspaceInvites(workspaceId!),
    enabled: !!supabase && !!workspaceId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("workspace_invites")
        .select("id, email, role, created_at, accepted_at")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as WorkspaceInviteRow[]) ?? [];
    },
  });
}

export function useCreateInvite() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; role: WorkspaceRole }) => {
      const { error } = await supabase!
        .from("workspace_invites")
        .upsert(
          { workspace_id: workspaceId!, email: input.email.trim().toLowerCase(), role: input.role },
          { onConflict: "workspace_id,email" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaceInvites(workspaceId!) }),
  });
}

export function useUpdateUserRole() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; role: string }) => {
      const { error } = await supabase!
        .from("workspace_members")
        .update({ role: input.role })
        .eq("workspace_id", workspaceId!)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaceUsers(workspaceId!) }),
  });
}

export function useToggleUserActive() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; currentActive: boolean }) => {
      const { error } = await supabase!
        .from("workspace_members")
        .update({ active: !input.currentActive })
        .eq("workspace_id", workspaceId!)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaceUsers(workspaceId!) }),
  });
}
