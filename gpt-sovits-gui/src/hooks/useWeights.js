import { useCallback, useEffect, useRef, useState } from "react";
import { changeChoices } from "../lib/api";
import { useToast } from "./use-toast";

export function useWeights({ defaultGptModels = [], defaultSovitsModels = [] }) {
  // 模型列表与当前选择
  const [gptModels, setGptModels] = useState(defaultGptModels);
  const [sovitsModels, setSovitsModels] = useState(defaultSovitsModels);
  const [selectedGpt, setSelectedGpt] = useState(null);
  const [selectedSovits, setSelectedSovits] = useState(null);
  // 权重加载状态
  const [weightsLoading, setWeightsLoading] = useState(false);
  const [weightsError, setWeightsError] = useState("");
  const { toast } = useToast();
  const hasLoadedRef = useRef(false);

  // useCallback：避免函数在每次渲染时都重建，减少 useEffect 触发
  const refreshWeights = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      // 改为调用后端 API 获取模型列表
      setWeightsLoading(true);
      setWeightsError("");

      try {
        const data = await changeChoices();
        const sovitsChoices = Array.isArray(data?.[0])
          ? data[0]
          : data?.sovits_choices || data?.sovitsChoices || [];
        const gptChoices = Array.isArray(data?.[1])
          ? data[1]
          : data?.gpt_choices || data?.gptChoices || [];
        // 倒序展示
        const gptList = gptChoices
          .map((path) => {
            const name = path.slice(path.indexOf("/") + 1);
            return { name, path };
          })
          .reverse();
        const sovitsList = sovitsChoices
          .map((path) => {
            const name = path.slice(path.indexOf("/") + 1);
            return { name, path };
          })
          .reverse();

        // 按读取到的权重刷新列表，并尽量保留已选中项
        if (gptList.length) {
          setGptModels(gptList);
          setSelectedGpt((prev) => gptList.find((m) => m.path === prev?.path) || null);
        } else {
          setGptModels([]);
          setSelectedGpt(null);
        }

        if (sovitsList.length) {
          setSovitsModels(sovitsList);
          setSelectedSovits((prev) => sovitsList.find((m) => m.path === prev?.path) || null);
        } else {
          setSovitsModels([]);
          setSelectedSovits(null);
        }

        if (!silent) {
          toast({ title: "模型列表已更新", variant: "success" });
        }
      } catch (error) {
        console.error("获取模型列表失败", error);
        setWeightsError("模型列表获取失败，请检查 API 服务。");
        setGptModels([]);
        setSovitsModels([]);
        setSelectedGpt(null);
        setSelectedSovits(null);
        if (!silent) {
          toast({
            title: "模型列表获取失败",
            description: "请检查 API 服务",
            variant: "destructive",
          });
        }
      } finally {
        setWeightsLoading(false);
      }
    },
    [toast],
  );

  // 首次挂载时自动刷新模型列表（静默）
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      refreshWeights({ silent: true });
      return;
    }
    refreshWeights();
  }, [refreshWeights]);

  return {
    // 返回权重相关状态与操作函数，供 Context/App 使用
    gptModels,
    sovitsModels,
    selectedGpt,
    selectedSovits,
    setSelectedGpt,
    setSelectedSovits,
    weightsLoading,
    weightsError,
    refreshWeights,
  };
}
