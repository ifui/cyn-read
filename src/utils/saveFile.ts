/**
 * 保存文件工具
 *  - Tauri 环境：弹原生保存对话框，让用户选位置
 *  - 浏览器环境（dev 调试）：走原来的 a[download] 默认下载
 */
import { save as tauriSave } from "@tauri-apps/api/dialog";
import { writeBinaryFile, writeTextFile } from "@tauri-apps/api/fs";

/** 是否运行在 Tauri 桌面环境（生产） */
export const isTauri = () =>
  typeof (window as any).__TAURI_IPC__ === "function";

/** 浏览器环境兜底：触发默认下载 */
function fallbackDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 文件过滤器：根据扩展名猜一个 name */
function buildFilters(filename: string): { name: string; extensions: string[] }[] {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return [];
  const nameMap: Record<string, string> = {
    png: "PNG 图片",
    jpg: "JPEG 图片",
    jpeg: "JPEG 图片",
    json: "JSON 文件",
    xlsx: "Excel 工作簿",
    xls: "Excel 工作簿",
    csv: "CSV 文件",
    txt: "文本文件",
  };
  return [{ name: nameMap[ext] || ext.toUpperCase(), extensions: [ext] }];
}

/**
 * 保存 Blob 到本地（任意二进制：png/jpg/xlsx/...）
 */
export async function saveBlob(
  blob: Blob,
  filename: string,
  title = "保存文件",
): Promise<{ ok: boolean; reason?: string }> {
  if (isTauri()) {
    try {
      const path = await tauriSave({
        defaultPath: filename,
        filters: buildFilters(filename),
        title,
      });
      if (!path) return { ok: false, reason: "已取消保存" };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeBinaryFile(path, bytes);
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, reason: "保存失败" };
    }
  }
  fallbackDownload(blob, filename);
  return { ok: true };
}

/**
 * 保存文本到本地（json / csv / txt / ...）
 */
export async function saveText(
  text: string,
  filename: string,
  title = "保存文件",
  mime = "text/plain;charset=utf-8",
): Promise<{ ok: boolean; reason?: string }> {
  if (isTauri()) {
    try {
      const path = await tauriSave({
        defaultPath: filename,
        filters: buildFilters(filename),
        title,
      });
      if (!path) return { ok: false, reason: "已取消保存" };
      await writeTextFile(path, text);
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, reason: "保存失败" };
    }
  }
  fallbackDownload(new Blob([text], { type: mime }), filename);
  return { ok: true };
}
