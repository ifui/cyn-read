import { defineStore } from "pinia";
import { ref } from "vue";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { fs } from "@tauri-apps/api";
import type { AppConfig } from "@/types/config";
import { DEFAULT_CONFIG } from "@/types/config";
import { merge } from "lodash-es";

const CONFIG_FILE_NAME = "config.json";

export const useConfigStore = defineStore("config", () => {
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG });
  const initialized = ref(false);

  /**
   * 初始化配置（从文件加载）
   */
  async function init() {
    if (initialized.value) return;

    try {
      const configDir = await appConfigDir();
      const configPath = await join(configDir, CONFIG_FILE_NAME);

      const configExists = await fs.exists(configPath);
      if (configExists) {
        const configText = await fs.readTextFile(configPath);
        config.value = { ...DEFAULT_CONFIG, ...JSON.parse(configText) };
      } else {
        try {
          await fs.createDir(configDir, { recursive: true });
        } catch (dirError) {
          console.warn("创建配置目录失败，可能已存在:", dirError);
        }
        await save(configPath);
      }
      initialized.value = true;
    } catch (error) {
      console.error("初始化配置失败:", error);
      config.value = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 保存配置到文件
   */
  async function save(configPath?: string) {
    const path =
      configPath || (await join(await appConfigDir(), CONFIG_FILE_NAME));

    try {
      const configText = JSON.stringify(config.value, null, 2);
      await fs.writeTextFile(path, configText);
    } catch (error) {
      console.error("保存配置失败:", error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  async function update(updates: Partial<AppConfig>) {
    config.value = merge(config.value, updates);
    await save();
  }

  return {
    config,
    initialized,
    init,
    update,
  };
});
