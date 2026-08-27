import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.HEADSCALE_PROXY_TARGET?.trim()

  return {
    base: './',
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
