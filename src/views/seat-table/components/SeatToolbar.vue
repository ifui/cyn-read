<script setup lang="ts">
/**
 * 顶部工具栏
 *  - 人员导入 / 清单导出
 *  - 布局导入 / 布局导出
 *  - 画布导出 PNG / 打印（先弹标题弹窗，可选加标题副标题）
 *  - 自动排座
 *  - 交换日志
 */
import { ref, h } from "vue";
import {
  NButton,
  NDivider,
  NSelect,
  NBadge,
  NText,
  NInput,
  useMessage,
  useDialog,
} from "naive-ui";
import { utils, write } from "xlsx";
import { storeToRefs } from "pinia";
import { useSeatTableStore } from "../store";
import { useImportExport } from "../composables/useImportExport";
import { useSeatTablePrint } from "../composables/useSeatTablePrint";
import { saveBlob } from "@/utils/saveFile";
import type { ArrangeStrategy } from "../types";

const store = useSeatTableStore();
const message = useMessage();
const dialog = useDialog();
const { swapLogs } = storeToRefs(store);

const emit = defineEmits<{
  (e: "open-log"): void;
}>();

/* ---------- 排座策略 ---------- */
const strategy = ref<ArrangeStrategy>("row-center-out");
const strategyOptions = [
  { label: "行内居中向外（大型会议）", value: "row-center-out" },
];

/* ---------- 人员导入 / 模板 / 布局导入 ---------- */
const { triggerExcelImport, downloadExcelTemplate, triggerLayoutImport } =
  useImportExport();

/* ---------- 画布导出 / 打印 ---------- */
const { exportImage, exportImageAsA4, printCanvas, printCanvasAsA4 } =
  useSeatTablePrint();
/** 上次用过的标题/副标题，弹窗默认带出（空字符串 = 纯画布） */
const lastTitle = ref("");
const lastMeta = ref("");

/* ---------- 业务方法 ---------- */
const handleAutoArrange = () => {
  dialog.warning({
    title: "自动排座",
    content: `将按「${strategyOptions.find((o) => o.value === strategy.value)?.label}」规则重排所有空座位，是否继续？`,
    positiveText: "开始排座",
    negativeText: "取消",
    onPositiveClick: () => {
      const r = store.autoArrange();
      if (r.ok) {
        if ((r as any).reason) {
          message.warning(`已自动排布 ${r.count} 人；${(r as any).reason}`);
        } else {
          message.success(`已自动排布 ${r.count} 人`);
        }
      } else {
        message.warning(r.reason || "排座失败");
      }
    },
  });
};

const handleExportPersons = async () => {
  const data = store.persons.map((p) => ({
    姓名: p.name,
    部门: store.getDeptFullName(p.department),
    级别: store.levelMap.get(p.level)?.name || "",
    职务: p.title,
    状态: p.status === "attending" ? "参会" : "不参会",
    备注: p.remark,
  }));
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "人员列表");
  const buf = write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `人员清单-${store.formatTime(Date.now()).slice(0, 10)}.xlsx`;
  const r = await saveBlob(blob, filename, "导出人员清单");
  if (r.ok) message.success("人员清单已导出");
};

const handleExportLayout = async () => {
  const r = await store.exportLayoutJSON();
  if (r.ok) message.success("布局已导出");
  else if (r.reason && r.reason !== "已取消保存")
    message.error(r.reason || "导出失败");
};

/** 重置画布视图（zoom/pan）+ 等两帧让 DOM 更新
 * 导出/打印都需要"完整、未平移缩放"的画布 */
