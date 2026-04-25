<script setup lang="ts">
const appName = "芯阅";
</script>

<template>
  <div class="logo-container p-4 border-b border-gray-200">
    <div class="flex items-center gap-3">
      <div class="logo-icon">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center">
          <i class="ri-book-read-line text-xl"></i>
        </div>
      </div>
      <div class="logo-text">
        <h1 class="text-lg font-bold text-gray-800 leading-tight">
          {{ appName }}
        </h1>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo-container {
  transition: all 0.3s ease;
}

.logo-icon {
  flex-shrink: 0;
}

.logo-text {
  overflow: hidden;
}
</style>
