<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useConfigStore } from "@/stores/config";
import EmptyDocument from "@/components/documents/EmptyDocument.vue";
import DocumentList from "@/components/documents/DocumentList.vue";

const configStore = useConfigStore();

const defaultPath = computed(() => configStore.config.document.defaultPath);

onMounted(() => {
  console.log(configStore.config);
});
</script>

<template>
  <div class="h-full flex flex-col">
    <template v-if="!defaultPath">
      <EmptyDocument />
    </template>
    <template v-else>
      <DocumentList />
    </template>
  </div>
</template>
