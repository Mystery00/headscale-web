import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { NConfigProvider } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { DataTableColumns } from 'naive-ui'
import App from '@/App.vue'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PageToolbar from '@/components/ui/PageToolbar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { User } from '@/domain/user'
import { createAppI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import AppDataTableUserHost from './app-data-table-user-host.vue'

function withProviders(
  component: object,
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {},
) {
  const i18n = createAppI18n('en-US')
  const Root = defineComponent({
    setup() {
      return () =>
        h(NConfigProvider, null, {
          default: () => h(component, props, slots),
        })
    },
  })
  return render(Root, {
    global: {
      plugins: [i18n],
    },
  })
}

describe('admin UI primitives', () => {
  it('labels a status with text instead of color alone', () => {
    withProviders(StatusBadge, { label: 'Online', tone: 'success' })
    expect(screen.getByText('Online')).toBeTruthy()
  })

  it('renders page header title, description, and actions', () => {
    withProviders(
      PageHeader,
      { title: 'Users', description: 'Manage Headscale users' },
      {
        actions: () => h('button', { type: 'button' }, 'Create'),
      },
    )
    expect(screen.getByRole('heading', { name: 'Users' })).toBeTruthy()
    expect(screen.getByText('Manage Headscale users')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
  })

  it('renders toolbar content and action slot', () => {
    withProviders(
      PageToolbar,
      {},
      {
        default: () => h('input', { 'aria-label': 'Search' }),
        actions: () => h('button', { type: 'button' }, 'Filter'),
      },
    )
    expect(screen.getByLabelText('Search')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy()
  })

  it('renders a metric label and value on a stat card', () => {
    withProviders(StatCard, { label: 'Nodes', value: '12', tone: 'info' })
    expect(screen.getByText('Nodes')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('renders empty state title and action', () => {
    withProviders(
      EmptyState,
      { title: 'No data', description: 'Nothing to show yet' },
      {
        action: () => h('button', { type: 'button' }, 'Retry'),
      },
    )
    expect(screen.getByText('No data')).toBeTruthy()
    expect(screen.getByText('Nothing to show yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('forwards table data into a labelled data table', async () => {
    type Row = { id: string; name: string }
    const columns: DataTableColumns<Row> = [{ title: 'Name', key: 'name' }]
    const data: Row[] = [{ id: '1', name: 'alice' }]
    withProviders(AppDataTable, {
      columns,
      data,
      loading: false,
      rowKey: (row: Row) => row.id,
      scrollX: 640,
      'aria-label': 'Users',
    })
    await nextTick()
    expect(screen.getByRole('table', { name: 'Users' })).toBeTruthy()
    expect(screen.getByText('alice')).toBeTruthy()
  })

  it('accepts domain User rows without an index signature', async () => {
    const data: User[] = [
      {
        id: '1',
        name: 'alice',
        displayName: 'Alice',
        email: 'alice@example.com',
        provider: 'oidc',
        providerId: 'oidc-1',
        profilePictureUrl: '',
        createdAt: new Date('2024-01-02T03:04:05Z'),
      },
    ]
    withProviders(AppDataTableUserHost, { data })
    await nextTick()
    expect(screen.getByRole('table', { name: 'Users' })).toBeTruthy()
    expect(screen.getByText('alice')).toBeTruthy()
    expect(screen.getByText('alice@example.com')).toBeTruthy()
  })

  it('applies admin-theme-dark when the resolved theme is dark', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useSettingsStore().update({ theme: 'dark' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div>home</div>' } }],
    })
    await router.push('/')
    await router.isReady()
    const { container } = render(App, {
      global: {
        plugins: [pinia, router, createAppI18n('en-US')],
      },
    })
    expect(container.querySelector('.admin-theme-dark')).toBeTruthy()
    expect(container.querySelector('.admin-theme-light')).toBeNull()
  })

  it('applies admin-theme-light when the resolved theme is light', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useSettingsStore().update({ theme: 'light' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div>home</div>' } }],
    })
    await router.push('/')
    await router.isReady()
    const { container } = render(App, {
      global: {
        plugins: [pinia, router, createAppI18n('en-US')],
      },
    })
    expect(container.querySelector('.admin-theme-light')).toBeTruthy()
    expect(container.querySelector('.admin-theme-dark')).toBeNull()
  })

  it('blocks typed confirmation until the expected value matches', async () => {
    let confirmed = 0
    withProviders(ConfirmDialog, {
      show: true,
      title: 'Delete node',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      confirmText: 'Type node-a to confirm',
      expectedText: 'node-a',
      danger: true,
      pending: false,
      onConfirm: () => {
        confirmed += 1
      },
    })
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await fireEvent.update(screen.getByRole('textbox'), 'node-a')
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(confirmed).toBe(1)
  })

  it('clears typed confirmation when the dialog closes', async () => {
    const show = ref(true)
    const Root = defineComponent({
      setup() {
        return () =>
          h(NConfigProvider, null, {
            default: () =>
              h(ConfirmDialog, {
                show: show.value,
                title: 'Delete node',
                message: 'This cannot be undone.',
                confirmLabel: 'Delete',
                confirmText: 'Type node-a to confirm',
                expectedText: 'node-a',
                danger: true,
                pending: false,
                'onUpdate:show': (value: boolean) => {
                  show.value = value
                },
              }),
          })
      },
    })
    render(Root, { global: { plugins: [createAppI18n('en-US')] } })
    await fireEvent.update(screen.getByRole('textbox'), 'node-a')
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('node-a')
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await nextTick()
    show.value = true
    await nextTick()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
