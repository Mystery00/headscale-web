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
  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
