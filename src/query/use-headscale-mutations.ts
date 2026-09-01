import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { CreatePreAuthKeyInput } from '@/domain/preauth-key-writes'
import type { CreateUserInput } from '@/domain/user-writes'
import { createAppRepositories } from '@/query/repositories'

function invalidateUsersGraph(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['users'] }),
    queryClient.invalidateQueries({ queryKey: ['nodes'] }),
    queryClient.invalidateQueries({ queryKey: ['preAuthKeys'] }),
  ])
}

function invalidateNodes(queryClient: ReturnType<typeof useQueryClient>, nodeId?: string) {
  const tasks = [queryClient.invalidateQueries({ queryKey: ['nodes'] })]
  if (nodeId) tasks.push(queryClient.invalidateQueries({ queryKey: ['node', nodeId] }))
  return Promise.all(tasks)
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => createAppRepositories().users.create(input),
    onSuccess: () => invalidateUsersGraph(queryClient),
  })
}

export function useRenameUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; newName: string }) =>
      createAppRepositories().users.rename(input.userId, input.newName),
    onSuccess: () => invalidateUsersGraph(queryClient),
  })
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => createAppRepositories().users.delete(userId),
    onSuccess: () => invalidateUsersGraph(queryClient),
  })
}

export function useRenameNodeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nodeId: string; newName: string }) =>
      createAppRepositories().nodes.rename(input.nodeId, input.newName),
    onSuccess: (node) => invalidateNodes(queryClient, node.id),
  })
}

export function useSetNodeTagsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nodeId: string; tags: string[] }) =>
      createAppRepositories().nodes.setTags(input.nodeId, input.tags),
    onSuccess: (node) => invalidateNodes(queryClient, node.id),
  })
}

export function useExpireNodeNowMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => createAppRepositories().nodes.expireNow(nodeId),
    onSuccess: (node) => invalidateNodes(queryClient, node.id),
  })
}

export function useSetNodeExpiryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nodeId: string; expiry: Date }) =>
      createAppRepositories().nodes.setExpiry(input.nodeId, input.expiry),
    onSuccess: (node) => invalidateNodes(queryClient, node.id),
  })
}

export function useDisableNodeExpiryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => createAppRepositories().nodes.disableExpiry(nodeId),
    onSuccess: (node) => invalidateNodes(queryClient, node.id),
  })
}

export function useDeleteNodeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => createAppRepositories().nodes.delete(nodeId),
    onSuccess: (_void, nodeId) => invalidateNodes(queryClient, nodeId),
  })
}

export function useSetApprovedRoutesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { nodeId: string; routes: string[] }) =>
      createAppRepositories().nodes.setApprovedRoutes(input.nodeId, input.routes),
    onSuccess: (node) => invalidateNodes(queryClient, node.id),
  })
}

export function useCreatePreAuthKeyMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePreAuthKeyInput) => createAppRepositories().preAuthKeys.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preAuthKeys'] }),
  })
}

export function useExpirePreAuthKeyMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => createAppRepositories().preAuthKeys.expire(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preAuthKeys'] }),
  })
}

export function useDeletePreAuthKeyMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => createAppRepositories().preAuthKeys.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preAuthKeys'] }),
  })
}
export function useRegisterAuthMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { authId: string; userName: string }) =>
      createAppRepositories().auth.register(input),
    retry: false,
    onSuccess: () => invalidateNodes(queryClient),
  })
}

export function useApproveAuthMutation() {
  return useMutation({
    mutationFn: (authId: string) => createAppRepositories().auth.approve(authId),
    retry: false,
  })
}

export function useRejectAuthMutation() {
  return useMutation({
    mutationFn: (authId: string) => createAppRepositories().auth.reject(authId),
    retry: false,
  })
}
