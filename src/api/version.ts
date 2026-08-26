import type { HeadscaleHttp } from '@/api/http'
import type { VersionInfo } from '@/domain/system'

export async function fetchVersion(http: HeadscaleHttp): Promise<VersionInfo> {
  const body = await http.request({
    path: '/version',
    method: 'GET',
    authenticated: false,
  })
  if (!body || typeof body !== 'object') {
    return { version: '' }
  }
  const record = body as { version?: unknown; commit?: unknown }
  return {
    version: typeof record.version === 'string' ? record.version : '',
    commit: typeof record.commit === 'string' ? record.commit : undefined,
  }
}
