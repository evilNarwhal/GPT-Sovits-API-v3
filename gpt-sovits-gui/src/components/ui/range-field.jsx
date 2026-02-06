import { Input } from "./input";
import { TooltipIcon } from "./tooltip-icon";

// RangeField：展示“数字输入 + 滑块”的组合控件
// props 说明：label 文案、tip 说明、value 当前值、min/max/step 范围、onChange 回传、hint 提示文案
function RangeField({ label, tip, value, min, max, step, onChange, hint }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <TooltipIcon tip={tip} />
        </div>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-24 text-right"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      />
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export { RangeField };
