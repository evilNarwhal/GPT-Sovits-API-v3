import { memo, useCallback, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import WavesurferPlayer from "@wavesurfer/react";

const DEFAULT_PROGRESS_COLOR = ["#F7E7B5", "#E3A94B", "#B6782B"];

// WaveformWavesurfer：使用 wavesurfer.js 渲染波形
// 外层导出的是 memo 包装后的组件，用来避免无关表单更新导致波形重渲染
function WaveformWavesurferInner({
  url,
  height = 96,
  waveColor = "#cbd5f5",
  progressColor = DEFAULT_PROGRESS_COLOR,
  className = "",
}) {
  // 保存 wavesurfer 实例，用于控制播放/暂停
  const waveSurferRef = useRef(null);
  // 记录当前是否在播放，用于切换按钮图标
  const [isPlaying, setIsPlaying] = useState(false);
  // 当前播放时间（秒，带小数），用于底部时间显示
  const [currentTime, setCurrentTime] = useState(0);
  // 音频总时长（秒，带小数）
  const [duration, setDuration] = useState(0);

  const formatTime = (value) => {
    // 这里不使用 toFixed：
    // toFixed 会生成“总秒数”的字符串（例如 1.23），无法直接得到 mm:ss.xx
    if (value === null || value === undefined || Number.isNaN(value)) return "00:00.00";
    const clamped = Math.max(0, Number(value));
    const minutes = Math.floor(clamped / 60);
    const seconds = Math.floor(clamped % 60);
    const centiseconds = Math.floor((clamped - Math.floor(clamped)) * 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  // 未提供音频时直接显示占位
  if (!url) {
    return (
      <div className={`flex h-24 items-center justify-center text-xs text-slate-500 ${className}`}>
        暂无波形预览
      </div>
    );
  }

  // 点击按钮时切换播放/暂停
  const handleToggle = () => {
    const ws = waveSurferRef.current;
    if (ws) {
      // 切换音频实例的播放状态
      ws.playPause();
    }
  };

  // 缓存函数引用，避免每次渲染都生成新的函数对象
  const handleReady = (ws) => {
    waveSurferRef.current = ws;
    // 将播放位置移动到 0，避免首次播放进度不同步
    ws.seekTo(0);
    setIsPlaying(false);
    setDuration(ws.getDuration() || 0);
    setCurrentTime(0);

    // 音频时间更新：播放、滚动、拖动都会触发
    ws.on("audioprocess", () => setCurrentTime(ws.getCurrentTime()));
    ws.on("seek", () => setCurrentTime(ws.getCurrentTime()));
    ws.on("interaction", () => setCurrentTime(ws.getCurrentTime()));
    ws.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(ws.getDuration() || 0);
    });
  };

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  return (
    <div className="space-y-2">
      <div className={className}>
        {/* WavesurferPlayer 用于绘制波形并控制播放进度 */}
        <WavesurferPlayer
          height={height}
          waveColor={waveColor}
          progressColor={progressColor}
          url={url}
          barWidth={2}
          barGap={2}
          barRadius={2}
          cursorColor="#94a3b8"
          interact={true}
          normalize={true}
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={handlePause}
        />
      </div>
      <div className="flex items-center justify-center text-xs text-slate-500">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
      <div className="flex items-center justify-center">
        {/* 播放/暂停按钮，使用 lucide 图标 */}
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition border-[#F3D8A1] bg-[#FFF4D6] text-[#A46B12] hover:border-[#E9C47B] hover:bg-[#FFE9BC]"
          onClick={handleToggle}
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// React.memo：只有 url 变化时才重渲染，避免其他表单更新导致波形闪烁
const WaveformWavesurfer = memo(
  WaveformWavesurferInner,
  (prev, next) => prev.url === next.url
);

export { WaveformWavesurfer };
