import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { RangeField } from "./ui/range-field";
import { TooltipIcon } from "./ui/tooltip-icon";
import { WaveformWavesurfer } from "./ui/waveform-wavesurfer";
import { useNumberInput } from "../hooks/useNumberInput";
import { uploadRefAudio, promoteRefAudio, asrRecognize } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { loadSupabaseCharacters } from "../lib/supabase-configs";

const LANGUAGE_OPTIONS = [
  "中文",
  "英文",
  "日文",
  "粤语",
  "韩文"
];

const ASR_LANG_MAP = {
  中文: "zh",
  英文: "en",
  日文: "ja",
  韩文: "ko",
  粤语: "yue",
};

const EMOTION_OPTIONS = [
  "平静",
  "开心",
  "愉悦",
  "兴奋",
  "温柔",
  "悲伤",
  "沮丧",
  "生气",
  "紧张",
  "冷淡",
  "严肃",
  "自然",
  "撒娇",
  "沉稳",
  "活泼",
];

const CUSTOM_CHARACTER_VALUE = "__custom__";

// 表单默认值：用于初始化与加载配置回填
const DEFAULTS = {
  promptLang: "中文",
  topK: 20,
  topP: 0.6,
  temperature: 0.6,
  refTextFree: false,
  speedFactor: 1.0,
  batchSize: 10,
  splitBucket: true,
  fragmentInterval: 0.3,
  seed: -1,
  keepRandom: true,
  parallelInfer: true,
  repetitionPenalty: 1.35,
};

// 通用样式：避免在 JSX 中重复书写 className
const selectClass =
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
const textareaClass =
  "min-h-[120px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

