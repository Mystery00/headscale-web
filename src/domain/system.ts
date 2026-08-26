export interface VersionInfo {
  version: string
  commit?: string
}

export interface HealthInfo {
  databaseConnectivity: boolean | undefined
}

export interface SystemStatus {
  version: string
  commit?: string
  databaseConnectivity: boolean | undefined
  apiReachable: boolean
  checkedAt: Date
}
