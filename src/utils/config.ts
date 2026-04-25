import { appConfigDir, join } from "@tauri-apps/api/path";
import { fs } from "@tauri-apps/api";
import type { AppConfig } from "../types/config";
import { DEFAULT_CONFIG } from "../types/config";

const CONFIG_FILE_NAME = "config.json";

class ConfigManager {
  private config: AppConfig = DEFAULT_CONFIG;
  private configPath: string | null = null;

  async init(): Promise<void> {
    try {
      const configDir = await appConfigDir();
      this.configPath = await join(configDir, CONFIG_FILE_NAME);

      const configExists = await fs.exists(this.configPath);
      if (configExists) {
        const configText = await fs.readTextFile(this.configPath);
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configText) };
      } else {
        await fs.createDir(configDir, { recursive: true });
        await this.save();
      }
    } catch (error) {
      console.error("初始化配置失败:", error);
      this.config = DEFAULT_CONFIG;
    }
  }

  get(): AppConfig {
    return { ...this.config };
  }

  async update(updates: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.save();
  }

  private async save(): Promise<void> {
    if (!this.configPath) {
      throw new Error("配置路径未初始化");
    }

    try {
      const configText = JSON.stringify(this.config, null, 2);
      await fs.writeTextFile(this.configPath, configText);
    } catch (error) {
      console.error("保存配置失败:", error);
      throw error;
    }
  }
}

export const configManager = new ConfigManager();
