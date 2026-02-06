import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./contexts/AppContext.jsx";

// React 入口：把整个应用挂载到 #root
// AppProvider 提供全局状态（根路径、权重、保存配置等）
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
