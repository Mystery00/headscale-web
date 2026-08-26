import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function normalizeBasePath(value: string): string {
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with /')
  }
  return value
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.HEADSCALE_PROXY_TARGET?.trim()

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    plugins: [vue()],
    server: proxyTarget
      ? {
          proxy: {
            '/version': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
