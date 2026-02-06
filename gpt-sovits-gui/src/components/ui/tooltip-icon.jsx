// 圆形问号图标 + 悬浮提示（不使用 title 原生提示）
function TooltipIcon({ tip }) {
  return (
    <span className="relative group inline-flex h-5 w-5 items-center justify-center text-slate-500 cursor-help">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.8.6-1.7 1.2-1.7 2.2" />
        <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {tip}
      </span>
    </span>
  );
}

export { TooltipIcon };
