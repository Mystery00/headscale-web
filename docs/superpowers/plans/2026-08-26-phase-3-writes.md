# Phase 3 Write Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confirmed write operations for users, nodes, routes, and PreAuth Keys without storing full preauth plaintext outside the create dialog.

**Architecture:** Extend existing repositories. Vue Query mutations invalidate the same query keys as the spec. UI uses Naive dialogs for danger, messages for success, notifications for recoverable errors. Route updates send the full approved set and lock one node at a time. Created PreAuthKey plaintext lives only in dialog component state.

**Tech Stack:** Existing Vue 3 + Naive UI + Vue Query + MSW + Vitest.

**Spec:** [docs/design.md](../../design.md) sections 12–16, 24 Phase 3.

## Global Constraints

- Encode path and query with `encodeURIComponent` / `URLSearchParams`.
- User writes invalidate `users`, `nodes`, `preAuthKeys`.
- Node and route writes invalidate `nodes` and `node/:id`.
- PreAuthKey writes invalidate `preAuthKeys`.
- If a mutation returns a full resource, update cache then invalidate in the background.
- Disable submit while in flight; block duplicate submits on the same resource.
- Delete user/node requires typing the resource name. Delete PreAuthKey confirms id + user, never the full key.
- Full PreAuthKey plaintext is not written to Pinia, Query, storage, or logs.
- Approve one exit prefix also adds `0.0.0.0/0` and `::/0`. Send complete `approvedRoutes`.
- Normalize tags to `tag:<value>`, unique, no blanks.
- No Settings page, Docker, or e2e in this phase.

## File Map

```text
src/domain/tags.ts
src/domain/preauth-key.ts          # add CreatedPreAuthKey
src/repositories/users-repository.ts
src/repositories/nodes-repository.ts
src/repositories/preauth-keys-repository.ts
src/query/use-headscale-mutations.ts
src/features/feedback/use-app-feedback.ts
src/features/confirm/ConfirmNameDialog.vue
src/features/users/UserFormDialog.vue
src/features/nodes/NodeTagsDialog.vue
src/features/nodes/NodeExpiryDialog.vue
src/features/preauth-keys/CreatePreAuthKeyDialog.vue
src/features/preauth-keys/CreatedKeyDialog.vue
src/App.vue                        # Naive message/dialog/notification providers
tests/unit/tags.spec.ts
tests/unit/users-repository.spec.ts
tests/unit/nodes-repository.spec.ts
tests/unit/preauth-keys-repository.spec.ts
tests/unit/route-approval.spec.ts
tests/component/users-page.spec.ts
tests/component/nodes-page.spec.ts
tests/component/routes-page.spec.ts
tests/component/preauth-keys-page.spec.ts
```

---

### Task 1: Tag normalization and CreatedPreAuthKey type

```ts
export function normalizeTags(input: string[]): string[]
export interface CreateUserInput {
  name: string
  displayName?: string
  email?: string
  pictureUrl?: string
}
export interface CreatePreAuthKeyInput {
  userId: string
  reusable: boolean
  ephemeral: boolean
  expiration: Date | null
  aclTags: string[]
}
export interface CreatedPreAuthKey {
  record: PreAuthKey
  plaintext: string
}
```

Rules: trim; drop empty; prefix `tag:` when missing; reject whitespace inside value; unique case-sensitive.

- [ ] Write failing `tests/unit/tags.spec.ts`
- [ ] Implement `src/domain/tags.ts`
- [ ] Commit `feat: normalize Headscale ACL tags`

### Task 2: Repository writes

Users: `create`, `rename(userId, newName)`, `delete(userId)`.
Nodes: `rename`, `expireNow` body `{}`, `setExpiry` body `{ expiry: ISO }`, `disableExpiry` body `{ disableExpiry: true }`, `setTags` body `{ tags }`, `setApprovedRoutes` body `{ routes }` full set, `delete`.
PreAuthKeys: `create` returns `CreatedPreAuthKey`; `expire` body `{ id }`; `delete` query `id`.

- [ ] Extend MSW tests for method/path/body/query and that create mapping drops plaintext from `record`
- [ ] Implement repository methods
- [ ] Commit `feat: add Headscale write repositories`

### Task 3: Mutations and feedback providers

`useCreateUserMutation` etc. Success: naive message. Recoverable error: notification, keep form. Wrap `App.vue` with `NMessageProvider`, `NNotificationProvider`, `NDialogProvider`.

Route helper:

```ts
export function nextApprovedRoutes(node: Node, prefix: string, approved: boolean): string[]
```

If `prefix` is an exit route and `approved` is true, include both `0.0.0.0/0` and `::/0`.

Node lock: `Set<string>` of node ids with in-flight route mutations.

- [ ] Unit-test `nextApprovedRoutes`
- [ ] Add mutation composables
- [ ] Commit `feat: add write mutations and route approval helper`

### Task 4: Pages

Users: create form (name required; optional displayName/email/pictureUrl with format checks), rename, delete with node count + typed name.
Nodes: rename, tags dialog (show normalized list before submit), expiry (now / at / disable), delete. Expire now and delete are dangerous.
Routes: approve/unapprove row; node-level approve all advertised / clear all approved; disable controls while that node is locked.
PreAuth Keys: create (user required, reusable/ephemeral default false, expiration default 90 days, optional ACL tags); success dialog with copy, “I saved it” to close, force-close still available; expire; delete.

- [ ] Extend component tests
- [ ] Implement UI
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] Commit `feat: add confirmed write actions to management pages`

## Done When

Users, nodes, routes, and preauth keys can be mutated through repositories with confirmations, cache invalidation, and no leaked plaintext keys.
