import { useState } from "react";
import { Icon } from "@iconify/react";
import type { Theme } from "../App";

interface HeaderProps {
  theme: Theme;
  toggleTheme: () => void;
}

export default function Header({ theme, toggleTheme }: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const isDark = theme === "dark";

  const border = isDark ? "border-white/10" : "border-black/10";
  const bg = isDark ? "bg-black" : "bg-white";
  const text = isDark ? "text-white" : "text-black";
  const dimText = isDark ? "text-white/50" : "text-black/50";
  const codeBg = isDark ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10";

  const handleCopy = () => {
    navigator.clipboard.writeText("pip install audia");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className={`${bg} ${text} border-b ${border} px-6 py-3 flex items-center justify-between shrink-0`}>
      {/* Logo */}
      <div className="flex items-center gap-4">
        <span className="text-purple-500 font-bold text-sm tracking-widest uppercase">
          audia
        </span>
        <span className={`${dimText} text-xs hidden sm:block`}>
          ideas → audio
        </span>
      </div>

      {/* Install command */}
      <div className="flex items-center gap-2">
        <Icon icon="mdi:terminal" className="w-3.5 h-3.5 text-lime-500" />
        <button
            onClick={handleCopy}
            className={`${codeBg} ${text} flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors`}
            title="Copy to clipboard"
        >
            
            <span className="text-lime-500">pip install audia</span>
            <Icon
                icon={copied ? "mdi:check" : "mdi:content-copy"}
                className={`w-3.5 h-3.5 ${copied ? "text-lime-500" : dimText}`}
            />
        </button>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className={`${codeBg} ${text} p-1.5 rounded transition-colors`}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <Icon
          icon={isDark ? "mdi:white-balance-sunny" : "mdi:moon-waning-crescent"}
          className="w-4 h-4"
        />
      </button>
    </header>
  );
}
