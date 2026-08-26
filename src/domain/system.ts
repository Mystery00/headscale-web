export interface VersionInfo {
  version: string
  commit?: string
}

export interface HealthInfo {
  databaseConnectivity: boolean
}

export interface SystemStatus {
  version: string
  commit?: string
  databaseConnectivity: boolean
  apiReachable: boolean
  checkedAt: Date
}
