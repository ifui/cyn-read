<script setup lang="ts">
import { onMounted, ref, defineAsyncComponent } from "vue";
import { invoke } from "@tauri-apps/api/tauri";
import { darkTheme } from "naive-ui";
import { useThemeStore } from "./stores/themeStore";

const themeStore = useThemeStore();
const isReady = ref(false);

const DefaultLayout = defineAsyncComponent(
  () => import("./layout/default/index.vue"),
);

onMounted(async () => {
  try {
    await themeStore.loadThemeFromConfig();
  } catch (error) {
    console.error("Failed to load theme config:", error);
  }

  isReady.value = true;

  try {
    await invoke("close_splashscreen");
  } catch (error) {
    console.error("Failed to close splashscreen:", error);
  }
});
</script>

<template>
  <div class="app-container" :class="{ dark: themeStore.isDark }">
    <div v-if="!isReady" class="loading-screen">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <span class="loading-text">正在初始化...</span>
      </div>
    </div>
    <n-config-provider
      v-else
      :theme-overrides="themeStore.themeOverrides"
      :theme="themeStore.isDark ? darkTheme : null"
    >
      <n-dialog-provider>
        <n-message-provider>
          <Suspense>
            <DefaultLayout />
            <template #fallback>
              <div class="loading-screen">
                <div class="loading-content">
                  <div class="loading-spinner"></div>
                  <span class="loading-text">加载中...</span>
                </div>
              </div>
            </template>
          </Suspense>
        </n-message-provider>
      </n-dialog-provider>
    </n-config-provider>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
}

.loading-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg, #faf8f4);
}

.dark .loading-screen {
  background-color: var(--color-bg, #1a1816);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e0dcd4);
  border-top-color: var(--color-accent, #c9a86c);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: var(--color-text-muted, #8c8c8c);
  font-size: 14px;
}
</style>
