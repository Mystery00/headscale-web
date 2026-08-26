<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__copy">
      <h1>{{ title }}</h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.page-header__copy {
  min-width: 0;
  flex: 1 1 18rem;
}

h1 {
  margin: 0;
  color: var(--admin-text);
  font-size: clamp(1.5rem, 2vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.page-header__description {
  max-width: 42rem;
  margin: 0.45rem 0 0;
  color: var(--admin-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}
</style>
