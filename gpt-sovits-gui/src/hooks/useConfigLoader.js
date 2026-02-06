import { useEffect, useState } from "react";

export function useConfigLoader({
  activeVersion,
  deployUrl,
  setActiveVersion,
  setDeployUrl,
  gptModels,
  sovitsModels,
  setSelectedGpt,
  setSelectedSovits,
  weightsLoading,
  weightsError,
  onApply,
}) {
  // 待加载的配置（点击“加载配置”后先放这里，等权重加载完成再应用）
  const [pendingConfig, setPendingConfig] = useState(null);
  // 弹窗内的错误提示
  const [loadError, setLoadError] = useState("");

  // 触发加载：先更新版本/部署地址，再等待权重刷新
  const requestLoad = (config) => {
    setLoadError("");
    setPendingConfig(config);
    if (config?.version) setActiveVersion(config.version);
    if (config?.deployUrl) setDeployUrl(config.deployUrl);
  };

  // 清空弹窗错误提示
  const clearLoadError = () => setLoadError("");

  // 当版本/路径与权重列表就绪时，进行模型匹配并应用配置
  useEffect(() => {
    if (!pendingConfig) return;
    if (pendingConfig.version && pendingConfig.version !== activeVersion) return;
    if (pendingConfig.deployUrl && pendingConfig.deployUrl !== deployUrl) return;
    if (weightsLoading) return;

    if (weightsError) {
      setLoadError(weightsError);
      setPendingConfig(null);
      return;
    }

    // 通过名称匹配权重（配置里只存 name/path）
    const gptMatch = pendingConfig.gpt
      ? gptModels.find((m) => m.name === pendingConfig.gpt.name)
      : null;
    const sovitsMatch = pendingConfig.sovits
      ? sovitsModels.find((m) => m.name === pendingConfig.sovits.name)
      : null;

    // 根路径有值但列表为空，提示路径错误或权重不存在
    if (gptModels.length === 0 && sovitsModels.length === 0) {
      setSelectedGpt(null);
      setSelectedSovits(null);
      setLoadError("模型列表为空");
      setPendingConfig(null);
      return;
    }

    // 目标权重找不到时给出明确提示
    if ((pendingConfig.gpt && !gptMatch) || (pendingConfig.sovits && !sovitsMatch)) {
      setSelectedGpt(null);
      setSelectedSovits(null);
      setLoadError("模型未找到，请检查权重是否存在。");
      setPendingConfig(null);
      return;
    }

    // 找到匹配模型后，更新当前选中的权重
    if (gptMatch) {
      setSelectedGpt({ ...gptMatch, path: pendingConfig.gpt?.path || gptMatch.path });
    }
    if (sovitsMatch) {
      setSelectedSovits({ ...sovitsMatch, path: pendingConfig.sovits?.path || sovitsMatch.path });
    }

    // onApply 由调用方传入，用于把配置同步到 UI/表单
    onApply?.(pendingConfig);
    setPendingConfig(null);
  }, [
    pendingConfig,
    activeVersion,
    deployUrl,
    gptModels,
    sovitsModels,
    setSelectedGpt,
    setSelectedSovits,
    weightsLoading,
    weightsError,
    onApply,
  ]);

  return { loadError, requestLoad, clearLoadError };
}