async function resetCanvasView() {
  store.zoom = 1;
  store.panX = 0;
  store.panY = 0;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

/**
 * 弹标题/副标题设置框
 * - 留空 = 不加标题（只导出/打印画布本身）
 * - 填了 = 套上 A4 版式：标题 + 副标题 + 画布
 * 返回：用户是否点了"确定"、最终标题/副标题
 */
function promptForHeader(): Promise<{
  go: boolean;
  title: string;
  meta: string;
}> {
  return new Promise((resolve) => {
    const t = ref(lastTitle.value);
    const m = ref(lastMeta.value);
    dialog.create({
      title: "设置标题/副标题",
      showIcon: false,
      positiveText: "确定",
      negativeText: "取消",
      content: () =>
        h(
          "div",
          {
            style:
              "display:flex;flex-direction:column;gap:12px;padding-top:4px;",
          },
          [
            h(
              "div",
              null,
              h(NInput, {
                value: t.value,
                "onUpdate:value": (v: string) => (t.value = v),
                placeholder: "标题（留空 = 不加标题，只导出画布）",
                maxlength: 32,
                clearable: true,
              }),
            ),
            h(
              "div",
              null,
              h(NInput, {
                value: m.value,
                "onUpdate:value": (v: string) => (m.value = v),
                placeholder: "副标题 / 时间（可留空）",
                maxlength: 64,
                clearable: true,
              }),
            ),
          ],
        ),
      onPositiveClick: () => {
        lastTitle.value = t.value.trim();
        lastMeta.value = m.value.trim();
        resolve({ go: true, title: lastTitle.value, meta: lastMeta.value });
      },
      onNegativeClick: () => resolve({ go: false, title: "", meta: "" }),
      onClose: () => resolve({ go: false, title: "", meta: "" }),
    });
  });
}

/** 拿到标题 → 决定走 A4 套版还是纯画布 */
function pickExportFns(hasTitle: boolean) {
  if (hasTitle) return { exp: exportImageAsA4, prt: printCanvasAsA4 };
  return { exp: exportImage, prt: printCanvas };
}

const handleExportImage = async () => {
  const { go, title, meta } = await promptForHeader();
  if (!go) return;
  await resetCanvasView();
  const { exp } = pickExportFns(!!title);
  if (title) message.info("正在生成 A4 图片...");
  else message.info("正在生成图片...");
  const r = await exp({ title, meta });
  if (r.ok) message.success(title ? "A4 图片已导出" : "图片已导出");
  else message.error(r.reason || "导出失败");
};

const handlePrint = async () => {
  const { go, title, meta } = await promptForHeader();
  if (!go) return;
  await resetCanvasView();
  const { prt } = pickExportFns(!!title);
  const r = await prt({ title, meta });
  if (!r.ok) message.error(r.reason || "打印失败");
};
</script>

<template>
  <div class="seat-toolbar">
    <div class="toolbar-left">
      <div class="brand-mark">
        <i class="ri-table-2"></i>
        <span class="brand-text">会场排座</span>
      </div>
      <n-divider vertical />
      <n-text depth="3" style="font-size: 12px">
        左键拖拽框选合并 · 鼠标中键拖动平移 · Ctrl+滚轮缩放
      </n-text>
    </div>
    <div class="toolbar-right">
      <n-button quaternary size="small" @click="triggerExcelImport">
        <template #icon><i class="ri-file-excel-2-line"></i></template>
        导入人员
      </n-button>
      <n-button quaternary size="small" @click="handleExportPersons">
        <template #icon><i class="ri-download-2-line"></i></template>
        导出清单
      </n-button>
      <n-button quaternary size="small" @click="downloadExcelTemplate">
        <template #icon><i class="ri-file-download-line"></i></template>
        模板
      </n-button>
      <n-divider vertical />
      <n-button quaternary size="small" @click="handleExportLayout">
        <template #icon><i class="ri-braces-line"></i></template>
        导出布局
      </n-button>
      <n-button quaternary size="small" @click="triggerLayoutImport">
        <template #icon><i class="ri-upload-cloud-2-line"></i></template>
        加载布局
      </n-button>
      <n-button quaternary size="small" @click="handleExportImage">
        <template #icon><i class="ri-image-line"></i></template>
        导出图片
      </n-button>
      <n-button quaternary size="small" @click="handlePrint">
        <template #icon><i class="ri-printer-line"></i></template>
        打印
      </n-button>
      <n-divider vertical />
      <n-select
        v-model:value="strategy"
        :options="strategyOptions"
        size="small"
        style="width: 280px"
      />
      <n-button type="primary" size="small" @click="handleAutoArrange">
        <template #icon><i class="ri-magic-line"></i></template>
        自动排座
      </n-button>
      <n-button quaternary size="small" @click="emit('open-log')">
        <template #icon>
          <n-badge
            :value="swapLogs.length"
            :max="99"
            :show="swapLogs.length > 0"
          >
            <i class="ri-history-line"></i>
          </n-badge>
        </template>
        交换日志
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.seat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.brand-mark {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}
.brand-mark i {
  color: var(--gold);
  font-size: 22px;
}
.brand-text {
  letter-spacing: 2px;
}
</style>
