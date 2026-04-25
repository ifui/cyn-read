<script setup lang="ts">
import { h, ref } from "vue";
import { useRouter } from "vue-router";
import { NIcon } from "naive-ui";
import LayoutLogo from "./LayoutLogo.vue";

const router = useRouter();
const activeKey = ref<string>("home");

const renderIcon = (icon: string) => {
  return () => h(NIcon, null, { default: () => h("i", { class: icon }) });
};

const menuOptions = ref([
  {
    label: "首页",
    key: "/",
    icon: renderIcon("ri-home-4-line"),
  },
  {
    type: "divider",
    key: "d1",
  },
  {
    label: "文档管理",
    key: "/documents",
    icon: renderIcon("ri-folder-3-line"),
  },
  {
    type: "divider",
    key: "d2",
  },
  {
    label: "工具箱",
    key: "/tools",
    icon: renderIcon("ri-tools-line"),
    children: [
      {
        label: "PDF 编辑",
        key: "/pdf-editor",
        icon: renderIcon("ri-file-edit-line"),
      },
      {
        label: "文字识别",
        key: "/ocr",
        icon: renderIcon("ri-text"),
      },
      {
        label: "图片处理",
        key: "/image-editor",
        icon: renderIcon("ri-image-edit-line"),
      },
    ],
  },
  {
    type: "divider",
    key: "d3",
  },
  {
    label: "回收站",
    key: "/trash",
    icon: renderIcon("ri-delete-bin-line"),
  },
  {
    type: "divider",
    key: "d4",
  },
  {
    label: "设置",
    key: "/settings",
    icon: renderIcon("ri-settings-3-line"),
  },
]);

const handleUpdateValue = (key: string) => {
  activeKey.value = key;
  console.log("菜单点击:", key);
  router.push(key);
};
</script>

<template>
  <div class="h-full flex flex-col">
    <LayoutLogo />
    <n-scrollbar class="flex-1">
      <n-menu
        v-model:value="activeKey"
        :options="menuOptions"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        @update:value="handleUpdateValue"
      />
    </n-scrollbar>
  </div>
</template>

<style scoped></style>
