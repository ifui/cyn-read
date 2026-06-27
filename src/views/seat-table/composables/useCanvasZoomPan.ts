/**
 * 画布缩放/平移的鼠标交互 composable
 */
import { onMounted, onUnmounted } from "vue";
import { useSeatTableStore } from "../store";
import { ZOOM_STEP } from "../constants";

export function useCanvasZoomPan() {
  const store = useSeatTableStore();
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  /** 外部传入：进入/退出平移模式时的回调（用于顶部状态指示） */
  let onPanStart: () => void = () => {};
  let onPanEnd: () => void = () => {};

  const bindPanCallbacks = (start: () => void, end: () => void) => {
    onPanStart = start;
    onPanEnd = end;
  };

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      store.setZoom(store.zoom + ZOOM_STEP, e.clientX, e.clientY);
    } else {
      store.setZoom(store.zoom - ZOOM_STEP, e.clientX, e.clientY);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    // 仅中键（button 1）触发平移
    if (e.button !== 1) return;
    e.preventDefault();
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    document.body.style.cursor = "grabbing";
    onPanStart();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    store.pan(dx, dy);
  };

  const onMouseUp = () => {
    if (isPanning) {
      isPanning = false;
      document.body.style.cursor = "";
      onPanEnd();
    }
  };

  onMounted(() => {
    window.addEventListener("mouseup", onMouseUp);
  });
  onUnmounted(() => {
    window.removeEventListener("mouseup", onMouseUp);
  });

  return {
    onWheel,
    onMouseDown,
    onMouseMove,
    bindPanCallbacks,
  };
}
