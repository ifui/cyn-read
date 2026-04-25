<script setup lang="ts">
import { computed, h } from "vue";
import { NDropdown } from "naive-ui";
import type { FileItem } from "../../types/file";

interface Props {
  show: boolean;
  x: number;
  y: number;
  selectedFile: FileItem | null;
  hasClipboardItem: boolean;
  clipboardAction?: "copy" | "cut";
  isBackground: boolean;
  selectedCount?: number;
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "select", key: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedCount: 0,
});
const emit = defineEmits<Emits>();

const menuOptions = computed(() => {
  if (props.isBackground) {
    const options: any[] = [
      {
        label: "粘贴",
        key: "paste",
        icon: () => h("i", { class: "ri-file-copy-line" }),
        disabled: !(props.hasClipboardItem && props.clipboardAction === "copy"),
      },
      {
        label: "移动到此处",
        key: "cut",
        icon: () => h("i", { class: "ri-file-copy-line" }),
        disabled: !(props.hasClipboardItem && props.clipboardAction === "cut"),
      },
      { type: "divider", key: "d1" },
      {
        label: "新建文件夹",
        key: "newFolder",
        icon: () => h("i", { class: "ri-folder-add-line" }),
      },
      {
        label: "新建文档",
        key: "newDocument",
        icon: () => h("i", { class: "ri-file-add-line" }),
      },
      { type: "divider", key: "d2" },
      {
        label: "刷新",
        key: "refresh",
        icon: () => h("i", { class: "ri-refresh-line" }),
      },
    ];

    return options;
  }

  const isMultiple = props.selectedCount > 1;

  if (!props.selectedFile && !isMultiple) return [];

  const options: any[] = [
    {
      label: "打开",
      key: "open",
      icon: () => h("i", { class: "ri-folder-open-line" }),
      disabled: isMultiple,
    },
  ];

  if (!isMultiple && props.selectedFile && !props.selectedFile.isDirectory) {
    options.push({
      label: "打开方式",
      key: "openWith",
      icon: () => h("i", { class: "ri-external-link-line" }),
    });
  }

  options.push(
    { type: "divider", key: "d1" },
    {
      label: isMultiple ? `复制 ${props.selectedCount} 个项目` : "复制",
      key: "copy",
      icon: () => h("i", { class: "ri-file-copy-line" }),
    },
    {
      label: isMultiple ? `剪切 ${props.selectedCount} 个项目` : "剪切",
      key: "cut",
      icon: () => h("i", { class: "ri-scissors-cut-line" }),
    },
    { type: "divider", key: "d2" },
    {
      label: "重命名",
      key: "rename",
      icon: () => h("i", { class: "ri-edit-line" }),
      disabled: isMultiple,
    },
    {
      label: isMultiple ? `删除 ${props.selectedCount} 个项目` : "删除",
      key: "delete",
      icon: () => h("i", { class: "ri-delete-bin-line" }),
    },
  );

  return options;
});

const handleSelect = (key: string) => {
  emit("select", key);
  emit("update:show", false);
};
</script>

<template>
  <n-dropdown
    placement="bottom-start"
    trigger="manual"
    :x="x"
    :y="y"
    :options="menuOptions"
    :show="show"
    @select="handleSelect"
    @clickoutside="emit('update:show', false)"
  />
</template>
