import { Icon } from "@iconify/react";
import type { Theme } from "../App";

interface PreviewPanelProps {
  theme: Theme;
  title: string;
  pdfUrl: string;
  onClose: () => void;
}

export default function PreviewPanel({ theme, title, pdfUrl, onClose }: PreviewPanelProps) {
  const isDark = theme === "dark";
  const border = isDark ? "border-white/10" : "border-black/10";
  const dimText = isDark ? "text-white/40" : "text-black/40";
  const hoverBg = isDark ? "hover:bg-white/10" : "hover:bg-black/10";

  return (
    <div
      className={`flex flex-col border-l ${border} shrink-0`}
      style={{ width: "420px" }}
    >
      {/* Panel header */}
      <div className={`px-4 py-3 border-b ${border} flex items-center gap-2`}>
        <Icon icon="mdi:file-pdf-box" className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span className="text-xs flex-1 truncate leading-snug" title={title}>
          {title}
        </span>
        <button
          onClick={onClose}
          className={`shrink-0 p-1 rounded transition-colors ${dimText} ${hoverBg} hover:text-rose-500`}
          title="Close preview"
        >
          <Icon icon="mdi:close" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* PDF viewer */}
      <iframe
        src={pdfUrl}
        className="flex-1 w-full border-0"
        title={title}
      />
    </div>
  );
}
