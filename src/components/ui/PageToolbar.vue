<template>
  <div class="page-toolbar">
    <div class="page-toolbar__filters">
      <slot />
    </div>
    <div v-if="$slots.actions" class="page-toolbar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.page-toolbar__filters,
.page-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.page-toolbar__filters {
  flex: 1 1 18rem;
}

@media (max-width: 720px) {
  .page-toolbar,
  .page-toolbar__filters,
  .page-toolbar__actions {
    flex: 0 1 auto;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }
}
</style>
