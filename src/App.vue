<template>
  <div id="app">
    <DataStorageApp />
  </div>
</template>

<script>
import DataStorageApp from './components/DataStorage.vue'

export default {
  name: 'App',
  components: {
    DataStorageApp
  }
}
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

#app {
  min-height: 100vh;
}
</style>