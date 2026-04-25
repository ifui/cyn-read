<script setup lang="ts">
import { ref, computed } from "vue";
import { NModal, NInput, NButton, NSpace, NRadioGroup, NRadio } from "naive-ui";

interface Props {
  show: boolean;
  mode: "folder" | "document";
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "create", name: string, documentType?: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const itemName = ref("");
const documentType = ref("txt");

const documentTypes = [
  { label: "文本文件 (.txt)", value: "txt", icon: "ri-file-text-line" },
  { label: "Word 文档 (.docx)", value: "docx", icon: "ri-file-word-line" },
  { label: "Excel 表格 (.xlsx)", value: "xlsx", icon: "ri-file-excel-line" },
  {
    label: "PowerPoint 演示文稿 (.pptx)",
    value: "pptx",
    icon: "ri-file-ppt-line",
  },
];

const title = computed(() => {
  return props.mode === "folder" ? "新建文件夹" : "新建文档";
});

const placeholder = computed(() => {
  return props.mode === "folder" ? "请输入文件夹名称" : "请输入文档名称";
});

const icon = computed(() => {
  return props.mode === "folder" ? "ri-folder-add-line" : "ri-file-add-line";
});

const handleConfirm = () => {
  if (!itemName.value.trim()) return;

  if (props.mode === "document") {
    emit("create", itemName.value, documentType.value);
  } else {
    emit("create", itemName.value);
  }

  itemName.value = "";
  documentType.value = "txt";
  emit("update:show", false);
};

const handleCancel = () => {
  itemName.value = "";
  documentType.value = "txt";
  emit("update:show", false);
};
</script>

<template>
  <n-modal :show="show" @update:show="emit('update:show', $event)">
    <div class="bg-white rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl">
      <div class="flex items-center gap-3 mb-6">
        <div
          class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center"
        >
          <i :class="[icon, 'text-2xl text-blue-500']"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-800">{{ title }}</h3>
      </div>

      <div class="space-y-4">
        <n-input
          v-model:value="itemName"
          :placeholder="placeholder"
          size="large"
          @keyup.enter="handleConfirm"
          class="rounded-xl"
        />

        <div v-if="mode === 'document'" class="bg-gray-50 rounded-xl p-4">
          <p class="text-sm font-medium text-gray-700 mb-3">选择文档类型：</p>
          <n-radio-group v-model:value="documentType">
            <n-space vertical>
              <n-radio
                v-for="type in documentTypes"
                :key="type.value"
                :value="type.value"
                class="hover:bg-white p-2 rounded-lg transition-colors"
              >
                <div class="flex items-center gap-2">
                  <i :class="[type.icon, 'text-lg']"></i>
                  <span>{{ type.label }}</span>
                </div>
              </n-radio>
            </n-space>
          </n-radio-group>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <n-button @click="handleCancel" size="large">取消</n-button>
        <n-button
          type="primary"
          @click="handleConfirm"
          size="large"
          class="shadow-lg"
          >确定</n-button
        >
      </div>
    </div>
  </n-modal>
</template>
