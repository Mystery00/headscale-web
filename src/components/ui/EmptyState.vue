<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state" role="status">
    <div class="empty-state__copy">
      <strong>{{ title }}</strong>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: grid;
  gap: 1rem;
  justify-items: start;
  padding: 1.5rem;
  border: 1px dashed var(--admin-border);
  border-radius: var(--admin-radius);
  background: var(--admin-surface-muted);
}

.empty-state__copy {
  display: grid;
  gap: 0.35rem;
}

strong {
  color: var(--admin-text);
  font-size: 0.95rem;
}

p {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

.empty-state__action {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
</style>
