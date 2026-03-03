import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PHAROSIGHT_API_BASE || env.VUE_APP_PHAROSIGHT_API_BASE || 'http://localhost:5001'
  return {
    server: {
      proxy: {
        '/ml': {
          target,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/ml/, ''),
        },
        '/static': {
          target,
          changeOrigin: true,
          secure: false,
        },
        '/prepare': {
          target,
          changeOrigin: true,
          secure: false,
        },
        '/analyze': {
          target,
          changeOrigin: true,
          secure: false,
        },
      }
    }
  }
})
