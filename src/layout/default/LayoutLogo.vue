<script setup lang="ts">
const appName = "芯阅";
</script>

<template>
  <div class="logo-container p-4">
    <div class="flex items-center gap-3">
      <div class="logo-icon">
        <div
          class="logo-icon-inner w-10 h-10 rounded-lg flex items-center justify-center"
        >
          <i class="ri-book-read-line text-xl"></i>
        </div>
      </div>
      <div class="logo-text">
        <h1 class="text-lg font-bold leading-tight">
          {{ appName }}
        </h1>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo-container {
  border-bottom: 1px solid var(--color-border);
  transition: all 0.3s ease;
}

.logo-icon {
  flex-shrink: 0;
}

.logo-icon-inner {
  background: linear-gradient(
    135deg,
    var(--color-accent) 0%,
    var(--color-accent-dark) 100%
  );
  color: var(--color-bg);
  box-shadow: 0 2px 8px rgba(201, 168, 108, 0.3);
}

.logo-text {
  overflow: hidden;
}

.logo-text h1 {
  color: var(--color-text);
}
</style>
