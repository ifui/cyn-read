<script setup lang="ts">
import LayoutSider from "./LayoutSider.vue";
import LayoutFooter from "./LayoutFooter.vue";
import { onMounted } from "vue";
import { useConfigStore } from "@/stores/config.ts";

const { init } = useConfigStore();

// 初始化配置
onMounted(async () => {
  await init();
});
</script>

<template>
  <div class="h-screen">
    <n-layout position="absolute" class="h-full flex flex-col">
      <n-layout position="absolute" style="bottom: 32px" has-sider>
        <n-layout-sider bordered> <LayoutSider /> </n-layout-sider>
        <n-layout-content bordered>
          <RouterView />
        </n-layout-content>
      </n-layout>
      <n-layout-footer
        bordered
        style="height: 32px; padding: 5px"
        position="absolute"
      >
        <LayoutFooter />
      </n-layout-footer>
    </n-layout>
  </div>
</template>

<style scoped></style>
