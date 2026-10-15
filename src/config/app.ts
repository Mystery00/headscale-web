const configuredVersion = import.meta.env.VITE_APP_VERSION?.trim()

export const appVersion = configuredVersion || 'dev'

export const HEADSCALE_REPOSITORY_URL = 'https://github.com/juanfont/headscale'
export const APP_REPOSITORY_URL = 'https://github.com/Mystery00/headscale-web'
export const APP_LATEST_RELEASE_URL =
  'https://api.github.com/repos/Mystery00/headscale-web/releases/latest'
