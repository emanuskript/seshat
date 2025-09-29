export default {
  server: {
    proxy: {
      '/static': 'http://localhost:5001',
      '/prepare': 'http://localhost:5001',
      '/analyze': 'http://localhost:5001',
    }
  }
}