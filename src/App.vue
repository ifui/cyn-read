<script setup lang="ts">
import { onMounted } from "vue";
import { invoke } from "@tauri-apps/api/tauri";
import DefaultLayout from "./layout/default/index.vue";

onMounted(async () => {
  try {
    await invoke("close_splashscreen");
  } catch (error) {
    console.error("Failed to close splashscreen:", error);
  }
});
</script>

<template>
  <n-config-provider>
    <n-dialog-provider>
      <n-message-provider>
        <DefaultLayout> </DefaultLayout>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<style scoped></style>
