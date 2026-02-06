import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ModelList } from "./components/ModelList";
import { LoadConfig } from "./components/LoadConfig";
import { SaveConfig } from "./components/SaveConfig";
import { GeneratePanel } from "./components/GeneratePanel";
import { HistoryList } from "./components/HistoryList";
import { Toaster } from "./components/ui/toaster";
import { useConfigLoader } from "./hooks/useConfigLoader";
import { useAppContext, VERSION_PRESETS } from "./contexts/AppContext";
import { setApiBaseUrl, ttsFast } from "./lib/api";
import { useToast } from "./hooks/use-toast";

function App() {
  // useRef：保存组件实例引用，改变不触发渲染
  const generatePanelRef = useRef(null);
  const saveConfigRef = useRef(null);
  // 当前参考音频路径（不驱动 UI，仅用于保存/历史记录）
  const refAudioRef = useRef("");

  // Context 中的全局状态与操作函数
  const {
    deployUrl,
    setDeployUrl,
    activeVersion,
    setActiveVersion,
    gptModels,
    sovitsModels,
    selectedGpt,
    selectedSovits,
    setSelectedGpt,
    setSelectedSovits,
    weightsLoading,
    weightsError,
    refreshWeights,
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
  } = useAppContext();

  // 本地 UI 状态：加载配置弹窗开关
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [showWeightsError, setShowWeightsError] = useState(false);
  const [outputUrl, setOutputUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (weightsError) setShowWeightsError(true);
  }, [weightsError]);


  // 部署地址变化时，更新 API 基础地址
  useEffect(() => {
    if (deployUrl) setApiBaseUrl(deployUrl);
  }, [deployUrl]);

  // 部署地址变化后重新拉取模型列表
  useEffect(() => {
    if (deployUrl) refreshWeights();
  }, [deployUrl, refreshWeights]);

  // 加载配置的流程控制（先切版本/部署地址，再等权重加载完成）
  const { loadError, requestLoad, clearLoadError } = useConfigLoader({
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
    onApply: (config) => {
      // 成功匹配到权重后，把配置回填到 UI 表单
      const nextRefAudio = config.refAudio || "";
      refAudioRef.current = nextRefAudio;
      saveConfigRef.current?.setConfig(config);
      setTargetText(config.text || "");
      setTargetLang(config.textLang || "中文");
      setTargetSplitMethod(config.textSplitMethod || "凑四句一切");
      setIsLoadOpen(false);
      clearLoadError();
      toast({ title: "配置加载成功" });
    },
  });

  useEffect(() => {
    if (loadError) {
      toast({ title: "配置加载失败", description: loadError, variant: "destructive" });
    }
  }, [loadError, toast]);

  // 保存配置：从 SaveConfig 收集参数，组装成可持久化对象
  const handleSaveConfig = async ({
    name,
    characterName,
    refAudio,
    refAudioUrl,
    refEmotion,
    promptText,
    promptLang,
    refTextFree,
    text,
    textLang,
    textSplitMethod,
    topK,
    topP,
    temperature,
    repetitionPenalty,
    speedFactor,
    fragmentInterval,
    batchSize,
    splitBucket,
    parallelInfer,
    seed,
    keepRandom,
    gpt,
    sovits,
    deployUrl: savedDeployUrl,
    version,
  }) => {
    const trimmedName = (name || "").trim();
    if (!trimmedName || !gpt || !sovits) return false;
    // 统一数据结构，后续“加载配置”按这个结构恢复
    const payload = {
      name: trimmedName,
      characterName: characterName || "",
      gpt: {
        name: gpt?.name,
        path: gpt?.path,
      },
      sovits: {
        name: sovits?.name,
        path: sovits?.path,
      },
      deployUrl: savedDeployUrl || deployUrl,
      version: version || activeVersion,
      refAudio: refAudio || "",
      refAudioUrl: refAudioUrl || "",
      refEmotion: refEmotion || "",
      promptText: promptText || "",
      promptLang: promptLang || "中文",
      refTextFree: Boolean(refTextFree),
      text: text || "",
      textLang: textLang || "中文",
      textSplitMethod: textSplitMethod || "凑四句一切",
      topK,
      topP,
      temperature,
      repetitionPenalty,
      speedFactor,
      fragmentInterval,
      batchSize,
      splitBucket,
      parallelInfer,
      seed,
      keepRandom,
    };
    // 用名称做去重，新的配置置顶
    // 写入 Supabase，并刷新列表
    const saved = await saveConfig?.(payload);
    if (!saved) return false;
    // 记录参考音频给“生成历史”使用
    refAudioRef.current = refAudio || "";
    return true;
  };

  // 生成语音：目前只记录到前端历史，不调用后端
  const handleGenerate = async (inputText) => {
    const trimmedText = (inputText || "").trim();
    if (!trimmedText) return;
    if (!selectedGpt || !selectedSovits) return;
    const params = saveConfigRef.current?.getInferenceParams?.() || {};
    const refAudioUrl = params.refAudioUrl || "";
    const refAudioTempUrl = params.refAudioTempUrl || "";
    if (!refAudioUrl && !refAudioTempUrl) {
      toast({ title: "请先上传参考音频", variant: "destructive" });
      return;
    }
    const record = {
      id: `task-${Date.now()}`,
      text: trimmedText,
      gpt: `${selectedGpt?.name || ""}`,
      sovits: `${selectedSovits?.name || ""}`,
      refAudio: refAudioRef.current,
      version: activeVersion,
      status: "generated",
    };
    try {
      const payload = {
        prompt_text: params.promptText || "",
        prompt_lang: params.promptLang || "中文",
        text: trimmedText,
        text_lang: targetLang || "中文",
        text_split_method: targetSplitMethod || "凑四句一切",
        top_k: params.topK ?? 20,
        top_p: params.topP ?? 0.6,
        temperature: params.temperature ?? 0.6,
        ref_text_free: Boolean(params.refTextFree),
        speed_factor: params.speedFactor ?? 1,
        batch_size: params.batchSize ?? 20,
        split_bucket: params.splitBucket ?? true,
        fragment_interval: params.fragmentInterval ?? 0.3,
        seed: params.seed ?? -1,
        keep_random: Boolean(params.keepRandom ?? true),
        parallel_infer: Boolean(params.parallelInfer ?? true),
        repetition_penalty: params.repetitionPenalty ?? 1.35,
      };

      const result = await ttsFast({
        ...payload,
        ref_audio_path: refAudioUrl || refAudioTempUrl,
      });
      setOutputUrl(result.url);
      const audioFileName = `tts_${Date.now()}.wav`;
      let savedAudioPath = "";
      if (window.fileAPI?.saveGeneratedAudio) {
        try {
          const buffer = await result.blob.arrayBuffer();
          savedAudioPath = await window.fileAPI.saveGeneratedAudio(buffer, audioFileName);
        } catch (err) {
          console.warn("[save-generated-audio] failed:", err);
        }
      }
      // 传入函数获取上一次的state，并将新纪录插入到旧纪录上方
      const fallbackSeed =
        Number.isFinite(payload.seed) && payload.seed >= 0 ? payload.seed : null;
      const displaySeed = Number.isFinite(result.seed) ? result.seed : fallbackSeed;
      setHistory((prev) => [
        {
          ...record,
          status: "success",
          seed: displaySeed,
          audioUrl: result.url,
          audioPath: savedAudioPath,
          audioFileName,
        },
        ...prev,
      ]);
      toast({ title: "语音生成成功", variant: "success" });
    } catch (error) {
      setHistory((prev) => [{ ...record, status: "failed" }, ...prev]);
      toast({
        title: "生成失败",
        description: error || "请检查 API 服务",
        variant: "destructive",
      });
    }
  };

  // 顶部按钮触发生成：调用子组件暴露的方法
  const handleHeaderGenerate = () => {
    generatePanelRef.current?.triggerGenerate();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">GPT-SoVITS 控制台</h1>
            <p className="text-sm text-slate-500">选择模型 · 生成语音 · 保存模型配置</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refreshWeights()}>
              刷新模型
            </Button>
            <Button onClick={handleHeaderGenerate}>生成语音</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {showWeightsError && weightsError ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border bg-white p-4 shadow-lg">
              <div className="text-base font-semibold text-slate-900">模型列表加载失败</div>
              <div className="mt-2 text-sm text-slate-600">{weightsError}</div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowWeightsError(false)}>
                  关闭
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {/* 根路径 & 版本切换区域 */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1 space-y-1">
              <label className="text-sm font-medium text-slate-700">整合包部署地址</label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="例如：http://localhost"
                  value={deployUrl === "http://localhost" ? "本地" : deployUrl}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (!value) {
                      setDeployUrl("");
                      return;
                    }
                    if (value === "本地") {
                      setDeployUrl("http://localhost");
                      return;
                    }
                    setDeployUrl(value);
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">填写运行中的 API 地址</p>
            </div>

            <div className="min-w-[200px] space-y-1">
              <label className="text-sm font-medium text-slate-700">切换版本</label>
              {/* 受控组件：value 由 state 控制，onChange 同步更新 */}
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={activeVersion}
                onChange={(e) => setActiveVersion(e.target.value)}
              >
                {VERSION_PRESETS.map((ver) => (
                  <option key={ver} value={ver}>
                    {ver}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">使用的模型版本，切换版本需要重启服务</p>
            </div>

          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 权重列表（选择 GPT / SoVITS 模型） */}
          <ModelList
            title="GPT 权重"
            description="选择 GPT_weights 模型"
            models={gptModels}
            selectedModel={selectedGpt}
            onSelect={(model) => setSelectedGpt(model)}
            onImport={() => {
              /* TODO: 打开文件选择器或调用导入接口 */
            }}
          />
          <ModelList
            title="SoVITS 权重"
            description="选择 SoVITS_weights 模型"
            models={sovitsModels}
            selectedModel={selectedSovits}
            onSelect={(model) => setSelectedSovits(model)}
            onImport={() => {
              /* TODO: 打开文件选择器或调用导入接口 */
            }}
          />

          <div className="lg:col-span-2">
            {/* 保存配置面板：内部会调用 onSave / onOpenLoad */}
            <SaveConfig
              ref={saveConfigRef}
              onSave={handleSaveConfig}
              onOpenLoad={() => {
                refreshSavedConfigs?.();
                setIsLoadOpen(true);
              }}
              selectedGpt={selectedGpt}
              selectedSovits={selectedSovits}
              activeVersion={activeVersion}
              deployUrl={deployUrl}
              targetText={targetText}
              targetLang={targetLang}
              targetSplitMethod={targetSplitMethod}
            />
          </div>

          <div className="lg:col-span-2">
            {/* 生成面板：文本/语种为受控输入，可被外部覆盖 */}
            <GeneratePanel
              ref={generatePanelRef}
              selectedModel={{
                name: `${selectedGpt?.name || "未选择"} & ${selectedSovits?.name || "未选择"}`,
                sampleRate: activeVersion,
                speakers: "",
              }}
              outputUrl={outputUrl}
              text={targetText}
              onTextChange={setTargetText}
              textLang={targetLang}
              onTextLangChange={setTargetLang}
              textSplitMethod={targetSplitMethod}
              onTextSplitMethodChange={setTargetSplitMethod}
              onGenerate={handleGenerate}
            />
          </div>

          <div className="lg:col-span-2">
            {/* 生成历史列表 */}
            <HistoryList history={history} />
          </div>
        </div>

        {/* 加载配置弹窗 */}
        <LoadConfig
          open={isLoadOpen}
          onOpenChange={(value) => {
            setIsLoadOpen(value);
            if (!value) clearLoadError();
          }}
          configs={savedConfigs}
          onLoad={requestLoad}
          errorMessage={loadError}
          onDelete={(id) => deleteConfig?.(id)}
        />
      </main>
      <Toaster />
    </div>
  );
}

export default App;
