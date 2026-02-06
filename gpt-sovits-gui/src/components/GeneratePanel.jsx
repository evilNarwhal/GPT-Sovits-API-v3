import { forwardRef, useImperativeHandle, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { WaveformWavesurfer } from "./ui/waveform-wavesurfer";

const LANGUAGE_OPTIONS = [
  "中文",
  "英文",
  "日文",
  "粤语",
  "韩文",
  "中英混合",
  "日英混合",
  "粤英混合",
  "韩英混合",
  "多语种混合",
  "多语种混合(粤语)",
];

const CUT_OPTIONS = [
  "不切",
  "凑四句一切",
  "凑50字一切",
  "按中文句号。切",
  "按英文句号.切",
  "按标点符号切",
];

export const GeneratePanel = forwardRef(function GeneratePanel(
  {
    selectedModel,
    onGenerate,
    text,
    onTextChange,
    textLang,
    onTextLangChange,
    textSplitMethod,
    onTextSplitMethodChange,
    outputUrl = "",
  },
  ref
) {
  // 兼容受控/非受控两种用法
  const [localText, setLocalText] = useState("");
  const [localLang, setLocalLang] = useState("中文");
  const [localSplit, setLocalSplit] = useState("凑四句一切");

  const mergedText = text ?? localText;
  const mergedLang = textLang ?? localLang;
  const mergedSplit = textSplitMethod ?? localSplit;

  const setTextValue = onTextChange || setLocalText;
  const setLangValue = onTextLangChange || setLocalLang;
  const setSplitValue = onTextSplitMethodChange || setLocalSplit;

  // 触发生成：校验文本后把结果交给父组件
  const triggerGenerate = () => {
    const trimmed = (mergedText || "").trim();
    if (!trimmed) return;
    onGenerate?.(trimmed);
  };

  // 清空输入框
  const handleClear = () => {
    setTextValue("");
  };

  // 暴露给父组件的方法：顶部按钮可以直接触发生成
  useImperativeHandle(
    ref,
    () => ({
      triggerGenerate,
      clearText: handleClear,
    }),
    [mergedText, onGenerate]
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>生成语音</CardTitle>
        <CardDescription>填写目标文本与语种</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <div className="text-sm font-semibold text-slate-900">目标文本与语种</div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">需要合成的文本</label>
            <textarea
              className="min-h-[140px] w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="请输入要生成的语音文本，首句较短时/开启无参考文本模式可能会导致有前置语气"
              value={mergedText}
              onChange={(e) => setTextValue(e.target.value)}
            />
            <div className="text-xs text-slate-500">提示：合成文本可能会被外部调用覆盖</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">目标语种</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={mergedLang}
                onChange={(event) => setLangValue(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">怎么切</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={mergedSplit}
                onChange={(event) => setSplitValue(event.target.value)}
              >
                {CUT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <div className="text-sm font-semibold text-slate-900">生成语音预览</div>
          {outputUrl ? (
            <WaveformWavesurfer
              key={outputUrl}
              url={outputUrl}
              height={96}
              className="rounded-md border border-slate-200 bg-slate-50"
            />
          ) : (
            <div className="text-xs text-slate-500">暂无输出音频</div>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={handleClear}>
          清空
        </Button>
        <Button onClick={triggerGenerate}>生成语音</Button>
      </CardFooter>
    </Card>
  );
});
