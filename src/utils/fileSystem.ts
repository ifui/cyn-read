import { fs } from "@tauri-apps/api";
import type { FileItem } from "../types/file";
import { extname } from "@tauri-apps/api/path";
import { getFileMetadata } from "./metadata";

export interface ReadDirOptions {
  path: string;
  search?: string;
}

export async function readDirectory(
  options: ReadDirOptions,
): Promise<FileItem[]> {
  const { path, search } = options;

  try {
    const entries = await fs.readDir(path);
    const files: FileItem[] = [];

    for (const entry of entries) {
      if (search && !entry.name?.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      const fullPath = entry.path;

      let size = 0;
      let created = 0;
      let modified = 0;

      try {
        const metadata = await getFileMetadata(fullPath);
        size = metadata.size;
        created = metadata.created || 0;
        modified = metadata.modified || 0;
      } catch (error) {
        console.error("获取文件元数据失败:", error);
      }

      const fileItem: FileItem = {
        name: entry.name || "",
        path: fullPath,
        isDirectory: entry.children !== undefined,
        size: size,
        modified: modified,
        created: created,
        extension: entry.children
          ? ""
          : await getFileExtension(entry.name || ""),
      };

      files.push(fileItem);
    }

    return files;
  } catch (error) {
    console.error("读取目录失败:", error);
    return [];
  }
}

async function getFileExtension(filename: string): Promise<string> {
  try {
    const ext = await extname(filename);
    return ext || "";
  } catch {
    return "";
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "-";

  const date = new Date(timestamp);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
