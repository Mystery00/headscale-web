<script setup lang="ts">
import { KeyRound, LayoutDashboard, Network, Server, Settings, Users } from '@lucide/vue'
import { NMenu } from 'naive-ui'
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()

function iconNode(Icon: typeof LayoutDashboard) {
  return () =>
    h(Icon, {
      size: 18,
      'stroke-width': 1.8,
      'aria-hidden': 'true',
    })
}

const options = computed(() => [
  {
    label: () => h(RouterLink, { to: '/' }, { default: () => t('nav.dashboard') }),
    key: '/',
    icon: iconNode(LayoutDashboard),
  },
  {
    label: () => h(RouterLink, { to: '/users' }, { default: () => t('nav.users') }),
    key: '/users',
    icon: iconNode(Users),
  },
  {
    label: () => h(RouterLink, { to: '/nodes' }, { default: () => t('nav.nodes') }),
    key: '/nodes',
    icon: iconNode(Server),
  },
  {
    label: () => h(RouterLink, { to: '/routes' }, { default: () => t('nav.routes') }),
    key: '/routes',
    icon: iconNode(Network),
  },
  {
    label: () => h(RouterLink, { to: '/preauth-keys' }, { default: () => t('nav.preAuthKeys') }),
    key: '/preauth-keys',
    icon: iconNode(KeyRound),
  },
  {
    label: () => h(RouterLink, { to: '/settings' }, { default: () => t('nav.settings') }),
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
</script>

<template>
  <div class="app-nav">
    <div class="app-nav__brand">
      <span class="app-nav__mark" aria-hidden="true">
        <Server :size="20" :stroke-width="1.8" />
      </span>
      <div class="app-nav__copy">
        <strong>{{ t('app.title') }}</strong>
        <span>{{ t('shell.consoleLabel') }}</span>
      </div>
    </div>
    <nav :aria-label="t('nav.primary')">
      <NMenu :value="selectedKey" :options="options" :root-indent="16" :indent="16" />
    </nav>
  </div>
</template>

<style scoped>
.app-nav {
  display: grid;
  gap: 1rem;
  height: 100%;
  padding: 1rem 0.75rem 1.25rem;
  color: #e7f8f2;
}

.app-nav__brand {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.35rem 0.5rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-nav__mark {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.08);
}

.app-nav__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.app-nav__copy strong {
  overflow: hidden;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-nav__copy span {
  color: rgba(231, 248, 242, 0.68);
  font-size: 0.72rem;
}

:deep(.n-menu) {
  --n-item-text-color: rgba(231, 248, 242, 0.78) !important;
  --n-item-text-color-hover: #fff !important;
  --n-item-text-color-active: #fff !important;
  --n-item-text-color-active-hover: #fff !important;
  --n-item-icon-color: rgba(231, 248, 242, 0.78) !important;
  --n-item-icon-color-hover: #fff !important;
  --n-item-icon-color-active: #fff !important;
  --n-item-icon-color-active-hover: #fff !important;
  --n-item-color-hover: rgba(255, 255, 255, 0.08) !important;
  --n-item-color-active: rgba(53, 208, 163, 0.18) !important;
  --n-item-color-active-hover: rgba(53, 208, 163, 0.22) !important;
  background: transparent !important;
}

:deep(.n-menu-item-content) {
  border-radius: 0.75rem !important;
}

:deep(.n-menu-item-content-header a) {
  color: inherit;
  text-decoration: none;
}
</style>
