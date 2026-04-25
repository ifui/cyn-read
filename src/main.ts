import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import naive from "naive-ui";
import "./assets/main.css";
import "remixicon/fonts/remixicon.css";
import router from "./routes/index.ts";

const app = createApp(App);

// 注册 Pinia
const pinia = createPinia();
app.use(pinia);

// 注册路由
app.use(router);

// 注册 Naive UI
app.use(naive);

app.mount("#app");
