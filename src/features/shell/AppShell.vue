<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NButton, NDrawer, NLayout, NLayoutContent, NLayoutHeader, NLayoutSider } from 'naive-ui'
import AppNav from '@/features/shell/AppNav.vue'
import StatusBar from '@/features/shell/StatusBar.vue'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const router = useRouter()
const settings = useSettingsStore()
const title = computed(() => t('app.title'))
const menuOpen = ref(false)

function disconnect() {
  credentialStore.clear()
  settings.update({ baseUrl: null, credentialPersistence: 'session' })
  void router.push('/connect')
}
</script>

<template>
  <NLayout has-sider>
    <NLayoutSider
      bordered
      show-trigger="bar"
      collapse-mode="width"
      :collapsed-width="0"
      :width="220"
    >
      <AppNav />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader bordered style="padding: 0.75rem 1rem">
        <div class="header">
          <NButton class="menu-button" size="small" @click="menuOpen = true">{{
            t('nav.menu')
          }}</NButton>
          <strong>{{ title }}</strong>
          <StatusBar />
          <NButton @click="disconnect">{{ t('shell.disconnect') }}</NButton>
        </div>
      </NLayoutHeader>
      <NLayoutContent style="padding: 1rem">
        <router-view />
      </NLayoutContent>
    </NLayout>
    <NDrawer v-model:show="menuOpen" placement="left" :width="240">
      <AppNav />
    </NDrawer>
  </NLayout>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
.menu-button {
  display: none;
}
@media (max-width: 800px) {
  .menu-button {
    display: inline-flex;
  }
}
</style>
