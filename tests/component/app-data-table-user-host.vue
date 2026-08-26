<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import type { User } from '@/domain/user'

const columns: DataTableColumns<User> = [
  { title: 'Name', key: 'name' },
  { title: 'Email', key: 'email' },
]

defineProps<{
  data: User[]
}>()
</script>

<template>
  <AppDataTable :columns="columns" :data="data" :row-key="(row) => row.id" aria-label="Users" />
</template>
