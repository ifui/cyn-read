<script setup lang="ts">
import { computed } from "vue";
import {
  NButton,
  NInput,
  NCard,
  NDivider,
  NSwitch,
  useMessage,
} from "naive-ui";
import { useThemeStore } from "../../stores/themeStore";
import { useConfigStore } from "@/stores/config";
import { open } from "@tauri-apps/api/dialog";
import { readDirectory } from "@/utils/fileSystem";

const message = useMessage();
const themeStore = useThemeStore();
const configStore = useConfigStore();
const defaultPath = computed(() => configStore.config.document.defaultPath);

const selectFolder = async () => {
  try {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "选择默认文件夹",
    });

    if (selectedPath && typeof selectedPath === "string") {
      const isEmpty = await isPathEmpty(selectedPath);
      if (isEmpty) {
        await configStore.update({
          document: {
            ...configStore.config.document,
            defaultPath: selectedPath,
          },
        });
        message.success("配置默认路径成功");
      } else {
        message.warning("请选择一个空的文件夹作为文档管理路径");
      }
    }
  } catch (error) {
    console.error("选择文件夹失败:", error);
    message.error("配置默认路径失败");
  }
};

const clearDefaultPath = async () => {
  try {
    await configStore.update({
      document: { ...configStore.config.document, defaultPath: "" },
    });
    message.success("已清除默认文件夹");
  } catch (error) {
    console.error("清除配置失败:", error);
    message.error("清除配置失败");
  }
};

// 判断文件路径是否为空
const isPathEmpty = async (path: string) => {
  const files = await readDirectory({ path });
  return files.length === 0;
};
</script>

<template>
  <div class="settings-container h-full overflow-auto">
    <div class="max-w-3xl mx-auto p-8">
      <!-- 页面标题 -->
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          设置
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理应用偏好设置
        </p>
      </div>

      <!-- 外观设置 -->
      <div class="settings-section mb-6">
        <div class="section-header mb-4">
          <h2 class="text-base font-medium text-gray-800 dark:text-gray-200">
            外观
          </h2>
        </div>
        <n-card class="settings-card" :bordered="false">
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">深色模式</div>
              <div class="setting-desc">切换应用的明暗主题</div>
            </div>
            <div class="setting-control">
              <n-switch
                :value="themeStore.isDark"
                @update:value="themeStore.toggleTheme"
              >
                <template #checked-icon>
                  <i class="ri-moon-line text-sm"></i>
                </template>
                <template #unchecked-icon>
                  <i class="ri-sun-line text-sm"></i>
                </template>
              </n-switch>
            </div>
          </div>
        </n-card>
      </div>

      <!-- 文件管理 -->
      <div class="settings-section mb-6">
        <div class="section-header mb-4">
          <h2 class="text-base font-medium text-gray-800 dark:text-gray-200">
            文件管理
          </h2>
        </div>
        <n-card class="settings-card" :bordered="false">
          <div class="setting-item">
            <div class="setting-info flex-1">
              <div class="setting-label">默认文件夹</div>
              <div class="setting-desc">
                设置默认文件夹后，文档管理页面将自动显示该文件夹内容
              </div>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex gap-2">
              <n-input
                :value="defaultPath"
                readonly
                placeholder="未设置默认文件夹"
                class="flex-1"
              >
                <template #prefix>
                  <i class="ri-folder-line text-gray-400"></i>
                </template>
              </n-input>
              <n-button type="secondary" @click="selectFolder">
                <template #icon>
                  <i class="ri-folder-add-line"></i>
                </template>
                选择
              </n-button>
              <n-button
                v-if="defaultPath"
                type="secondary"
                @click="clearDefaultPath"
              >
                清除
              </n-button>
            </div>
          </div>
        </n-card>
      </div>

      <!-- 关于 -->
      <div class="settings-section">
        <div class="section-header mb-4">
          <h2 class="text-base font-medium text-gray-800 dark:text-gray-200">
            关于
          </h2>
        </div>
        <n-card class="settings-card" :bordered="false">
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">应用名称</div>
            </div>
            <div class="setting-value">芯阅</div>
          </div>
          <n-divider style="margin: 16px 0" />
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">版本</div>
            </div>
            <div class="setting-value">0.1.0</div>
          </div>
          <n-divider style="margin: 16px 0" />
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">Slogan</div>
            </div>
            <div class="setting-value text-gray-500 dark:text-gray-400">
              方寸芯阅，纸页随心
            </div>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  background-color: var(--color-bg-secondary);
}

.settings-card {
  background-color: var(--color-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.settings-card :deep(.n-card__content) {
  padding: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.setting-control {
  flex-shrink: 0;
}

.setting-value {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
}

/* 暗色模式适配 */
:deep(.n-input) {
  background-color: var(--color-bg-secondary);
}

:deep(.n-input .n-input__border) {
  border-color: var(--color-border);
}

:deep(.n-input .n-input__el) {
  color: var(--color-text);
}
</style>
