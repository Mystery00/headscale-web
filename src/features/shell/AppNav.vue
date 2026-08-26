<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { NMenu } from 'naive-ui'
import { computed, h } from 'vue'

const { t } = useI18n()
const route = useRoute()
const options = computed(() => [
  { label: () => h(RouterLink, { to: '/' }, { default: () => t('nav.dashboard') }), key: '/' },
  {
    label: () => h(RouterLink, { to: '/users' }, { default: () => t('nav.users') }),
    key: '/users',
  },
  {
    label: () => h(RouterLink, { to: '/nodes' }, { default: () => t('nav.nodes') }),
    key: '/nodes',
  },
  {
    label: () => h(RouterLink, { to: '/routes' }, { default: () => t('nav.routes') }),
    key: '/routes',
  },
  {
    label: () => h(RouterLink, { to: '/preauth-keys' }, { default: () => t('nav.preAuthKeys') }),
    key: '/preauth-keys',
  },
  {
    label: () => h(RouterLink, { to: '/settings' }, { default: () => t('nav.settings') }),
    key: '/settings',
  },
])
</script>

<template>
  <nav>
    <NMenu :value="route.path" :options="options" />
  </nav>
</template>
