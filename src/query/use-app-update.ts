import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { appVersion } from '@/config/app'
import { isNewerAppRelease, parseAppVersion } from '@/domain/app-release'
import {
  APP_RELEASE_CACHE_MS,
  createAppReleasesRepository,
} from '@/repositories/app-releases-repository'
import { useSettingsStore } from '@/stores/settings'

const queryKey = ['app-release'] as const

export function useAppUpdate() {
  const settings = useSettingsStore()
  const queryClient = useQueryClient()
  const enabled = computed(
    () => settings.updateChecksEnabled && parseAppVersion(appVersion) !== null,
  )
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => createAppReleasesRepository().latest(signal),
    enabled,
    staleTime: APP_RELEASE_CACHE_MS,
    gcTime: APP_RELEASE_CACHE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
  watch(enabled, (value) => {
    if (!value) void queryClient.cancelQueries({ queryKey })
  })
  return computed(() => {
    const release = query.data.value
    return enabled.value && release && isNewerAppRelease(appVersion, release.version)
      ? release
      : null
  })
}
