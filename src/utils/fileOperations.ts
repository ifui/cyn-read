import { fs } from "@tauri-apps/api";
import { join, basename } from "@tauri-apps/api/path";
import { getFileMetadata } from "./metadata";

export interface CopyOptions {
  srcPath: string;
  destDir: string;
  onProgress?: (current: number, total: number, currentFile: string) => void;
}

async function countFiles(dirPath: string): Promise<number> {
  let count = 0;
  const entries = await fs.readDir(dirPath);
  for (const entry of entries) {
    if (entry.children !== undefined) {
      count += await countFiles(entry.path);
    } else {
      count++;
    }
  }
  return count;
}

async function copyDirectoryRecursive(
  srcPath: string,
  destPath: string,
  progress: { current: number; total: number },
  onProgress?: (current: number, total: number, currentFile: string) => void,
): Promise<void> {
  const entries = await fs.readDir(srcPath);

  if (!(await fs.exists(destPath))) {
    await fs.createDir(destPath, { recursive: true });
  }

  for (const entry of entries) {
    const srcEntryPath = entry.path;
    const destEntryPath = await join(destPath, entry.name || "");

    if (entry.children !== undefined) {
      await copyDirectoryRecursive(
        srcEntryPath,
        destEntryPath,
        progress,
        onProgress,
      );
    } else {
      await fs.copyFile(srcEntryPath, destEntryPath);
      progress.current++;
      onProgress?.(progress.current, progress.total, entry.name || "");
    }
  }
}

export async function copyFileOrDirectory(options: CopyOptions): Promise<void> {
  const { srcPath, destDir, onProgress } = options;

  const name = await basename(srcPath);
  const destPath = await join(destDir, name);

  const srcMetadata = await getFileMetadata(srcPath);

  if (srcMetadata.is_dir) {
    const totalFiles = await countFiles(srcPath);
    const progress = { current: 0, total: totalFiles };

    await copyDirectoryRecursive(srcPath, destPath, progress, onProgress);
  } else {
    await fs.copyFile(srcPath, destPath);
    onProgress?.(1, 1, name);
  }
}

export async function copyMultipleFiles(
  items: Array<{ srcPath: string; destDir: string }>,
  onProgress?: (current: number, total: number, currentFile: string) => void,
): Promise<void> {
  let totalFiles = 0;
  for (const item of items) {
    const srcMetadata = await getFileMetadata(item.srcPath);
    if (srcMetadata.is_dir) {
      totalFiles += await countFiles(item.srcPath);
    } else {
      totalFiles++;
    }
  }

  let current = 0;
  for (const item of items) {
    const name = await basename(item.srcPath);
    const destPath = await join(item.destDir, name);

    const srcMetadata = await getFileMetadata(item.srcPath);

    if (srcMetadata.is_dir) {
      const dirProgress = { current: 0, total: 0 };
      await copyDirectoryRecursive(item.srcPath, destPath, dirProgress, () => {
        current++;
        onProgress?.(current, totalFiles, name);
      });
    } else {
      await fs.copyFile(item.srcPath, destPath);
      current++;
      onProgress?.(current, totalFiles, name);
    }
  }
}
