export interface AppConfig {
  themeMode: "light" | "dark";
  document: {
    // 文件管理默认路径
    defaultPath: string;
    // 回收站默认路径
    trashPath?: string;
  };
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  themeMode: "light",
  document: {
    defaultPath: "",
    trashPath: "trash",
  },
};
