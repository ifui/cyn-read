import { createMemoryHistory, createRouter } from "vue-router";

import Home from "../views/home/index.vue";
import AboutView from "../views/about/index.vue";
import DocumentsView from "../views/documents/index.vue";
import SettingsView from "../views/settings/index.vue";
import OcrView from "../views/ocr/index.vue";
import PdfEditorView from "../views/pdf-editor/index.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/about", component: AboutView },
  { path: "/documents", component: DocumentsView },
  { path: "/settings", component: SettingsView },
  { path: "/ocr", component: OcrView },
  { path: "/pdf-editor", component: PdfEditorView },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
