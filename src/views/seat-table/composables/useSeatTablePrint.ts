/**
 * 画布导出 / 打印 composable
 *
 * 核心：html2canvas 截图 .seat-canvas → PNG dataURL
 *  - exportImage()：直接下载 PNG（无标题）
 *  - exportImageAsA4({title, meta})：把 PNG 嵌到 A4 容器（标题 + 副标题 + 图）→ 下载
 *  - printCanvas()：直接打印 PNG（无标题）
 *  - printCanvasAsA4({title, meta})：把 PNG 嵌到 A4 容器 → 打印
 *
 * 不复制画布 DOM、不复制 scoped 样式 —— 只复用已经渲染好的 PNG，避免空百/错位。
 */
import { ref } from "vue";
import { useSeatTableStore } from "../store";

/* A4 横向：297mm × 210mm @ 96dpi */
const A4_W = 1123;
const A4_H = 794;
const A4_PADDING = 24;

export interface A4Options {
  title?: string;
  meta?: string;
}

export function useSeatTablePrint() {
  const store = useSeatTableStore();
  const isExporting = ref(false);

  /** 临时把 .seat-canvas 的 position/top/left/transform 清零
   *  让 html2canvas 抓到完整、未平移缩放的内容 */
  function resetCanvasPosition(el: HTMLElement): () => void {
    const orig = {
      position: el.style.position,
      top: el.style.top,
      left: el.style.left,
      transform: el.style.transform,
      transformOrigin: el.style.transformOrigin,
    };
    el.style.position = "relative";
    el.style.top = "0";
    el.style.left = "0";
    el.style.transform = "none";
    el.style.transformOrigin = "0 0";
    // 加 .is-exporting：触发 .person-name 的 margin-top: -14px 补偿，
    // 抵消 html2canvas 1.x 文字下偏的 bug。预览时无此 class，文字自然居中。
    el.classList.add("is-exporting");
    return () => {
      el.style.position = orig.position;
      el.style.top = orig.top;
      el.style.left = orig.left;
      el.style.transform = orig.transform;
      el.style.transformOrigin = orig.transformOrigin;
      el.classList.remove("is-exporting");
    };
  }

  /** 等字体加载完 + 两帧 layout 稳定 */
  async function settle() {
    const d: any = document;
    if (d.fonts?.ready) {
      try {
        await d.fonts.ready;
      } catch {
        /* ignore */
      }
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }

  /** 把 .seat-canvas 截图成 dataURL（PNG） */
  async function captureCanvasDataURL(): Promise<string | null> {
    const target = store.canvasRef;
    if (!target) return null;
    const w = target.offsetWidth;
    const h = target.offsetHeight;
    if (w <= 0 || h <= 0) return null;

    const restore = resetCanvasPosition(target);
    try {
      await settle();
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target, {
        backgroundColor: "#faf8f4",
        scale: 2,
        useCORS: true,
        logging: false,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
      });

      // ===== 导出图四周加 20px 留白 =====
      // 用 canvas API 在外圈画一圈同色背景，不动原图。
      // scale=2，所以 20px 视觉对应 40px 物理像素。
      const PAD_PX = 20 * 2;
      const out = document.createElement("canvas");
      out.width = canvas.width + PAD_PX * 2;
      out.height = canvas.height + PAD_PX * 2;
      const ctx = out.getContext("2d");
      if (!ctx) return canvas.toDataURL("image/png");
      ctx.fillStyle = "#faf8f4";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, PAD_PX, PAD_PX);
      return out.toDataURL("image/png");
    } finally {
      restore();
    }
  }

  /* ============================================================
   * 1. 导出/打印：纯画布
   * ============================================================ */

  /** 导出画布 PNG（无标题） */
  async function exportImage(): Promise<{ ok: boolean; reason?: string }> {
    if (isExporting.value) return { ok: false, reason: "正在导出中" };
    isExporting.value = true;
    try {
      const dataURL = await captureCanvasDataURL();
      if (!dataURL) return { ok: false, reason: "画布未就绪" };
      const blob = await (await fetch(dataURL)).blob();
      downloadBlob(
        blob,
        `座位图-${store.formatTime(Date.now()).slice(0, 10)}.png`,
      );
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, reason: "导出失败" };
    } finally {
      isExporting.value = false;
    }
  }

  /** 打印画布 PNG（无标题） */
  async function printCanvas(): Promise<{ ok: boolean; reason?: string }> {
    const dataURL = await captureCanvasDataURL();
    if (!dataURL) return { ok: false, reason: "画布未就绪" };
    return printImageDataURL(dataURL, "");
  }

  /* ============================================================
   * 2. 导出/打印：A4 套版（标题 + 副标题 + 画布 PNG）
   * ============================================================ */

  /**
   * 构造 A4 版式 HTML 字符串（独立文档，不依赖主站样式）
   * canvasDataURL 是已渲染好的 PNG dataURL
   */
  function buildA4Html(canvasDataURL: string, opts: A4Options): string {
    const title = (opts.title || "").trim();
    const meta = (opts.meta || "").trim();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<style>
  html, body {
    margin: 0; padding: 0; background: #faf8f4;
    font-family: "Noto Serif SC","Songti SC","Microsoft YaHei",serif;
    color: #2c2c2c;
  }
  .page {
    width: ${A4_W}px; height: ${A4_H}px;
    box-sizing: border-box;
    padding: ${A4_PADDING}px;
    display: flex; flex-direction: column; align-items: center;
  }
  .title {
    font-size: 22px; font-weight: 600;
    letter-spacing: 4px;
    margin-top: 4px;
  }
  .meta {
    font-size: 12px; color: #6b6b6b;
    margin-top: 4px; margin-bottom: 12px;
  }
  .img-wrap {
    flex: 1;
    width: 100%;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .img-wrap img {
    max-width: 100%; max-height: 100%;
    object-fit: contain;
  }
  @media print {
    @page { size: A4 landscape; margin: 6mm; }
    html, body { background: #fff !important; width: 100% !important; height: 100% !important; }
    .title, .meta { color: #000 !important; }
  }
</style>
</head>
<body>
<div class="page">
  ${title ? `<div class="title">${escapeHtml(title)}</div>` : ""}
  ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}
  <div class="img-wrap"><img src="${canvasDataURL}" /></div>
</div>
</body>
</html>`;
  }

  /** 在隐藏 iframe 里渲染 A4 HTML，再用 html2canvas 截图 → PNG dataURL */
  async function captureA4DataURL(opts: A4Options): Promise<string | null> {
    const canvasDataURL = await captureCanvasDataURL();
    if (!canvasDataURL) return null;

    const html = buildA4Html(canvasDataURL, opts);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;border:0;width:0;height:0;opacity:0;";
    document.body.appendChild(iframe);

    try {
      const idoc = iframe.contentDocument;
      if (!idoc) return null;
      idoc.open();
      idoc.write(html);
      idoc.close();

      // 等 A4 容器和图片就位
      const iwin: any = iframe.contentWindow;
      if (iwin?.document?.fonts?.ready) {
        try {
          await iwin.document.fonts.ready;
        } catch {
          /* ignore */
        }
      }
      // 等图片加载完
      await new Promise<void>((resolve) => {
        const img = idoc.querySelector("img");
        if (!img || img.complete) {
          resolve();
          return;
        }
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
        // 兜底：5s 后不等了
        setTimeout(resolve, 5000);
      });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const page = idoc.querySelector(".page") as HTMLElement;
      if (!page) return null;
      const html2canvas = (await import("html2canvas")).default;
      const result = await html2canvas(page, {
        backgroundColor: "#faf8f4",
        scale: 2,
        useCORS: true,
        logging: false,
        width: A4_W,
        height: A4_H,
        windowWidth: A4_W,
        windowHeight: A4_H,
      });
      return result.toDataURL("image/png");
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      iframe.remove();
    }
  }

  /** 导出 A4 套版图片（标题 + 副标题 + 画布） */
  async function exportImageAsA4(
    opts: A4Options = {},
  ): Promise<{ ok: boolean; reason?: string }> {
    if (isExporting.value) return { ok: false, reason: "正在导出中" };
    isExporting.value = true;
    try {
      const dataURL = await captureA4DataURL(opts);
      if (!dataURL) return { ok: false, reason: "画布未就绪" };
      const blob = await (await fetch(dataURL)).blob();
      downloadBlob(
        blob,
        `座位图-${store.formatTime(Date.now()).slice(0, 10)}.png`,
      );
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, reason: "导出失败" };
    } finally {
      isExporting.value = false;
    }
  }

  /** 打印 A4 套版（标题 + 副标题 + 画布） */
  async function printCanvasAsA4(
    opts: A4Options = {},
  ): Promise<{ ok: boolean; reason?: string }> {
    const dataURL = await captureA4DataURL(opts);
    if (!dataURL) return { ok: false, reason: "画布未就绪" };
    const title = (opts.title || "").trim();
    return printImageDataURL(dataURL, title);
  }

  /* ============================================================
   * 3. 共用：把 PNG dataURL 放进 iframe 并打印
   * ============================================================ */
  function printImageDataURL(
    dataURL: string,
    docTitle: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;border:0;width:0;height:0;opacity:0;";
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument;
    if (!idoc) {
      iframe.remove();
      return Promise.resolve({ ok: false, reason: "打印窗口未就绪" });
    }
    idoc.open();
    idoc.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>${escapeHtml(docTitle)}</title>
<style>
  @page { size: A4 landscape; margin: 6mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
<img id="pic" src="${dataURL}"/>
<script>
  const img = document.getElementById('pic');
  img.onload = () => setTimeout(() => window.print(), 100);
  if (img.complete) img.onload(new Event('load'));
</script>
</body></html>`);
    idoc.close();

    const iwin = iframe.contentWindow;
    iwin?.addEventListener?.("afterprint", () => {
      setTimeout(() => iframe.remove(), 200);
    });
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove();
    }, 30000);

    return Promise.resolve({ ok: true });
  }

  return {
    isExporting,
    /* 无标题 */
    exportImage,
    printCanvas,
    /* 带标题/副标题 */
    exportImageAsA4,
    printCanvasAsA4,
  };
}

/* ---------------- 工具 ---------------- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
