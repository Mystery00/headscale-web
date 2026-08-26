<script setup lang="ts">
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

withDefaults(
  defineProps<{
    label: string
    tone?: StatusTone
  }>(),
  {
    tone: 'neutral',
  },
)
</script>

<template>
  <span class="status-badge" :class="`status-badge--${tone}`">
    <span class="status-badge__dot" aria-hidden="true" />
    <span class="status-badge__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  max-width: 100%;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--admin-border);
  border-radius: 999px;
  background: var(--admin-surface-muted);
  color: var(--admin-text);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.status-badge__dot {
  width: 0.45rem;
  height: 0.45rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--admin-muted);
}

.status-badge__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge--info {
  border-color: color-mix(in srgb, var(--admin-info) 35%, var(--admin-border));
  background: color-mix(in srgb, var(--admin-info) 12%, var(--admin-surface));
  color: var(--admin-text);
}

.status-badge--info .status-badge__dot {
  background: var(--admin-info);
}

.status-badge--success {
  border-color: color-mix(in srgb, var(--admin-success) 35%, var(--admin-border));
  background: color-mix(in srgb, var(--admin-success) 12%, var(--admin-surface));
}

.status-badge--success .status-badge__dot {
  background: var(--admin-success);
}

.status-badge--warning {
  border-color: color-mix(in srgb, var(--admin-warning) 35%, var(--admin-border));
  background: color-mix(in srgb, var(--admin-warning) 12%, var(--admin-surface));
}

.status-badge--warning .status-badge__dot {
  background: var(--admin-warning);
}

.status-badge--danger {
  border-color: color-mix(in srgb, var(--admin-danger) 35%, var(--admin-border));
  background: color-mix(in srgb, var(--admin-danger) 12%, var(--admin-surface));
}

.status-badge--danger .status-badge__dot {
  background: var(--admin-danger);
}
</style>
