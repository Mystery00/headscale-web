import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DataTableSortState } from 'naive-ui'

export type ListSortOrder = 'ascend' | 'descend'

type FilterDefinition<T extends string> = {
  queryKey: string
  defaultValue: T
  validate?: (value: string) => value is T
}

type FilterDefinitions = Record<string, FilterDefinition<string>>
type FilterValues<T extends FilterDefinitions> = {
  [K in keyof T]: Ref<T[K]['defaultValue']>
}

function queryText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(queryText(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function useListViewState<
  const TFilters extends FilterDefinitions,
  const TSortKey extends string,
>(options: {
  filters: TFilters
  sortKeys: readonly TSortKey[]
  pageSizes?: readonly number[]
  defaultPageSize?: number
}) {
  const route = useRoute()
  const router = useRouter()
  const pageSizes = options.pageSizes ?? [10, 25, 50, 100]
  const defaultPageSize = options.defaultPageSize ?? 25
  let applyingRoute = false

  function readFilter<T extends string>(definition: FilterDefinition<T>): T {
    const value = queryText(route.query[definition.queryKey])
    return (
      value && (!definition.validate || definition.validate(value))
        ? value
        : definition.defaultValue
    ) as T
  }

  const filters = Object.fromEntries(
    Object.entries(options.filters).map(([key, definition]) => [key, ref(readFilter(definition))]),
  ) as FilterValues<TFilters>
  const page = ref(positiveInteger(route.query.page, 1))
  const requestedPageSize = positiveInteger(route.query.size, defaultPageSize)
  const pageSize = ref(pageSizes.includes(requestedPageSize) ? requestedPageSize : defaultPageSize)
  const routeSortKey = queryText(route.query.sort)
  const sortKey = ref<TSortKey | null>(
    (options.sortKeys as readonly string[]).includes(routeSortKey)
      ? (routeSortKey as TSortKey)
      : null,
  )
  const sortOrder = ref<ListSortOrder | null>(
    route.query.order === 'ascend' || route.query.order === 'descend' ? route.query.order : null,
  )
  if (!sortKey.value) sortOrder.value = null

  const filterRefs = Object.values(filters) as Ref<string>[]

  watch(filterRefs, () => {
    if (!applyingRoute) page.value = 1
  })

  watch(
    () => route.query,
    async () => {
      applyingRoute = true
      for (const [key, definition] of Object.entries(options.filters)) {
        filters[key].value = readFilter(definition)
      }
      page.value = positiveInteger(route.query.page, 1)
      const nextSize = positiveInteger(route.query.size, defaultPageSize)
      pageSize.value = pageSizes.includes(nextSize) ? nextSize : defaultPageSize
      const nextSort = queryText(route.query.sort)
      sortKey.value = (options.sortKeys as readonly string[]).includes(nextSort)
        ? (nextSort as TSortKey)
        : null
      sortOrder.value =
        sortKey.value && (route.query.order === 'ascend' || route.query.order === 'descend')
          ? route.query.order
          : null
      await nextTick()
      applyingRoute = false
    },
  )

  watch(
    [...filterRefs, page, pageSize, sortKey, sortOrder],
    () => {
      if (applyingRoute) return
      const query = { ...route.query }
      for (const definition of Object.values(options.filters)) {
        const value = Object.entries(options.filters).find(
          ([, candidate]) => candidate === definition,
        )
        const filterName = value?.[0]
        if (!filterName) continue
        const current = filters[filterName].value
        if (current && current !== definition.defaultValue) query[definition.queryKey] = current
        else delete query[definition.queryKey]
      }
      if (page.value > 1) query.page = String(page.value)
      else delete query.page
      if (pageSize.value !== defaultPageSize) query.size = String(pageSize.value)
      else delete query.size
      if (sortKey.value && sortOrder.value) {
        query.sort = sortKey.value
        query.order = sortOrder.value
      } else {
        delete query.sort
        delete query.order
      }
      void router.replace({ query })
    },
    { flush: 'post' },
  )

  function sortOrderFor(key: TSortKey): ListSortOrder | false {
    return sortKey.value === key && sortOrder.value ? sortOrder.value : false
  }

  function onSorterChange(value: DataTableSortState | DataTableSortState[] | null) {
    const sorter = Array.isArray(value) ? value[0] : value
    if (
      !sorter?.order ||
      !(options.sortKeys as readonly PropertyKey[]).includes(sorter.columnKey)
    ) {
      sortKey.value = null
      sortOrder.value = null
      return
    }
    sortKey.value = sorter.columnKey as TSortKey
    sortOrder.value = sorter.order
    page.value = 1
  }

  function syncFocusPage(items: ComputedRef<readonly { id: string }[]>) {
    watch(
      [items, focusId, pageSize],
      ([values, id, size]) => {
        if (!id) return
        const index = values.findIndex((item) => item.id === id)
        if (index >= 0) page.value = Math.floor(index / size) + 1
      },
      { immediate: true },
    )
  }

  function pagination(itemCount: ComputedRef<number>) {
    watch(itemCount, (count) => {
      const lastPage = Math.max(1, Math.ceil(count / pageSize.value))
      if (page.value > lastPage) page.value = lastPage
    })
    return computed(() => ({
      page: page.value,
      pageSize: pageSize.value,
      itemCount: itemCount.value,
      pageSizes: [...pageSizes],
      showSizePicker: true,
      onUpdatePage(value: number) {
        page.value = value
      },
      onUpdatePageSize(value: number) {
        pageSize.value = value
        page.value = 1
      },
    }))
  }

  const focusId = computed(() => queryText(route.query.focus))

  return {
    filters,
    page,
    pageSize,
    sortKey,
    sortOrder,
    sortOrderFor,
    onSorterChange,
    pagination,
    syncFocusPage,
    focusId,
  }
}
