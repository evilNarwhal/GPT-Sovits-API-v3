import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

export function ModelList({ title, description, models, selectedModel, onSelect, onImport }) {
  // 模型列表负责渲染选择状态与导入入口
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {models.map((m) => {
          // 路径字段可能较长，单独计算显示值便于后续扩展
          const pathDisplay = m.path;

          return (
            <div
              key={m.name}
              className={`space-y-2 rounded-lg border p-3 transition hover:border-slate-300 hover:bg-white ${
                selectedModel?.name === m.name ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="font-medium max-w-30 truncate">{m.name}</div>
                  <div className="text-xs text-slate-500 break-all">{pathDisplay}</div>
                </div>
                <Button
                  className="shrink-0"
                  size="sm"
                  variant={selectedModel?.name === m.name ? "secondary" : "outline"}
                  onClick={() => onSelect(m)}
                >
                  {selectedModel?.name === m.name ? "已选择" : "选择"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="outline" onClick={onImport}>
          导入模型
        </Button>
      </CardFooter>
    </Card>
  );
}
