<template>
  <TourProvider>
    <router-view />
  </TourProvider>
</template>

<script>
import TourProvider from '@/components/tour/TourProvider.vue'

export default {
  name: "App",
  components: {
    TourProvider
  }
};
</script>

<style>
/* Full-bleed app, no default browser margins */
html, body, #app {
  height: 100%;
  margin: 0;
}
body {
  background-color: hsl(var(--background)); /* themed background */
  color: hsl(var(--foreground));
  transition: background-color 0.2s ease, color 0.2s ease;
}
</style>
