<script setup lang="ts">
import type { StatusTone } from '@/components/ui/StatusBadge.vue'

withDefaults(
  defineProps<{
    label: string
    value: string
    meta?: string
    helper?: string
    tone?: StatusTone
    loading?: boolean
  }>(),
  {
    tone: 'neutral',
    loading: false,
  },
)
</script>

<template>
  <article class="stat-card" :class="`stat-card--${tone}`">
    <div class="stat-card__header">
      <span class="stat-card__label">{{ label }}</span>
      <div v-if="$slots.default" class="stat-card__icon" aria-hidden="true">
        <slot />
      </div>
    </div>
    <div class="stat-card__body">
      <div class="stat-card__main">
        <strong class="stat-card__value">{{ loading ? '—' : value }}</strong>
        <span v-if="meta" class="stat-card__meta">{{ meta }}</span>
      </div>
      <div v-if="helper" class="stat-card__helper" :class="`stat-card__helper--${tone}`">
        {{ helper }}
      </div>
    </div>
  </article>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.85rem;
  min-height: 7.25rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
  box-shadow: var(--admin-shadow);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.stat-card:hover {
  border-color: color-mix(in srgb, var(--admin-border) 70%, var(--admin-primary));
  box-shadow: var(--admin-shadow), 0 4px 12px rgba(15, 23, 42, 0.05);
}

.stat-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card__icon {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  place-items: center;
  border-radius: 6px;
  background: var(--admin-surface-muted);
  color: var(--admin-muted);
  border: 1px solid var(--admin-border);
}

.stat-card__label {
  color: var(--admin-muted);
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.stat-card__main {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.stat-card__value {
  color: var(--admin-text);
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
}

.stat-card__meta {
  color: var(--admin-muted);
  font-size: 0.85rem;
  font-weight: 500;
}

.stat-card__helper {
  font-size: 0.75rem;
  color: var(--admin-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.stat-card__helper--success {
  color: var(--admin-success);
}

.stat-card__helper--warning {
  color: var(--admin-warning);
}

.stat-card__helper--danger {
  color: var(--admin-danger);
}

.stat-card--success .stat-card__icon {
  color: var(--admin-success);
  background: color-mix(in srgb, var(--admin-success) 10%, var(--admin-surface-muted));
}

.stat-card--warning .stat-card__icon {
  color: var(--admin-warning);
  background: color-mix(in srgb, var(--admin-warning) 10%, var(--admin-surface-muted));
}

.stat-card--danger .stat-card__icon {
  color: var(--admin-danger);
  background: color-mix(in srgb, var(--admin-danger) 10%, var(--admin-surface-muted));
}

.stat-card--info .stat-card__icon {
  color: var(--admin-info);
  background: color-mix(in srgb, var(--admin-info) 10%, var(--admin-surface-muted));
}
</style>
