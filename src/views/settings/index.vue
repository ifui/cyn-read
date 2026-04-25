<script setup lang="ts">
import { ref, onMounted } from "vue";
import { NButton, NInput, NCard, NDivider, useMessage } from "naive-ui";
import { configManager } from "../../utils/config";
import { dialog } from "@tauri-apps/api";

const message = useMessage();
const defaultPath = ref("");

onMounted(async () => {
  await configManager.init();
  const config = configManager.get();
  defaultPath.value = config.defaultPath;
});

const selectFolder = async () => {
  try {
    const selected = await dialog.open({
      directory: true,
      multiple: false,
      title: "选择默认文件夹",
    });

    if (selected && typeof selected === "string") {
      defaultPath.value = selected;
      await configManager.update({ defaultPath: selected });
      message.success("默认文件夹设置成功");
    }
  } catch (error) {
    console.error("选择文件夹失败:", error);
    message.error("选择文件夹失败");
  }
};

const clearDefaultPath = async () => {
  defaultPath.value = "";
  await configManager.update({ defaultPath: "" });
  message.success("已清除默认文件夹");
};
</script>

<template>
  <div class="h-full overflow-auto p-6 bg-gray-50">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">系统设置</h1>

      <n-card title="文件管理" class="mb-4">
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700"
                >默认文件夹</label
              >
              <div class="flex gap-2">
                <n-button size="small" @click="selectFolder">
                  <template #icon>
                    <i class="ri-folder-add-line"></i>
                  </template>
                  选择文件夹
                </n-button>
                <n-button
                  size="small"
                  v-if="defaultPath"
                  @click="clearDefaultPath"
                >
                  清除
                </n-button>
              </div>
            </div>
            <n-input
              v-model:value="defaultPath"
              readonly
              placeholder="未设置默认文件夹"
            >
              <template #prefix>
                <i class="ri-folder-line text-gray-400"></i>
              </template>
            </n-input>
            <p class="text-xs text-gray-500 mt-2">
              设置默认文件夹后，文档管理页面将自动显示该文件夹内容
            </p>
          </div>
        </div>
      </n-card>

      <n-card title="关于" class="mb-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">应用名称</span>
            <span class="text-sm font-medium">芯阅</span>
          </div>
          <n-divider style="margin: 12px 0" />
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">版本</span>
            <span class="text-sm font-medium">0.1.0</span>
          </div>
          <n-divider style="margin: 12px 0" />
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Slogan</span>
            <span class="text-sm text-gray-500">方寸芯阅，纸页随心</span>
          </div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<style scoped></style>
