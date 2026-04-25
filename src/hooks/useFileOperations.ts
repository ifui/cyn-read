import { useDialog } from "naive-ui";
import type { FileItem } from "../types/file";
import { clipboardManager } from "./useClipboard";
import { useProgress } from "./useProgress";
import { useStatusStore } from "../stores/statusStore";
import { shell, fs, os } from "@tauri-apps/api";
import { Command } from "@tauri-apps/api/shell";
import { dirname, join, extname, basename } from "@tauri-apps/api/path";
import { getFileMetadata } from "../utils/metadata";

export function useFileOperations() {
  const dialog = useDialog();
  const statusStore = useStatusStore();
  const {
    show: showProgress,
    update: updateProgress,
    complete: completeProgress,
  } = useProgress();

  const getUniqueFileName = async (
    baseName: string,
    extension: string,
    dirPath: string,
  ): Promise<string> => {
    let fileName = extension ? `${baseName}.${extension}` : baseName;
    let counter = 1;

    while (await fs.exists(await join(dirPath, fileName))) {
      fileName = extension
        ? `${baseName} (${counter}).${extension}`
        : `${baseName} (${counter})`;
      counter++;
    }

    return fileName;
  };

  const countFiles = async (dirPath: string): Promise<number> => {
    let count = 0;
    try {
      const entries = await fs.readDir(dirPath);
      for (const entry of entries) {
        if (entry.children !== undefined) {
          count += await countFiles(entry.path);
        } else {
          count++;
        }
      }
    } catch {
      count = 1;
    }
    return count;
  };

  const copyDirectoryRecursive = async (
    srcPath: string,
    destPath: string,
    progressId: string,
    progress: { current: number; total: number },
  ): Promise<void> => {
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
          progressId,
          progress,
        );
      } else {
        await fs.copyFile(srcEntryPath, destEntryPath);
        progress.current++;
        updateProgress(
          progressId,
          progress.current,
          progress.total,
          entry.name || "",
        );
      }
    }
  };

  const copyFiles = async (
    items: Array<{
      sourcePath: string;
      action: string;
      name: string;
      isDirectory: boolean;
    }>,
    destPath: string,
    onSuccess?: () => void,
  ) => {
    const copyItems = items.filter((item) => item.action === "copy");
    if (copyItems.length === 0) return;

    let totalFiles = 0;
    for (const item of copyItems) {
      try {
        const srcMetadata = await getFileMetadata(item.sourcePath);
        if (srcMetadata.is_dir) {
          totalFiles += await countFiles(item.sourcePath);
        } else {
          totalFiles++;
        }
      } catch {
        totalFiles++;
      }
    }

    if (totalFiles === 0) return;

    const progressId = showProgress("复制文件", totalFiles);
    const progress = { current: 0, total: totalFiles };
    let successCount = 0;
    let failCount = 0;

    for (const item of copyItems) {
      try {
        const name = await basename(item.sourcePath);
        const uniqueName = await getUniqueFileName(
          name.includes(".") ? name.substring(0, name.lastIndexOf(".")) : name,
          name.includes(".") ? await extname(name) : "",
          destPath,
        );
        const targetPath = await join(destPath, uniqueName);

        const srcMetadata = await getFileMetadata(item.sourcePath);

        if (srcMetadata.is_dir) {
          await copyDirectoryRecursive(
            item.sourcePath,
            targetPath,
            progressId,
            progress,
          );
          successCount++;
        } else {
          await fs.copyFile(item.sourcePath, targetPath);
          progress.current++;
          updateProgress(progressId, progress.current, progress.total, name);
          successCount++;
        }
      } catch (error) {
        console.error("复制失败:", error);
        failCount++;
      }
    }

    completeProgress(progressId);

    if (successCount > 0) {
      statusStore.showMessage(`成功复制 ${successCount} 个项目`, "success");
      clipboardManager.clear();
      onSuccess?.();
    }
    if (failCount > 0) {
      statusStore.showMessage(`${failCount} 个项目复制失败`, "error");
    }
  };

  const moveFiles = async (
    items: Array<{
      sourcePath: string;
      action: string;
      name: string;
      isDirectory: boolean;
    }>,
    destPath: string,
    onSuccess?: () => void,
  ) => {
    const cutItems = items.filter((item) => item.action === "cut");
    if (cutItems.length === 0) return;

    let totalFiles = 0;
    const itemCounts: number[] = [];
    for (const item of cutItems) {
      try {
        const srcMetadata = await getFileMetadata(item.sourcePath);
        if (srcMetadata.is_dir) {
          const count = await countFiles(item.sourcePath);
          totalFiles += count;
          itemCounts.push(count);
        } else {
          totalFiles++;
          itemCounts.push(1);
        }
      } catch {
        totalFiles++;
        itemCounts.push(1);
      }
    }

    const progressId = showProgress("移动文件", totalFiles);
    let successCount = 0;
    let failCount = 0;
    let processedFiles = 0;

    for (let i = 0; i < cutItems.length; i++) {
      const item = cutItems[i];
      try {
        const name = await basename(item.sourcePath);
        const uniqueName = await getUniqueFileName(
          name.includes(".") ? name.substring(0, name.lastIndexOf(".")) : name,
          name.includes(".") ? await extname(name) : "",
          destPath,
        );
        const targetPath = await join(destPath, uniqueName);

        await fs.renameFile(item.sourcePath, targetPath);
        processedFiles += itemCounts[i];
        updateProgress(progressId, processedFiles, totalFiles, name);
        successCount++;
      } catch (error) {
        console.error("移动失败:", error);
        failCount++;
      }
    }

    completeProgress(progressId);

    if (successCount > 0) {
      statusStore.showMessage(`成功移动 ${successCount} 个项目`, "success");
      clipboardManager.clear();
      onSuccess?.();
    }
    if (failCount > 0) {
      statusStore.showMessage(`${failCount} 个项目移动失败`, "error");
    }
  };

  const deleteFiles = async (files: FileItem[], onSuccess?: () => void) => {
    if (files.length === 0) return;

    const fileNames = files
      .slice(0, 5)
      .map((f) => f.name)
      .join(", ");
    const displayNames =
      files.length > 5 ? `${fileNames} 等 ${files.length} 个项目` : fileNames;
    const title =
      files.length === 1 ? "确认删除" : `确认删除 ${files.length} 个项目`;

    dialog.warning({
      title,
      content: `确定要删除 "${displayNames}" 吗？此操作无法撤销。`,
      positiveText: "删除",
      negativeText: "取消",
      onPositiveClick: async () => {
        try {
          for (const file of files) {
            if (file.isDirectory) {
              await fs.removeDir(file.path, { recursive: true });
            } else {
              await fs.removeFile(file.path);
            }
          }
          statusStore.showMessage(`已删除 ${files.length} 个项目`, "success");
          onSuccess?.();
        } catch (error) {
          console.error("删除失败:", error);
          statusStore.showMessage("删除失败", "error");
        }
      },
    });
  };

  const renameFile = async (
    file: FileItem,
    newName: string,
    onSuccess?: () => void,
  ) => {
    if (!newName.trim()) return;

    try {
      const parentPath = await dirname(file.path);
      const newPath = await join(parentPath, newName);

      await fs.renameFile(file.path, newPath);
      statusStore.showMessage("重命名成功", "success");
      onSuccess?.();
    } catch (error) {
      console.error("重命名失败:", error);
      statusStore.showMessage("重命名失败", "error");
    }
  };

  const createFolder = async (
    parentPath: string,
    name: string,
    onSuccess?: () => void,
  ) => {
    try {
      const fullPath = await join(parentPath, name);
      await fs.createDir(fullPath);
      statusStore.showMessage("文件夹创建成功", "success");
      onSuccess?.();
    } catch (error) {
      console.error("创建失败:", error);
      statusStore.showMessage("创建失败", "error");
    }
  };

  const createDocument = async (
    parentPath: string,
    name: string,
    documentType?: string,
    onSuccess?: () => void,
  ) => {
    try {
      const fullPath = await join(parentPath, name);
      const finalPath = documentType ? `${fullPath}.${documentType}` : fullPath;
      await fs.writeTextFile(finalPath, "");
      statusStore.showMessage("文档创建成功", "success");
      onSuccess?.();
    } catch (error) {
      console.error("创建失败:", error);
      statusStore.showMessage("创建失败", "error");
    }
  };

  const openFile = async (path: string) => {
    try {
      await shell.open(path);
    } catch (error) {
      console.error("打开文件失败:", error);
      statusStore.showMessage("打开文件失败", "error");
    }
  };

  const openFileWith = async (file: FileItem) => {
    try {
      const platformName = await os.platform();
      if (platformName === "win32") {
        const cmd = new Command("open-with-dialog", [
          "shell32.dll,OpenAs_RunDLL",
          file.path,
        ]);
        await cmd.execute();
      } else if (platformName === "darwin") {
        statusStore.showMessage("macOS 暂不支持打开方式对话框", "info");
      } else {
        statusStore.showMessage("Linux 暂不支持打开方式对话框", "info");
      }
    } catch (error) {
      console.error("打开方式失败:", error);
      statusStore.showMessage("打开方式失败", "error");
    }
  };

  return {
    copyFiles,
    moveFiles,
    deleteFiles,
    renameFile,
    createFolder,
    createDocument,
    openFile,
    openFileWith,
  };
}
