import { useState } from "react";
import { Icon } from "@iconify/react";
import type { FC } from "react";
import type { Theme, ThemeMode } from "../App";

const THEME_OPTIONS: { value: ThemeMode; icon: string; label: string; darkActiveClass: string; lightActiveClass: string; darkPillClass: string; lightPillClass: string }[] = [
  { value: 'system', icon: 'solar:monitor-linear', label: 'System', darkActiveClass: 'text-white',     lightActiveClass: 'text-black',     darkPillClass: 'bg-black',   lightPillClass: 'bg-blue' },
  { value: 'light',  icon: 'ph:sun-bold',          label: 'Light',  darkActiveClass: 'text-amber-400', lightActiveClass: 'text-amber-500', darkPillClass: 'bg-black',   lightPillClass: 'bg-cyan-200' },
  { value: 'dark',   icon: 'ph:moon-bold',         label: 'Dark',   darkActiveClass: 'text-amber-400', lightActiveClass: 'text-black',     darkPillClass: 'bg-black',   lightPillClass: 'bg-blue' },
];

interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (m: ThemeMode) => void;
  isDark: boolean;
}

const ThemeToggle: FC<ThemeToggleProps> = ({ mode, onChange, isDark }) => {
  const idx = Math.max(0, THEME_OPTIONS.findIndex(o => o.value === mode));
  const activeOpt = THEME_OPTIONS[idx];
  const containerBg = isDark ? 'bg-white/10 border border-white/20' : 'bg-black/5 border border-black/10';
  const pillBg = isDark ? activeOpt.darkPillClass : activeOpt.lightPillClass;
  const inactiveText = isDark ? 'text-white/50 hover:text-white' : 'text-black/40 hover:text-black';
  return (
    <div className={`relative flex items-center ${containerBg} rounded-full p-0.5`}>
      <div
        className={`absolute top-0.5 left-0.5 w-7 h-7 ${pillBg} rounded-full transition-transform duration-200 ease-out shadow-sm`}
        style={{ transform: `translateX(${idx * 28}px)` }}
        aria-hidden
      />
      {THEME_OPTIONS.map(opt => {
        const active = opt.value === mode;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={`${opt.label} mode`}
            aria-label={`${opt.label} mode`}
            aria-pressed={active}
            className={`relative z-10 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
              active
                ? (isDark ? opt.darkActiveClass : opt.lightActiveClass)
                : inactiveText
            }`}
          >
            <Icon icon={opt.icon} width={14} height={14} />
          </button>
        );
      })}
    </div>
  );
};

interface HeaderProps {
  theme: Theme;
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
}

export default function Header({ theme, themeMode, onChangeTheme }: HeaderProps) {
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
        <Icon icon="streamline-freehand:help-headphones-customer-support-human" className="w-7 h-7 text-purple-500" />
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
      <ThemeToggle mode={themeMode} onChange={onChangeTheme} isDark={isDark} />
    </header>
  );
}
