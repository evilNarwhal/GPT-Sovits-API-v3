import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useGlobalConfig } from "../hooks/useGlobalConfig";
import { useWeights } from "../hooks/useWeights";
import { useSavedConfigs } from "../hooks/useSavedConfigs";

export const VERSION_PRESETS = ["v2", "v2Pro", "v2ProPlus", "v3"];
export const DEFAULT_GPT_MODELS = [
  { name: "不训练直接推v2底模！", path: "不训练直接推v2底模！" },
  { name: "不训练直接推v3底模！", path: "不训练直接推v3底模！" },
];
export const DEFAULT_SOVITS_MODELS = [
  { name: "不训练直接推v2底模！", path: "不训练直接推v2底模！" },
  { name: "不训练直接推v2Pro底模！", path: "不训练直接推v2Pro底模！" },
  { name: "不训练直接推v2ProPlus底模！", path: "不训练直接推v2ProPlus底模！" },
];

// React Context：集中管理全局状态，避免 App.jsx 过度臃肿
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // 全局配置：部署地址 + 版本
  const globalConfig = useGlobalConfig({ defaultVersion: VERSION_PRESETS[0] });
  // 权重列表与选择状态
  const weights = useWeights({
    defaultGptModels: DEFAULT_GPT_MODELS,
    defaultSovitsModels: DEFAULT_SOVITS_MODELS,
  });

  // 保存配置（存到整合包服务端）
  const { savedConfigs, setSavedConfigs, refreshSavedConfigs, saveConfig, deleteConfig } = useSavedConfigs({
    deployUrl: globalConfig.deployUrl,
  });
  // 生成历史（仅前端维护）
  const [history, setHistory] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("gpt_sovits_history");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[history] read failed:", error);
      return [];
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("gpt_sovits_history", JSON.stringify(history));
    } catch (error) {
      console.warn("[history] save failed:", error);
    }
  }, [history]);
  // 目标文本与语种（未来可被外部 API 覆盖）
  const [targetText, setTargetText] = useState("");
  const [targetLang, setTargetLang] = useState("中文");
  const [targetSplitMethod, setTargetSplitMethod] = useState("凑四句一切");

  // useMemo：把所有状态打包成 Context value，避免无意义的重复创建
  const value = useMemo(
    () => ({
      // 全局配置
      ...globalConfig,
      // 权重状态
      ...weights,
      // 业务状态
      savedConfigs,
      setSavedConfigs,
      refreshSavedConfigs,
      saveConfig,
      deleteConfig,
      history,
      setHistory,
      targetText,
      setTargetText,
      targetLang,
      setTargetLang,
      targetSplitMethod,
      setTargetSplitMethod,
    }),
    [
      globalConfig,
      weights,
      savedConfigs,
      history,
      targetText,
      targetLang,
      targetSplitMethod,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  // 自定义 Hook：统一从 Context 取状态
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext 必须在 AppProvider 内使用");
  }
  return context;
}
