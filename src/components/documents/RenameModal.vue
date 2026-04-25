<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { NModal, NInput } from "naive-ui";
import type { FileItem } from "../../types/file";

interface Props {
  show: boolean;
  file: FileItem | null;
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "confirm", file: FileItem, newName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const inputRef = ref<InstanceType<typeof NInput> | null>(null);
const newName = ref("");

watch(
  () => props.show,
  (val) => {
    if (val && props.file) {
      newName.value = props.file.name;
      nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    }
  },
);

const handleConfirm = () => {
  if (props.file && newName.value.trim() && newName.value !== props.file.name) {
    emit("confirm", props.file, newName.value.trim());
  }
  handleClose();
};

const handleClose = () => {
  emit("update:show", false);
  newName.value = "";
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    handleConfirm();
  } else if (e.key === "Escape") {
    handleClose();
  }
};
</script>

<template>
  <n-modal
    :show="show"
    preset="dialog"
    title="重命名"
    positive-text="确定"
    negative-text="取消"
    :mask-closable="false"
    @positive-click="handleConfirm"
    @negative-click="handleClose"
    @close="handleClose"
  >
    <div class="py-4">
      <n-input
        ref="inputRef"
        v-model:value="newName"
        placeholder="请输入新名称"
        size="large"
        @keydown="handleKeydown"
      />
    </div>
  </n-modal>
</template>
