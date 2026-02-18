import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { slugify } from "../utils/formatting";
import type { CategoryGroupRow, CategoryRow, TransactionType } from "../types";

export function useCategoryGroups() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.categoryGroups(workspaceId!),
    enabled: !!supabase && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("category_groups")
        .select("id, workspace_id, code, name, sort_order, deleted_at, created_by")
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .is("deleted_at", null)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data as CategoryGroupRow[]) ?? [];
    },
  });
}

export function useCategories() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: queryKeys.categories(workspaceId!),
    enabled: !!supabase && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("categories")
        .select("id, workspace_id, group_id, code, name, default_type, default_is_recurring, deleted_at, created_by")
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .is("deleted_at", null)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data as CategoryRow[]) ?? [];
    },
  });
}

export function useCreateGroup() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; code: string; sortOrder: number }) => {
      const code = (input.code.trim() || slugify(input.name)).toUpperCase();
      const { error } = await supabase!
        .from("category_groups")
        .insert({ workspace_id: workspaceId!, name: input.name.trim(), code, sort_order: input.sortOrder });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categoryGroups(workspaceId!) }),
  });
}

export function useUpdateGroup() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name: string; code: string }) => {
      const payload = { name: input.name.trim(), code: (input.code.trim() || slugify(input.name)).toUpperCase() };
      if (!payload.name) return;
      const { error } = await supabase!.from("category_groups").update(payload).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categoryGroups(workspaceId!) }),
  });
}

export function useDeleteGroup() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!
        .from("category_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categoryGroups(workspaceId!) }),
  });
}

export function useCreateCategory() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      code: string;
      groupId: string;
      type: TransactionType;
      recurring: boolean;
    }) => {
      const code = input.code.trim() || slugify(input.name);
      const { data, error } = await supabase!
        .from("categories")
        .insert({
          workspace_id: workspaceId!,
          name: input.name.trim(),
          code,
          group_id: input.groupId,
          default_type: input.type,
          default_is_recurring: input.recurring,
        })
        .select("id, workspace_id, group_id, code, name, default_type, default_is_recurring, deleted_at, created_by")
        .single();
      if (error) throw error;
      return data as CategoryRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories(workspaceId!) }),
  });
}

export function useUpdateCategory() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      code: string;
      groupId: string;
      type: TransactionType;
      recurring: boolean;
    }) => {
      const payload = {
        name: input.name.trim(),
        code: input.code.trim() || slugify(input.name),
        group_id: input.groupId,
        default_type: input.type,
        default_is_recurring: input.recurring,
      };
      if (!payload.name || !payload.group_id) return;
      const { error } = await supabase!.from("categories").update(payload).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories(workspaceId!) }),
  });
}

export function useDeleteCategory() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!
        .from("categories")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories(workspaceId!) }),
  });
}
