<script setup lang="ts">
import type { StatusTone } from '@/components/ui/StatusBadge.vue'

withDefaults(
  defineProps<{
    label: string
    value: string
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
    <div class="stat-card__top">
      <div v-if="$slots.default" class="stat-card__icon" aria-hidden="true">
        <slot />
      </div>
      <span class="stat-card__label">{{ label }}</span>
    </div>
    <strong class="stat-card__value">{{ loading ? '—' : value }}</strong>
  </article>
</template>

<style scoped>
.stat-card {
  display: grid;
  gap: 0.85rem;
  min-height: 7rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--admin-surface) 92%, white),
    var(--admin-surface)
  );
  box-shadow: var(--admin-shadow);
}

.admin-theme-dark .stat-card {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--admin-surface) 88%, white),
    var(--admin-surface)
  );
}

.stat-card__top {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.stat-card__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--admin-border);
  border-radius: 0.7rem;
  background: var(--admin-surface-muted);
  color: var(--admin-primary);
}

.stat-card__label {
  color: var(--admin-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.stat-card__value {
  color: var(--admin-text);
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.stat-card--success .stat-card__icon {
  color: var(--admin-success);
}

.stat-card--warning .stat-card__icon {
  color: var(--admin-warning);
}

.stat-card--danger .stat-card__icon {
  color: var(--admin-danger);
}

.stat-card--info .stat-card__icon {
  color: var(--admin-info);
}
</style>
