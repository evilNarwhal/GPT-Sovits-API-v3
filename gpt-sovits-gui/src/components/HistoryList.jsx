import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

export function HistoryList({ history }) {
  // 根据是否有记录展示不同视图
  const isEmpty = history.length === 0;
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = (item) => {
    if (!item?.audioUrl) return;
    if (audioRef.current && playingId === item.id) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(item.audioUrl);
    audioRef.current = audio;
    setPlayingId(item.id);
    audio.onended = () => setPlayingId(null);
    audio.play();
  };

  const handleDownload = (item) => {
    if (!item?.audioUrl) return;
    const link = document.createElement("a");
    link.href = item.audioUrl;
    link.download = item.audioFileName || `tts_${item.id || Date.now()}.wav`;
    link.click();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>生成记录</CardTitle>
        <CardDescription>查看最近生成的语音任务</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isEmpty && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
            还没有生成记录
          </div>
        )}
        {history.map((h) => (
          <div
            key={h.id}
            className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="space-y-1">
              <div className="text-sm font-medium">{h.text}</div>
              <div className="text-xs text-slate-500">
                {h.gpt} · {h.sovits}
                {h.refAudio ? ` · 参考音频：${h.refAudio}` : ""}
                {h.seed !== null && h.seed !== undefined ? ` · seed：${h.seed}` : ""} · {h.status}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTogglePlay(h)}
                disabled={!h.audioUrl}
              >
                {playingId === h.id && audioRef.current && !audioRef.current.paused ? "暂停" : "播放"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDownload(h)} disabled={!h.audioUrl}>
                下载
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
