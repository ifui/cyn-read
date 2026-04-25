import { ref } from "vue";

export interface ProgressItem {
  id: string;
  title: string;
  current: number;
  total: number;
  currentFile: string;
  status: "processing" | "completed" | "error";
  createdAt: number;
}

const progressItems = ref<ProgressItem[]>([]);

let progressIdCounter = 0;

export function useProgress() {
  const generateId = () => {
    progressIdCounter++;
    return `progress-${Date.now()}-${progressIdCounter}`;
  };

  const show = (title: string, total: number): string => {
    const id = generateId();
    const item: ProgressItem = {
      id,
      title,
      current: 0,
      total,
      currentFile: "",
      status: "processing",
      createdAt: Date.now(),
    };
    progressItems.value.push(item);
    return id;
  };

  const update = (id: string, current: number, total: number, currentFile: string) => {
    const item = progressItems.value.find((p) => p.id === id);
    if (item) {
      item.current = current;
      item.total = total;
      item.currentFile = currentFile;
    }
  };

  const complete = (id: string) => {
    const item = progressItems.value.find((p) => p.id === id);
    if (item) {
      item.status = "completed";
      item.current = item.total;
      setTimeout(() => {
        hide(id);
      }, 1500);
    }
  };

  const error = (id: string) => {
    const item = progressItems.value.find((p) => p.id === id);
    if (item) {
      item.status = "error";
      setTimeout(() => {
        hide(id);
      }, 2500);
    }
  };

  const hide = (id: string) => {
    const index = progressItems.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      progressItems.value.splice(index, 1);
    }
  };

  const hideAll = () => {
    progressItems.value = [];
  };

  return {
    progressItems,
    show,
    update,
    complete,
    error,
    hide,
    hideAll,
  };
}
