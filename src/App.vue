<script setup lang="ts">
import { onMounted } from "vue";
import { darkTheme } from "naive-ui";
import { useThemeStore } from "./stores/themeStore";
import DefaultLayout from "./layout/default/index.vue";

const themeStore = useThemeStore();

onMounted(async () => {
  try {
    await themeStore.loadThemeFromConfig();
  } catch (error) {
    console.error("Failed to load theme config:", error);
  }
});
</script>

<template>
  <n-config-provider
    :theme-overrides="themeStore.themeOverrides"
    :theme="themeStore.isDark ? darkTheme : null"
  >
    <n-dialog-provider>
      <n-message-provider>
        <DefaultLayout> </DefaultLayout>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<style scoped></style>
