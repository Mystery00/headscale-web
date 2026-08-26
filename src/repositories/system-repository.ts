import { AppApiError } from '@/api/errors'
import type { HeadscaleHttp } from '@/api/http'
import { fetchVersion } from '@/api/version'
import type { components } from '@/api/generated/headscale'
import type { HealthInfo, SystemStatus, VersionInfo } from '@/domain/system'
import { isSupportedHeadscaleVersion } from '@/domain/version'

export interface SystemRepository {
  getVersion(): Promise<VersionInfo>
  getHealth(): Promise<HealthInfo>
  validateConnection(): Promise<SystemStatus>
}

export function createSystemRepository(http: HeadscaleHttp): SystemRepository {
  return {
    getVersion() {
      return fetchVersion(http)
    },
    async getHealth() {
      const body = (await http.request({
        path: '/api/v1/health',
        method: 'GET',
        authenticated: true,
      })) as components['schemas']['v1HealthResponse'] | undefined
      return {
        databaseConnectivity: Boolean(body?.databaseConnectivity),
      }
    },
    async validateConnection() {
      const version = await fetchVersion(http)
      if (!isSupportedHeadscaleVersion(version.version)) {
        throw new AppApiError({
          kind: 'unsupported-version',
          message: 'Headscale version is not supported',
          details: { version: version.version },
        })
      }
      const health = await this.getHealth()
      await http.request({
        path: '/api/v1/user',
        method: 'GET',
        authenticated: true,
      })
      return {
        version: version.version,
        commit: version.commit,
        databaseConnectivity: health.databaseConnectivity,
        apiReachable: true,
        checkedAt: new Date(),
      }
    },
  }
}
