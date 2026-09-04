<script setup lang="ts">
import { KeyRound, LayoutDashboard, Network, Server, Settings, Users } from '@lucide/vue'
import { NMenu } from 'naive-ui'
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { appVersion } from '@/config/app'

const emit = defineEmits<{
  select: [key: string]
}>()

const { t } = useI18n()
const route = useRoute()
const brandIconSrc = `${import.meta.env.BASE_URL}favicon.svg`

function iconNode(Icon: typeof LayoutDashboard) {
  return () =>
    h(Icon, {
      size: 18,
      'stroke-width': 1.8,
      'aria-hidden': 'true',
    })
}

function linkLabel(to: string, label: string) {
  return () =>
    h(
      RouterLink,
      {
        to,
        onClick: () => emit('select', to),
      },
      { default: () => label },
    )
}

const options = computed(() => [
  {
    label: linkLabel('/', t('nav.dashboard')),
    key: '/',
    icon: iconNode(LayoutDashboard),
  },
  {
    label: linkLabel('/users', t('nav.users')),
    key: '/users',
    icon: iconNode(Users),
  },
  {
    label: linkLabel('/nodes', t('nav.nodes')),
    key: '/nodes',
    icon: iconNode(Server),
  },
  {
    label: linkLabel('/routes', t('nav.routes')),
    key: '/routes',
    icon: iconNode(Network),
  },
  {
    label: linkLabel('/preauth-keys', t('nav.preAuthKeys')),
    key: '/preauth-keys',
    icon: iconNode(KeyRound),
  },
  {
    label: linkLabel('/settings', t('nav.settings')),
    key: '/settings',
    icon: iconNode(Settings),
  },
])

const selectedKey = computed(() => {
  const path = route.path
  if (path === '/') return '/'
  const match = options.value.find((item) => item.key !== '/' && path.startsWith(item.key))
  return match?.key ?? path
})

function onMenuUpdate(key: string) {
  emit('select', key)
}
</script>

<template>
  <div class="app-nav">
    <div class="app-nav__brand">
      <span class="app-nav__mark" aria-hidden="true">
        <img :src="brandIconSrc" width="28" height="28" alt="" />
      </span>
      <div class="app-nav__copy">
        <strong>{{ t('app.title') }}</strong>
        <span class="app-nav__meta">
          <span>{{ t('shell.consoleLabel') }}</span>
          <span class="app-nav__version">{{ appVersion }}</span>
        </span>
      </div>
    </div>
    <nav :aria-label="t('nav.primary')">
      <NMenu
        :value="selectedKey"
        :options="options"
        :root-indent="16"
        :indent="16"
        @update:value="onMenuUpdate"
      />
    </nav>
  </div>
</template>

<style scoped>
.app-nav {
  display: grid;
  gap: 1.25rem;
  height: 100%;
  padding: 1.15rem 0.85rem 1.5rem;
  color: var(--admin-sidebar-text);
  background: var(--admin-sidebar);
}

.app-nav__brand {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  padding: 0.25rem 0.5rem 1rem;
  border-bottom: 1px solid var(--admin-sidebar-border);
}

.app-nav__mark {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--admin-primary-soft);
  border: 1px solid color-mix(in srgb, var(--admin-primary) 25%, var(--admin-sidebar-border));
}

.app-nav__mark img {
  display: block;
  width: 24px;
  height: 24px;
}

.app-nav__copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.app-nav__copy strong {
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--admin-sidebar-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-nav__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  color: var(--admin-sidebar-muted);
  font-size: 0.72rem;
}

.app-nav__version {
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--admin-sidebar-border);
  border-radius: 999px;
  color: var(--admin-sidebar-muted);
  background: var(--admin-sidebar-hover);
  font-size: 0.65rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.2;
}

:deep(.n-menu) {
  --n-item-text-color: var(--admin-sidebar-muted) !important;
  --n-item-text-color-hover: var(--admin-sidebar-text) !important;
  --n-item-text-color-active: var(--admin-sidebar-active-text) !important;
  --n-item-text-color-active-hover: var(--admin-sidebar-active-text) !important;
  --n-item-icon-color: var(--admin-sidebar-muted) !important;
  --n-item-icon-color-hover: var(--admin-sidebar-text) !important;
  --n-item-icon-color-active: var(--admin-sidebar-active-text) !important;
  --n-item-icon-color-active-hover: var(--admin-sidebar-active-text) !important;
  --n-item-color-hover: var(--admin-sidebar-hover) !important;
  --n-item-color-active: var(--admin-sidebar-active) !important;
  --n-item-color-active-hover: var(--admin-sidebar-active) !important;
  background: transparent !important;
}

:deep(.n-menu-item-content) {
  border-radius: 6px !important;
  font-size: 0.88rem !important;
  font-weight: 500 !important;
  transition: all 0.15s ease-in-out !important;
}

:deep(.n-menu-item-content::before) {
  left: 0 !important;
  right: 0 !important;
  border-radius: 6px !important;
}

:deep(.n-menu-item-content.n-menu-item-content--selected) {
  font-weight: 600 !important;
}

:deep(.n-menu-item-content.n-menu-item-content--selected::before) {
  border: 1px solid color-mix(in srgb, var(--admin-sidebar-active-text) 22%, transparent) !important;
}

:deep(.n-menu-item-content-header a) {
  color: inherit;
  text-decoration: none;
}
</style>
