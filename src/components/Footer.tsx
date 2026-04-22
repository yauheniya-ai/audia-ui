import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { Theme } from "../App";
import MusicVisualizer from "./MusicVisualizer";

interface FooterProps {
  theme: Theme;
}

export default function Footer({ theme }: FooterProps) {
  const [version, setVersion] = useState<string>("…");

  const isDark    = theme === "dark";
  const bg        = isDark ? "bg-black"        : "bg-white";
  const border    = isDark ? "border-white/10" : "border-black/10";
  const text      = isDark ? "text-white/50"   : "text-black/50";
  const hoverText = isDark ? "hover:text-white" : "hover:text-black";

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json())
      .then((d) => setVersion(d.version ?? "?"))
      .catch(() => setVersion("?"));
  }, []);

  return (
    <footer className={`${bg} ${text} border-t ${border} px-6 py-2.5 flex items-center justify-between shrink-0`}>

      {/* Left: visualizer + logo */}
      <div className="flex items-center gap-2 w-40">
        
        <span className="font-mono text-black text-xs px-1 bg-purple-500">
          audia
        </span>
        <MusicVisualizer isDark={isDark} />
      </div>

      {/* Center: links */}
      <div className="flex items-center gap-5 text-xs">
        <a href="https://pypi.org/project/audia/" target="_blank" rel="noreferrer" className={`flex items-center gap-1 transition-colors ${hoverText}`}>
          <Icon icon="simple-icons:pypi" className="w-3.5 h-3.5" />
          PyPI
        </a>
        <a href="https://github.com/yauheniya-ai/audia" target="_blank" rel="noreferrer" className={`flex items-center gap-1 transition-colors ${hoverText}`}>
          <Icon icon="mdi:github" className="w-3.5 h-3.5" />
          GitHub
        </a>
        <a href="/api/docs" target="_blank" rel="noreferrer" className={`flex items-center gap-1 transition-colors ${hoverText}`}>
          <Icon icon="file-icons:swagger" className="w-3.5 h-3.5" />
          API
        </a>
        <a href="https://audia.readthedocs.io" target="_blank" rel="noreferrer" className={`flex items-center gap-1 transition-colors ${hoverText}`}>
          <Icon icon="simple-icons:readthedocs" className="w-3.5 h-3.5" />
          Docs
        </a>
        <a href="https://github.com/yauheniya-ai/audia/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer" className={`flex items-center gap-1 transition-colors ${hoverText}`}>
          <Icon icon="octicon:log-16" className="w-3.5 h-3.5" />
          Changelog
        </a>
      </div>

      {/* Right: version */}
      <div className="w-40 flex justify-end">
        <span className="text-xs font-mono">v{version}</span>
      </div>

    </footer>
  );
}