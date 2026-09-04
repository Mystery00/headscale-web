import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { NConfigProvider } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
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

  it('keeps pagination away from the card edges', async () => {
    type Row = { id: string; name: string }
    const columns: DataTableColumns<Row> = [{ title: 'Name', key: 'name' }]
    const data: Row[] = [{ id: '1', name: 'alice' }]
    const { container } = withProviders(AppDataTable, {
      columns,
      data,
      rowKey: (row: Row) => row.id,
      pagination: {
        page: 1,
        pageSize: 25,
        itemCount: 26,
        showSizePicker: true,
        pageSizes: [25],
      },
      themeOverrides: {
        thColor: '#123456',
      },
    })
    await nextTick()
    const table = container.querySelector<HTMLElement>('.n-data-table')
    expect(table).not.toBeNull()
    expect(container.querySelector('.n-data-table__pagination')).not.toBeNull()
    expect(table!.style.getPropertyValue('--n-pagination-margin')).toBe('12px 14px 14px')
    expect(table!.style.getPropertyValue('--n-th-color')).toBe('#123456')
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

  it('allows destructive confirmation without typed input', async () => {
    let confirmed = 0
    withProviders(ConfirmDialog, {
      show: true,
      title: 'Delete node',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      pending: false,
      onConfirm: () => {
        confirmed += 1
      },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(confirmed).toBe(1)
  })
})