// forwardRef：让父组件可以拿到 ref，从而调用子组件暴露的方法
export const SaveConfig = forwardRef(function SaveConfig(
  {
    onSave,
    onOpenLoad,
    selectedGpt,
    selectedSovits,
    activeVersion,
    deployUrl,
    targetText,
    targetLang,
    targetSplitMethod,
  },
  ref
) {
  // 基础信息（useState 返回 [当前值, 更新函数]）
  const [configName, setConfigName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [characterOptions, setCharacterOptions] = useState([]);
  const [isCustomCharacter, setIsCustomCharacter] = useState(false);
  const [refEmotion, setRefEmotion] = useState("");

  // 参考音频文件名（仅用于展示/保存，不参与推理）
  const [refAudio, setRefAudio] = useState("");
  // 保存配置后得到的音频 URL（用于跨设备/部署场景）
  const [refAudioUrl, setRefAudioUrl] = useState("");
  const [toTextAudio, setToTextAudio] = useState(null);
  // 临时上传后的文件标识（保存配置时用于转正）
  const [refAudioTempName, setRefAudioTempName] = useState("");
  const [refAudioTempUrl, setRefAudioTempUrl] = useState("");
  // 上传参考音频的状态，用于按钮禁用/文案提示
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  // 是否正在生成参考文本
  const [isExtractingRefText, setIsExtractingRefText] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [promptLang, setPromptLang] = useState(DEFAULTS.promptLang);
  const [refTextFree, setRefTextFree] = useState(DEFAULTS.refTextFree);

  // 采样与推理参数
  const topKField = useNumberInput(DEFAULTS.topK, { min: 1, max: 100 });
  const topPField = useNumberInput(DEFAULTS.topP, { min: 0, max: 1 });
  const temperatureField = useNumberInput(DEFAULTS.temperature, { min: 0, max: 1 });
  const repetitionPenaltyField = useNumberInput(DEFAULTS.repetitionPenalty, { min: 0, max: 2 });
  const speedFactorField = useNumberInput(DEFAULTS.speedFactor, { min: 0.6, max: 1.65 });
  const fragmentIntervalField = useNumberInput(DEFAULTS.fragmentInterval, { min: 0.01, max: 1 });
  const batchSizeField = useNumberInput(DEFAULTS.batchSize, { min: 1, max: 200 });
  const seedField = useNumberInput(DEFAULTS.seed, { min: -1, max: 4294967295 });
  const [splitBucket, setSplitBucket] = useState(DEFAULTS.splitBucket);
  const [parallelInfer, setParallelInfer] = useState(DEFAULTS.parallelInfer);
  const [keepRandom, setKeepRandom] = useState(DEFAULTS.keepRandom);

  // 当前用于波形预览/播放的音频地址（blob 或临时 URL）
  const [previewAudioUrl, setPreviewAudioUrl] = useState("");
  // 指向输入框上传的音频
  const refAudioInputRef = useRef(null);
  const { toast } = useToast();
  // 保存上一次生成的预览 URL，用于切换新音频时释放内存，避免泄漏
  const previewAudioUrlRef = useRef("");
  const [isDragging, setIsDragging] = useState(false);


  // useImperativeHandle：显式对外暴露方法，父组件可通过 ref 调用
  useImperativeHandle(ref, () => ({
    // 批量回填配置（用于“加载配置”后恢复表单）
    setConfig: (config = {}) => {
      setConfigName(config.name || "");
      setCharacterName(config.characterName || "");
      setRefEmotion(config.refEmotion || "");
      setRefAudio(config.refAudio || "");
      setRefAudioUrl(config.refAudioUrl || "");
      setRefAudioTempName("");
      setRefAudioTempUrl("");
      setToTextAudio(null);
      setPreviewAudioUrl(config.refAudioUrl || "");
      setPromptText(config.promptText || "");
      setPromptLang(config.promptLang || DEFAULTS.promptLang);
      setRefTextFree(Boolean(config.refTextFree));
      topKField.setValue(config.topK ?? DEFAULTS.topK);
      topPField.setValue(config.topP ?? DEFAULTS.topP);
      temperatureField.setValue(config.temperature ?? DEFAULTS.temperature);
      repetitionPenaltyField.setValue(config.repetitionPenalty ?? DEFAULTS.repetitionPenalty);
      speedFactorField.setValue(config.speedFactor ?? DEFAULTS.speedFactor);
      fragmentIntervalField.setValue(config.fragmentInterval ?? DEFAULTS.fragmentInterval);
      batchSizeField.setValue(config.batchSize ?? DEFAULTS.batchSize);
      setSplitBucket(config.splitBucket ?? DEFAULTS.splitBucket);
      setParallelInfer(config.parallelInfer ?? DEFAULTS.parallelInfer);
      seedField.setValue(config.seed ?? DEFAULTS.seed);
      setKeepRandom(config.keepRandom ?? DEFAULTS.keepRandom);
    },
    // 单独回填参考音频
    setRefAudio: (value = "") => setRefAudio(value || ""),
    // 单独回填参考感情
    setRefEmotion: (value = "") => setRefEmotion(value || ""),
    // 获取推理需要的运行时参数（不落库）
    getInferenceParams: () => ({
      refAudioUrl,
      refAudioTempUrl,
      promptText,
      promptLang,
      refTextFree,
      topK: topKField.value,
      topP: topPField.value,
      temperature: temperatureField.value,
      repetitionPenalty: repetitionPenaltyField.value,
      speedFactor: speedFactorField.value,
      fragmentInterval: fragmentIntervalField.value,
      batchSize: batchSizeField.value,
      splitBucket,
      parallelInfer,
      seed: seedField.value,
      keepRandom,
    }),
  }));

  // 保存配置：把当前表单打包成 payload 交给父组件持久化
  const handleSave = async () => {
    let nextRefAudioUrl = refAudioUrl || "";
    if (!nextRefAudioUrl && !refAudioTempName) {
      toast({ title: "请先上传参考音频后再保存配置", variant: "destructive" });
      return;
    }
    if (!nextRefAudioUrl && refAudioTempName) {
      try {
        setIsUploadingRef(true);
        const result = await promoteRefAudio(refAudioTempName);
        nextRefAudioUrl = result?.url || "";
      if (!nextRefAudioUrl) throw new Error("empty promote url");
      setRefAudioUrl(nextRefAudioUrl);
      setRefAudioTempName("");
      setRefAudioTempUrl("");
      setPreviewAudioUrl(nextRefAudioUrl);
      toast({ title: "参考音频已转存", variant: "success" });
      } catch (error) {
        toast({ title: "参考音频转存失败，请重试", variant: "destructive" });
        return;
      } finally {
        setIsUploadingRef(false);
      }
    }

    const payload = {
      name: configName,
      characterName: characterName?.trim() ? characterName.trim() : null,
      refAudio,
      refAudioUrl: nextRefAudioUrl,
      refEmotion,
      promptText,
      promptLang,
      refTextFree,
      text: targetText || "",
      textLang: targetLang || "中文",
      textSplitMethod: targetSplitMethod || "凑四句一切",
      topK: topKField.value,
      topP: topPField.value,
      temperature: temperatureField.value,
      repetitionPenalty: repetitionPenaltyField.value,
      speedFactor: speedFactorField.value,
      fragmentInterval: fragmentIntervalField.value,
      batchSize: batchSizeField.value,
      splitBucket,
      parallelInfer,
      seed: seedField.value,
      keepRandom,
      gpt: selectedGpt,
      sovits: selectedSovits,
      deployUrl,
      version: activeVersion,
    };
    try {
      const saved = await onSave?.(payload);
      if (saved) {
        const cleanedCharacter = (characterName || "").trim();
        if (
          cleanedCharacter &&
          !characterOptions.some((item) => item.name === cleanedCharacter)
        ) {
          setCharacterOptions((prev) => [
            { id: `local-${Date.now()}`, name: cleanedCharacter },
            ...prev,
          ]);
          setIsCustomCharacter(false);
        }
        toast({ title: "配置保存成功" });
      } else {
        toast({ title: "配置保存失败，请检查必填项", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "配置保存失败",
        description: error?.message || "请稍后重试",
        variant: "destructive",
      });
    }
    setIsUploadingRef(false);
  };

  // 点击“选择”按钮时，触发隐藏的文件选择器
  const handleRefAudioPick = () => {
    refAudioInputRef.current?.click();
  };

  // 文件选择回调：读取路径并回填到输入框
  const handleRefAudioFile = async (file) => {
    if (!file) return;
    setToTextAudio(file);
    if (previewAudioUrlRef.current) URL.revokeObjectURL(previewAudioUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    previewAudioUrlRef.current = localUrl;
    setPreviewAudioUrl(localUrl);
    setRefAudio(file.name || "");
    try {
      setIsUploadingRef(true);
      const result = await uploadRefAudio(file);
      const nextTempUrl = result?.temp_url || "";
      const nextTempName = result?.temp_name || "";
      setRefAudioTempUrl(nextTempUrl);
      setRefAudioTempName(nextTempName);
      setRefAudioUrl("");
      if (nextTempUrl) setPreviewAudioUrl(nextTempUrl);
      toast({ title: "参考音频上传成功", variant: "success" });
    } catch (error) {
      toast({ title: "参考音频上传失败", variant: "destructive" });
      setRefAudioTempUrl("");
      setRefAudioTempName("");
      setRefAudioUrl("");
    } finally {
      setIsUploadingRef(false);
    }
  };

  const handleRefAudioFileChange = async (event) => {
    const file = event.target.files?.[0];
    await handleRefAudioFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    await handleRefAudioFile(file);
  };

  const getAsrLang = (lang) => ASR_LANG_MAP[lang] || "auto";

  const buildFileFromUrl = async (url, fallbackName) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("获取参考音频失败");
    }
    const blob = await response.blob();
    const name = fallbackName || "ref_audio.wav";
    return new File([blob], name, { type: blob.type || "audio/wav" });
  };

  const handleAutoExtractPrompt = async () => {
    try {
      setIsExtractingRefText(true);
      let fileToSend = toTextAudio;
      if (!fileToSend) {
        const url = refAudioUrl || refAudioTempUrl;
      if (!url) {
        toast({ title: "请先上传参考音频", variant: "destructive" });
        return;
      }
        fileToSend = await buildFileFromUrl(url, refAudio || "ref_audio.wav");
      }
      const result = await asrRecognize(fileToSend, {
        asrLang: getAsrLang(promptLang),
      });
      const text = (result?.items || [])
        .map((item) => item?.text || "")
        .join("")
        .trim();
      if (!text) {
        toast({ title: "未识别到文本，请更换参考音频", variant: "destructive" });
        return;
      }
      setPromptText(text);
      toast({ title: "参考文本提取成功" });
    } catch (error) {
      toast({
        title: "自动提取失败",
        description: error?.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsExtractingRefText(false);
    }
  };

  // useEffect：组件卸载时释放 blob URL
  useEffect(() => {
    return () => {
      if (previewAudioUrlRef.current) URL.revokeObjectURL(previewAudioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCharacters = async () => {
      try {
        const list = await loadSupabaseCharacters();
        if (!mounted) return;
        setCharacterOptions(list);
      } catch (error) {
        console.warn("[characters] load failed:", error);
        toast({
          title: "人物列表获取失败",
          description: "请检查 Supabase 连接",
          variant: "warning",
        });
        if (mounted) setCharacterOptions([]);
      }
    };
    loadCharacters();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!characterName) {
      setIsCustomCharacter(false);
      return;
    }
    const exists = characterOptions.some((item) => item.name === characterName);
    setIsCustomCharacter(!exists);
  }, [characterName, characterOptions]);
  // 保存按钮禁用条件：配置名为空或未选择模型
  const isSaveDisabled =
    !configName.trim() ||
    !selectedGpt ||
    !selectedSovits ||
    (!refAudioUrl && !refAudioTempName) ||
    isUploadingRef;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>推理合成</CardTitle>
        <CardDescription>配置当前权重与推理参数，保存后便于快速切换</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 上半部分：左右双栏布局（左侧参考信息，右侧推理与采样参数） */}
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            {/* 配置名 + 人物（同一行） */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">配置名</label>
                  <TooltipIcon tip="用于区分不同配置，建议与模型或用途相关。" />
                </div>
                {/* 受控输入：value 绑定状态，onChange 更新状态 */}
                <Input
                  placeholder="例如：模型1"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">人物（可选）</label>
                  <TooltipIcon tip="用于归类多个情感配置，同一人物可有多套情感。" />
                </div>
                <select
                  className={selectClass}
                  value={isCustomCharacter ? CUSTOM_CHARACTER_VALUE : characterName || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === CUSTOM_CHARACTER_VALUE) {
                      setCharacterName("");
                      setIsCustomCharacter(true);
                      return;
                    }
                    setCharacterName(value);
                    setIsCustomCharacter(false);
                  }}
                >
                  <option value="">未选择</option>
                  {characterOptions.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                  <option value={CUSTOM_CHARACTER_VALUE}>新增人物…</option>
                </select>
                {isCustomCharacter && (
                  <Input
                    placeholder="请输入新人物名称"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* 参考感情 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">参考感情</label>
                <TooltipIcon tip="用于记录参考音频的情感标签，方便检索和对比。" />
              </div>
              <select
                className={selectClass}
                value={refEmotion}
                onChange={(e) => setRefEmotion(e.target.value)}
              >
                <option value="">未选择</option>
                {EMOTION_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* 当前选择的模型路径（只读，跟随父组件传入的 selectedGpt/selectedSovits） */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">GPT权重</label>
                  <TooltipIcon tip="当前选中的 GPT 权重，仅展示不可编辑。" />
                </div>
                <Input value={selectedGpt?.name || ""} placeholder="未选择" disabled />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">SoVITS权重</label>
                  <TooltipIcon tip="当前选中的 SoVITS 权重，仅展示不可编辑。" />
                </div>
                <Input value={selectedSovits?.name || ""} placeholder="未选择" disabled />
              </div>
            </div>

            {/* 参考音频相关容器：拖拽上传、文本、语种、无参考模式与波形预览 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">参考音频信息</div>
                <div className="space-y-2">
                  <div
                    className={`flex min-h-[160px] cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-6 text-xs text-slate-500 transition ${
                      isDragging ? "border-blue-400 bg-blue-50 text-blue-600" : "border-slate-200 bg-white"
                    }`}
                    onClick={handleRefAudioPick}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    拖拽或选择音频上传（<span className="text-yellow-700">3s~10s</span>）
                  </div>
                  <input
                    ref={refAudioInputRef}
                    type="file"
                    accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
                    className="hidden"
                    onChange={handleRefAudioFileChange}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.4fr_0.6fr]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">参考音频文本</label>
                      <TooltipIcon tip="参考音频对应的文字内容，提升对齐与拟合效果。" />
                    </div>
                    <textarea
                      className={textareaClass}
                      value={promptText}
                      onChange={(event) => setPromptText(event.target.value)}
                      placeholder="填写参考音频对应文本"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">参考音频语种</label>
                      <TooltipIcon tip="参考音频所使用的语言，用于模型正确解析。" />
                    </div>
                    {/* 受控下拉框：value 与 onChange 绑定状态 */}
                    <select
                      className={selectClass}
                      value={promptLang}
                      onChange={(event) => setPromptLang(event.target.value)}
                    >
                      {LANGUAGE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full"
                        onClick={handleAutoExtractPrompt}
                        disabled={isUploadingRef || isExtractingRefText || (!toTextAudio && !refAudioUrl && !refAudioTempUrl)}
                      >
                        {isExtractingRefText ? "识别中..." : "自动提取参考文本"}
                      </Button>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 cursor-pointer"
                    checked={refTextFree}
                    onChange={(event) => setRefTextFree(event.target.checked)}
                  />
                  <span>
                    无参考文本模式（部分模型不支持，并行推理不兼容）
                  </span>
                  <TooltipIcon tip="开启后会忽略参考文本（prompt_text），部分模型版本可能不支持。" />
                </label>

                <div className="space-y-2">
                  <div className="flex flex-col justify-center gap-2 text-xs text-slate-500">
                    <span className="font-medium">参考音频预览</span>
                    <span className="self-center">点击波形可定位</span>
                  </div>
                  {previewAudioUrl ? (
                    <WaveformWavesurfer
                      url={previewAudioUrl}
                      height={96}
                      waveColor="#cbd5f5"
                      progressColor={["#F7E7B5", "#E3A94B", "#B6782B"]}
                      className="rounded-md border border-slate-200 bg-slate-50"
                    />
                  ) : (
                    <div className="text-xs font-bold text-[#ff0404] w-full h-20 bg-gray-100 rounded-sm flex justify-center items-center">
                      请先上传音频
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* 语速与句间停顿 */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              <div className="text-sm font-semibold text-slate-900">语速与间隔</div>
              <RangeField
                label="语速"
                tip="越大语速越快。"
                value={speedFactorField.value}
                min={0.6}
                max={1.65}
                step={0.05}
                onChange={speedFactorField.setValue}
              />
              <RangeField
                label="句间停顿(秒)"
                tip="文本段之间的停顿时长"
                value={fragmentIntervalField.value}
                min={0.01}
                max={1}
                step={0.01}
                onChange={fragmentIntervalField.setValue}
              />
            </div>

            {/* 采样参数区（GPT sampling） */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              <div className="text-sm font-semibold text-slate-900">采样参数</div>
              <RangeField
                label="top_k"
                tip="候选采样数量，越大越多样。"
                value={topKField.value}
                min={1}
                max={100}
                step={1}
                onChange={topKField.setValue}
              />
              <RangeField
                label="top_p"
                tip="核采样阈值，越大越随机。"
                value={topPField.value}
                min={0}
                max={1}
                step={0.05}
                onChange={topPField.setValue}
              />
              <RangeField
                label="temperature"
                tip="影响随机性与多样性"
                value={temperatureField.value}
                min={0}
                max={1}
                step={0.05}
                onChange={temperatureField.setValue}
              />
              <RangeField
                label="重复惩罚"
                tip="降低重复内容的概率，过大可能影响语音流畅度"
                value={repetitionPenaltyField.value}
                min={0}
                max={2}
                step={0.05}
                onChange={repetitionPenaltyField.setValue}
              />
            </div>

            {/* 推理参数 */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              <div className="text-sm font-semibold text-slate-900">推理参数</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">batch_size</label>
                    <TooltipIcon tip="每次推理处理的文本数量，越大时并行推理占用显存越多，过大可能导致显存溢出" />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={batchSizeField.value}
                    onChange={batchSizeField.onChange}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 cursor-pointer"
                    checked={parallelInfer}
                    onChange={(event) => setParallelInfer(event.target.checked)}
                  />
                  并行推理
                  <TooltipIcon tip="开启后可提升速度，但资源占用更高。" />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 cursor-pointer"
                    checked={splitBucket}
                    onChange={(event) => setSplitBucket(event.target.checked)}
                  />
                  分桶推理
                  <TooltipIcon tip="并行推理时减少计算量，可能影响速度与质量平衡。" />
                </label>
              </div>
            </div>

            {/* 随机与种子 */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              <div className="text-sm font-semibold text-slate-900">随机与种子</div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 cursor-pointer"
                  checked={keepRandom}
                  onChange={(event) => setKeepRandom(event.target.checked)}
                />
                保持随机
                <TooltipIcon tip="开启后每次生成都会随机种子，结果更随机。" />
              </label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">seed</label>
                  <TooltipIcon tip="固定随机种子可复现结果，-1 表示随机。" />
                </div>
                <Input
                  type="number"
                  min={-1}
                  max={4294967295}
                  step={1}
                  value={seedField.value}
                  onChange={seedField.onChange}
                  disabled={keepRandom}
                />
                <div className="text-xs text-slate-500">保持随机开启时，seed 不生效</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {/* 操作按钮：先加载，后保存 */}
        <Button variant="outline" onClick={onOpenLoad}>
          加载配置
        </Button>
        <Button onClick={handleSave} disabled={isSaveDisabled}>
          {isUploadingRef ? "上传中..." : "保存配置"}
        </Button>
        <TooltipIcon tip={'将当前部署地址/版本等信息保存为预设'}></TooltipIcon>
      </CardFooter>
    </Card>
  );
});
