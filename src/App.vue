<script setup lang="ts">
import DefaultLayout from "./layout/default/index.vue";
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
