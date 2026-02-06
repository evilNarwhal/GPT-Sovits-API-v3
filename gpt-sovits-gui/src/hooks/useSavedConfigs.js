import { useCallback, useEffect, useState } from "react";
import {
  deleteSupabaseConfig,
  loadSupabaseConfigs,
  saveSupabaseConfigs,
} from "../lib/supabase-configs";
import { useToast } from "./use-toast";

export function useSavedConfigs({ deployUrl } = {}) {
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [isSavedConfigsReady, setIsSavedConfigsReady] = useState(false);
  const { toast } = useToast();

  const loadFromSupabase = async () => {
    const list = await loadSupabaseConfigs();
    return Array.isArray(list) ? list : [];
  };

  const refreshSavedConfigs = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      setIsSavedConfigsReady(false);
      try {
        const list = await loadFromSupabase();
        setSavedConfigs(list);
      } catch (error) {
        console.error("读取保存配置失败", error);
        if (!silent) {
          toast({
            title: "配置读取失败",
            description: "请检查 Supabase 连接",
            variant: "destructive",
          });
        }
      } finally {
        setIsSavedConfigsReady(true);
      }
    },
    [toast],
  );

  useEffect(() => {
    refreshSavedConfigs({ silent: true });
  }, [deployUrl, refreshSavedConfigs]);

  const saveConfig = async (config) => {
    try {
      await saveSupabaseConfigs([config]);
      await refreshSavedConfigs({ silent: true });
      return true;
    } catch (error) {
      console.error("写入保存配置失败", error);
      toast({
        title: "配置保存失败",
        description: error?.message || "请检查 Supabase 权限或网络",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteConfig = async (id) => {
    if (!id) return;
    try {
      await deleteSupabaseConfig(id);
      setSavedConfigs((prev) => prev.filter((item) => item.id !== id));
      toast({ title: "配置已删除", variant: "success" });
    } catch (error) {
      console.error("删除配置失败", error);
      toast({
        title: "删除失败",
        description: error?.message || "请稍后重试",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    savedConfigs,
    setSavedConfigs,
    isSavedConfigsReady,
    refreshSavedConfigs,
    saveConfig,
    deleteConfig,
  };
}
