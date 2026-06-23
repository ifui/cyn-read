<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { computed } from "vue";

const configStore = useConfigStore();

const defaultPath = computed(() => configStore.config.document.defaultPath);
</script>

<template>
  <div>文档管理默认路径: {{ defaultPath }}</div>
</template>

<style scoped></style>
