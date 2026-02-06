import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "../hooks/use-toast";

export function LoadConfig({
  open,
  onOpenChange,
  configs = [],
  onLoad,
  onDelete,
  errorMessage = "",
}) {
  const [selectedId, setSelectedId] = useState("");
  const { toast } = useToast();
  const selectedConfig = configs.find((item) => item.id === selectedId) || null;
  const isEmpty = configs.length === 0;

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleKeyDown = (event, id) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId(id);
    }
  };

  const handleClose = () => {
    onOpenChange?.(false);
  };

  const handleLoad = () => {
    if (!selectedConfig) return;
    onLoad?.(selectedConfig);
  };

  const handleDelete = async (id) => {
    try {
      await onDelete?.(id);
      setSelectedId("");
      toast({ title: "配置已删除", variant: "success" });
    } catch (error) {
      toast({
        title: "删除失败",
        description: error?.message || "请稍后重试",
        variant: "destructive",
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl">
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>加载配置</CardTitle>
                <CardDescription>选择配置后点击“加载配置”即可应用。</CardDescription>
              </div>
              <Button variant="ghost" onClick={handleClose}>
                关闭
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[60vh] space-y-2 overflow-auto">
            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMessage}
              </div>
            )}
            {isEmpty && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                还没有保存的配置
              </div>
            )}
            {configs.map((c) => {
              const id = c.id || `${c.name}-${c.characterName || ""}-${c.refEmotion || ""}`;
              const isSelected = id === selectedId;
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => handleSelect(id)}
                  onKeyDown={(event) => handleKeyDown(event, id)}
                  className={`flex cursor-pointer items-start justify-between rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {c.name} · {c.characterName || "未设置人物"} ·{" "}
                      {c.refEmotion || "未设置情感"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(c.id);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="justify-between">
            <div className="text-xs text-slate-500">
              当前选择：{selectedConfig?.name || "未选择"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleLoad} disabled={!selectedConfig}>
                加载配置
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
