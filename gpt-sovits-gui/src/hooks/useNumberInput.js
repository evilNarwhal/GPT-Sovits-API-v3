import { useCallback, useState } from "react";

// 数值安全转换：处理空值/非法值，并限制范围
const clampNumber = (raw, fallback, min, max) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
};

// useNumberInput：统一处理数字输入的状态与范围控制
function useNumberInput(initial, { min, max } = {}) {
  const [value, setValue] = useState(initial);

  const setSafeValue = useCallback(
    (raw) => {
      setValue((prev) => clampNumber(raw, prev, min, max));
    },
    [min, max]
  );

  const onChange = useCallback(
    (event) => {
      setSafeValue(event.target.value);
    },
    [setSafeValue]
  );

  return {
    value,
    setValue: setSafeValue,
    onChange,
  };
}

export { useNumberInput };
