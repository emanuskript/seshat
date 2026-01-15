const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  css: {
    loaderOptions: {
      postcss: {
        postcssOptions: {
          plugins: [
            require('@tailwindcss/postcss'),
            require('autoprefixer'),
          ],
        },
      },
    },
  },
})
