import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { queryKeys } from '@/query/keys'
import { createAppRepositories } from '@/query/repositories'
import { useSettingsStore } from '@/stores/settings'

function usePolling() {
  const settings = useSettingsStore()
  return computed(() => (settings.pollingEnabled ? settings.pollingIntervalMs : false))
}

export function useUsersQuery(filters?: { id?: string; name?: string; email?: string }) {
  return useQuery({
    queryKey: queryKeys.users(filters),
    queryFn: () => createAppRepositories().users.list(filters),
    refetchInterval: usePolling(),
  })
}

export function useNodesQuery(filters?: { userName?: string }) {
  return useQuery({
    queryKey: queryKeys.nodes(filters),
    queryFn: () => createAppRepositories().nodes.list(filters),
    refetchInterval: usePolling(),
  })
}

export function useNodeQuery(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.node(nodeId),
    queryFn: () => createAppRepositories().nodes.get(nodeId),
    enabled: Boolean(nodeId),
    refetchInterval: usePolling(),
  })
}

export function usePreAuthKeysQuery() {
  return useQuery({
    queryKey: queryKeys.preAuthKeys,
    queryFn: () => createAppRepositories().preAuthKeys.list(),
    refetchInterval: usePolling(),
  })
}

export function useSystemVersionQuery() {
  return useQuery({
    queryKey: queryKeys.systemVersion,
    queryFn: () => createAppRepositories().system.getVersion(),
    refetchInterval: usePolling(),
  })
}

export function useSystemHealthQuery() {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: () => createAppRepositories().system.getHealth(),
    refetchInterval: usePolling(),
  })
}

export function useRefreshAll() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const root = query.queryKey[0]
        return root === 'users' || root === 'nodes' || root === 'preAuthKeys' || root === 'system'
      },
    })
}
