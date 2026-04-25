<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  NButton,
  NInput,
  NCard,
  NDivider,
  NSwitch,
  NAlert,
  useMessage,
} from "naive-ui";
import { configManager } from "../../utils/config";
import { dialog } from "@tauri-apps/api";
import { useThemeStore } from "../../stores/themeStore";

const message = useMessage();
const themeStore = useThemeStore();
const defaultPath = ref("");
const errorMessage = ref("");
const showError = ref(false);

onMounted(async () => {
  try {
    await configManager.init();
    const config = configManager.get();
    defaultPath.value = config.defaultPath;
  } catch (error) {
    console.error("初始化配置失败:", error);
    errorMessage.value = `初始化配置失败: ${error}`;
    showError.value = true;
  }
});

const selectFolder = async () => {
  showError.value = false;
  errorMessage.value = "";

  try {
    const selected = await dialog.open({
      directory: true,
      multiple: false,
      title: "选择默认文件夹",
    });

    if (selected) {
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (path && typeof path === "string") {
        defaultPath.value = path;
        await configManager.update({ defaultPath: path });
        message.success("默认文件夹设置成功");
      }
    }
  } catch (error) {
    console.error("选择文件夹失败:", error);
    errorMessage.value = `选择文件夹失败: ${error}`;
    showError.value = true;
    message.error("选择文件夹失败，请查看详细信息");
  }
};

const clearDefaultPath = async () => {
  showError.value = false;
  try {
    defaultPath.value = "";
    await configManager.update({ defaultPath: "" });
    message.success("已清除默认文件夹");
  } catch (error) {
    console.error("清除配置失败:", error);
    errorMessage.value = `清除配置失败: ${error}`;
    showError.value = true;
  }
};
</script>

<template>
  <div class="settings-container h-full overflow-auto p-6">
    <div class="max-w-4xl mx-auto">
      <h1 class="page-title text-2xl font-bold mb-6">系统设置</h1>

      <n-alert
        v-if="showError"
        type="error"
        :title="errorMessage"
        class="mb-4"
        closable
        @close="showError = false"
      >
        <p class="text-sm">{{ errorMessage }}</p>
      </n-alert>

      <n-card title="外观设置" class="settings-card mb-4">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium">深色模式</label>
              <p class="text-xs mt-1 opacity-60">切换应用的明暗主题</p>
            </div>
            <n-switch
              :value="themeStore.isDark"
              @update:value="themeStore.toggleTheme"
            >
              <template #checked-icon>
                <i class="ri-moon-line"></i>
              </template>
              <template #unchecked-icon>
                <i class="ri-sun-line"></i>
              </template>
            </n-switch>
          </div>
        </div>
      </n-card>

      <n-card title="文件管理" class="settings-card mb-4">
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium">默认文件夹</label>
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
                <i class="ri-folder-line opacity-60"></i>
              </template>
            </n-input>
            <p class="text-xs mt-2 opacity-60">
              设置默认文件夹后，文档管理页面将自动显示该文件夹内容
            </p>
          </div>
        </div>
      </n-card>

      <n-card title="关于" class="settings-card mb-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm opacity-70">应用名称</span>
            <span class="text-sm font-medium">芯阅</span>
          </div>
          <n-divider style="margin: 12px 0" />
          <div class="flex items-center justify-between">
            <span class="text-sm opacity-70">版本</span>
            <span class="text-sm font-medium">0.1.0</span>
          </div>
          <n-divider style="margin: 12px 0" />
          <div class="flex items-center justify-between">
            <span class="text-sm opacity-70">Slogan</span>
            <span class="text-sm opacity-60">方寸芯阅，纸页随心</span>
          </div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  background-color: var(--color-bg-secondary);
}

.page-title {
  color: var(--color-text);
}

.settings-card {
  background-color: var(--color-bg);
  border-color: var(--color-border);
}

.settings-card :deep(.n-card-header) {
  color: var(--color-text);
}

.settings-card :deep(.n-card__content) {
  color: var(--color-text-secondary);
}
</style>
