export interface AppConfig {
  defaultPath: string;
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  themeMode: ThemeMode;
}

export type ViewMode = "grid" | "list";

export type SortBy = "name" | "size" | "modified" | "type";

export type SortOrder = "asc" | "desc";

export type ThemeMode = "light" | "dark";

export const DEFAULT_CONFIG: AppConfig = {
  defaultPath: "",
  viewMode: "grid",
  sortBy: "name",
  sortOrder: "asc",
  themeMode: "light",
};
