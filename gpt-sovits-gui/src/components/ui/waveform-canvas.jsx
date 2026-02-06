import { useEffect, useRef, useState } from "react";

// 把本地路径转换成 file:// 用于音频读取
const toFileUrl = (inputPath) => {
  if (!inputPath) return "";
  if (inputPath.startsWith("file://")) return inputPath;
  const normalized = inputPath.replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  return `${prefix}${encodeURI(normalized)}`;
};

// WaveformCanvas：用 Canvas 绘制基础波形（学习用）
function WaveformCanvas({ audioPath, height = 96, className = "" }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  const clearWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const drawWaveform = (audioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const heightValue = canvas.height;
    const middle = heightValue / 2;
    const data = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / width));

    ctx.clearRect(0, 0, width, heightValue);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, heightValue);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x += 1) {
      const start = x * step;
      let min = 1;
      let max = -1;
      for (let i = 0; i < step; i += 1) {
        const value = data[start + i] || 0;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      ctx.moveTo(x, middle + min * middle);
      ctx.lineTo(x, middle + max * middle);
    }

    ctx.stroke();
  };

  useEffect(() => {
    let isCanceled = false;
    let audioContext;

    const render = async () => {
      if (!audioPath) {
        setError("");
        clearWaveform();
        return;
      }

      try {
        const url = toFileUrl(audioPath);
        const response = await fetch(url);
        if (!response.ok) throw new Error("音频文件读取失败");
        const arrayBuffer = await response.arrayBuffer();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        if (isCanceled) return;
        drawWaveform(audioBuffer);
        setError("");
      } catch (err) {
        if (isCanceled) return;
        setError("音频文件读取失败");
        clearWaveform();
      } finally {
        if (audioContext) {
          audioContext.close();
        }
      }
    };

    render();

    return () => {
      isCanceled = true;
      if (audioContext) audioContext.close();
    };
  }, [audioPath]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={640}
        height={height}
        className={`w-full h-24 ${className}`}
      />
      {error ? <div className="text-xs text-red-500">{error}</div> : null}
    </div>
  );
}

export { WaveformCanvas };
