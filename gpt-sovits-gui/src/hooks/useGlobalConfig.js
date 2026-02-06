import { useEffect, useRef, useState } from "react";

export function useGlobalConfig({ defaultVersion }) {
  // window.fileAPI 由桌面端预加载脚本注入，用于读写本地配置文件
  const fileAPI = window.fileAPI;
  // useState：用于保存并触发 UI 更新
  const [deployUrl, setDeployUrl] = useState("http://localhost");
  const [activeVersion, setActiveVersion] = useState(defaultVersion);
  const [isConfigReady, setIsConfigReady] = useState(false);
  // useRef：保存“是否已读过配置”的状态，但变化不会触发重渲染
  const hasLoadedConfigRef = useRef(false);

  // useEffect：组件首次挂载时读取本地配置
  useEffect(() => {
    const loadGlobalConfig = async () => {
      if (!fileAPI?.loadGlobalConfig) {
        setIsConfigReady(true);
        return;
      }
      try {
        const config = await fileAPI.loadGlobalConfig();
        if (config?.deployUrl) setDeployUrl(config.deployUrl);
        if (config?.activeVersion) setActiveVersion(config.activeVersion);
      } catch (error) {
        console.error("读取本地配置失败", error);
      } finally {
        setIsConfigReady(true);
      }
    };
    loadGlobalConfig();
  }, [fileAPI]);

  // useEffect：deployUrl 或 activeVersion 改变后写回本地配置
  useEffect(() => {
    const persistGlobalConfig = async () => {
      if (!fileAPI?.saveGlobalConfig) return;
      try {
        await fileAPI.saveGlobalConfig({ deployUrl, activeVersion });
      } catch (error) {
        console.error("写入本地配置失败", error);
      }
    };

    if (!isConfigReady) return;
    if (!hasLoadedConfigRef.current) {
      hasLoadedConfigRef.current = true;
      return;
    }
    persistGlobalConfig();
  }, [deployUrl, activeVersion, isConfigReady, fileAPI]);

  return {
    // 返回值供组件使用（自定义 Hook 的“对外接口”）
    deployUrl,
    setDeployUrl,
    activeVersion,
    setActiveVersion,
    isConfigReady,
  };
}
