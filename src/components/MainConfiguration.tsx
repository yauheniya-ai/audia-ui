import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import type { Theme } from "../App";
import {
  PROVIDERS,
  PROVIDER_ICONS,
  PROVIDER_MODELS,
  STT_MODELS,
  TTS_BACKENDS,
} from "../constants";
import type { LLMProvider } from "../constants";
import {
  ARXIV_ICON,
  STT_ICON,
  TTS_BACKEND_ICONS,
  TTS_VOICES,
} from "../constants";
import type { IconDef, TTSBackend } from "../constants";

// ────────────────────────────────── Diagram helpers

const ROSE_HEX = "#f43f5e";
const LIME_HEX = "#84cc16";

interface CardRectData { x: number; y: number; w: number; h: number }
interface DiagramLine { points: string; color: string; id: string }
interface DiagramRect { rect: CardRectData; color: string; id: string }

function getRelRect(el: HTMLElement, container: HTMLElement): CardRectData {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  return { x: er.left - cr.left, y: er.top - cr.top, w: er.width, h: er.height };
}
const btmC = (r: CardRectData) => ({ x: r.x + r.w / 2, y: r.y + r.h });
const topC = (r: CardRectData) => ({ x: r.x + r.w / 2, y: r.y });
const pts  = (...ps: Array<{ x: number; y: number }>) =>
  ps.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");

// ────────────────────────────────── renderIconDef

function renderIconDef(icon: IconDef, isDark: boolean, className = "w-4 h-4") {
  if (icon.kind === "img") {
    return <img src={icon.src} alt={icon.alt} className={`${className} object-contain`} />;
  }
  const colorClass = icon.adaptive ? (isDark ? "text-white" : "text-black") : "";
  return <Icon icon={icon.name} className={`${className} ${colorClass}`.trim()} />;
}

// ────────────────────────────────── CustomSelect

function CustomSelect({
  value,
  options,
  onChange,
  isDark,
  accent = "rose",
}: {
  value: string;
  options: readonly string[] | string[];
  onChange: (v: string) => void;
  isDark: boolean;
  accent?: "lime" | "rose";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const accentBorder      = accent === "lime" ? "border-lime-500/40"       : "border-rose-500/40";
  const accentHoverBorder = accent === "lime" ? "hover:border-lime-500/70" : "hover:border-rose-500/70";
  const accentSelBg       = accent === "lime" ? "bg-lime-950"              : "bg-rose-950";
  const accentSelTxt      = accent === "lime" ? "text-lime-400"            : "text-rose-400";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`z-40 w-full flex items-center justify-between gap-1 rounded border px-2 py-1.5 text-xs transition-colors
          ${isDark ? "bg-zinc-800 text-white" : "bg-stone-100 text-black"}
          ${accentBorder} ${accentHoverBorder}`}
      >
        <span className="truncate">{value}</span>
        <Icon
          icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
          className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-white/30" : "text-black/30"}`}
        />
      </button>
      {open && (
        <div
          className={`absolute z-50 top-full left-0 right-0 mt-1 rounded border shadow-lg overflow-hidden ${
            isDark ? "bg-zinc-900/10 backdrop-blur-sm border-white/10" : "bg-white/95 border-black/10"
          }`}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                opt === value
                  ? `${accentSelBg} ${accentSelTxt} font-medium`
                  : isDark
                  ? `text-white/70 hover:bg-zinc-800`
                  : `text-black/70 hover:bg-gray-100`
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────── MainConfiguration

export interface MainConfigurationProps {
  theme: Theme;
  sttModel: string;       setSttModel: (v: string) => void;
  llm1Provider: LLMProvider; setLlm1Provider: (v: LLMProvider) => void;
  llm1Model: string;      setLlm1Model: (v: string) => void;
  llm2Provider: LLMProvider; setLlm2Provider: (v: LLMProvider) => void;
  llm2Model: string;      setLlm2Model: (v: string) => void;
  ttsBackend: string;     setTtsBackend: (v: string) => void;
  ttsVoice: string;       setTtsVoice: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}

export function MainConfiguration({
  theme, sttModel, setSttModel,
  llm1Provider, setLlm1Provider, llm1Model, setLlm1Model,
  llm2Provider, setLlm2Provider, llm2Model, setLlm2Model,
  ttsBackend, setTtsBackend, ttsVoice, setTtsVoice,
  onSave, saving, saved,
}: MainConfigurationProps) {
  const isDark  = theme === "dark";
  const cardBg  = isDark ? "bg-zinc-900/90" : "bg-white";
  const dimText = isDark ? "text-white/40"  : "text-black/40";

  const containerRef = useRef<HTMLDivElement>(null);
  const sttRef   = useRef<HTMLDivElement>(null);
  const textRef  = useRef<HTMLDivElement>(null);
  const arxivRef = useRef<HTMLDivElement>(null);
  const pdfRef   = useRef<HTMLDivElement>(null);
  const llm1Ref  = useRef<HTMLDivElement>(null);
  const prepRef  = useRef<HTMLDivElement>(null);
  const llm2Ref  = useRef<HTMLDivElement>(null);
  const ttsRef   = useRef<HTMLDivElement>(null);

  const [lines, setLines] = useState<DiagramLine[]>([]);
  const [rects, setRects] = useState<DiagramRect[]>([]);

  const updateDiagram = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if ([sttRef, textRef, arxivRef, pdfRef, llm1Ref, prepRef, llm2Ref, ttsRef].some(r => !r.current)) return;

    const sttR   = getRelRect(sttRef.current!,   container);
    const textR  = getRelRect(textRef.current!,  container);
    const arxivR = getRelRect(arxivRef.current!, container);
    const pdfR   = getRelRect(pdfRef.current!,   container);
    const llm1R  = getRelRect(llm1Ref.current!,  container);
    const prepR  = getRelRect(prepRef.current!,  container);
    const llm2R  = getRelRect(llm2Ref.current!,  container);
    const ttsR   = getRelRect(ttsRef.current!,   container);

    const sttB   = btmC(sttR);
    const txtB   = btmC(textR);
    const llm1T  = topC(llm1R);
    const llm1B  = btmC(llm1R);
    const arxivT = topC(arxivR);
    const arxivB = btmC(arxivR);
    const pdfB   = btmC(pdfR);

    const midY1 = sttB.y + (llm1T.y - sttB.y) / 2;
    const midY2 = llm1B.y + (arxivT.y - llm1B.y) / 2;

    const prepTL = { x: prepR.x + prepR.w * 0.30, y: prepR.y };
    const midY3  = arxivB.y + (prepTL.y - arxivB.y) / 2;

    const prepTR = { x: prepR.x + prepR.w * 0.70, y: prepR.y };
    const midY4  = pdfB.y + (prepTR.y - pdfB.y) / 2;

    const newLines: DiagramLine[] = [
      {
        id: "stt-llm1",
        color: LIME_HEX,
        points: pts(sttB, { x: sttB.x, y: midY1 }, { x: llm1T.x, y: midY1 }, llm1T),
      },
      {
        id: "txt-arxiv",
        color: ROSE_HEX,
        points: pts(txtB, { x: txtB.x, y: midY2 }, { x: arxivR.x + arxivR.w * 0.65, y: midY2 }, { x: arxivR.x + arxivR.w * 0.65, y: arxivR.y }),
      },
      {
        id: "llm1-arxiv",
        color: ROSE_HEX,
        points: pts(llm1B, { x: llm1B.x, y: midY2 }, { x: arxivT.x, y: midY2 }, arxivT),
      },
      {
        id: "arxiv-prep",
        color: ROSE_HEX,
        points: pts(arxivB, { x: arxivB.x, y: midY3 }, { x: prepTL.x, y: midY3 }, prepTL),
      },
      {
        id: "pdf-prep",
        color: ROSE_HEX,
        points: pts(pdfB, { x: pdfB.x, y: midY4 }, { x: prepTR.x, y: midY4 }, prepTR),
      },
      {
        id: "prep-llm2",
        color: ROSE_HEX,
        points: pts(btmC(prepR), topC(llm2R)),
      },
      {
        id: "llm2-tts",
        color: LIME_HEX,
        points: pts(btmC(llm2R), topC(ttsR)),
      },
    ];

    const newRects: DiagramRect[] = [
      { id: "r-stt",   rect: sttR,   color: LIME_HEX },
      { id: "r-txt",   rect: textR,  color: ROSE_HEX },
      { id: "r-arxiv", rect: arxivR, color: ROSE_HEX },
      { id: "r-pdf",   rect: pdfR,   color: ROSE_HEX },
      { id: "r-llm1",  rect: llm1R,  color: ROSE_HEX },
      { id: "r-prep",  rect: prepR,  color: ROSE_HEX },
      { id: "r-llm2",  rect: llm2R,  color: ROSE_HEX },
      { id: "r-tts",   rect: ttsR,   color: LIME_HEX },
    ];

    setLines(newLines);
    setRects(newRects);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(updateDiagram));
    const t = setTimeout(updateDiagram, 120);
    window.addEventListener("resize", updateDiagram);
    return () => { clearTimeout(t); window.removeEventListener("resize", updateDiagram); };
  }, [updateDiagram]);

  // LLM sub-card — shows provider logo
  const LLMCard = ({
    label, cardRef, provider, model, onProvider, onModel,
  }: {
    label: string;
    cardRef: React.RefObject<HTMLDivElement | null>;
    provider: LLMProvider;
    model: string;
    onProvider: (p: LLMProvider) => void;
    onModel: (m: string) => void;
  }) => (
    <div ref={cardRef} className={`rounded-lg p-4 ${cardBg}`}>
      <div className="flex items-center gap-2 mb-3">
        {renderIconDef(PROVIDER_ICONS[provider], isDark)}
        <span className="text-xs font-semibold">LLM</span>
        <span className={`text-xs ${dimText}`}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={`text-xs ${dimText} mb-1`}>Provider</p>
          <CustomSelect
            isDark={isDark}
            accent="rose"
            value={provider}
            options={PROVIDERS}
            onChange={(v) => {
              const p = v as LLMProvider;
              onProvider(p);
              onModel(PROVIDER_MODELS[p][0]);
            }}
          />
        </div>
        <div>
          <p className={`text-xs ${dimText} mb-1`}>Model</p>
          <CustomSelect
            isDark={isDark}
            accent="rose"
            value={model}
            options={PROVIDER_MODELS[provider]}
            onChange={onModel}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <p className={`text-xs ${dimText} mb-8`}>
        Configure models for each stage — arrows show the processing pipeline.
      </p>

      <div ref={containerRef} className="relative">
        {/* ── Animated SVG overlay ── */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker id="arrowRose" markerWidth="3.5" markerHeight="3.5" refX="2.5" refY="1.75" orient="auto">
              <path d="M0,0 L3.5,1.75 L0,3.5 Z" fill={ROSE_HEX} opacity="0.85" />
            </marker>
            <marker id="arrowLime" markerWidth="3.5" markerHeight="3.5" refX="2.5" refY="1.75" orient="auto">
              <path d="M0,0 L3.5,1.75 L0,3.5 Z" fill={LIME_HEX} opacity="0.85" />
            </marker>
          </defs>

          {rects.map(({ id, rect, color }) => (
            <rect
              key={id}
              x={rect.x + 1.5}
              y={rect.y + 1.5}
              width={Math.max(0, rect.w - 3)}
              height={Math.max(0, rect.h - 3)}
              rx="8"
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray="5 7"
              strokeLinecap="round"
            >
              <animate attributeName="stroke-dashoffset" from="48" to="0" dur="2.2s" repeatCount="indefinite" />
            </rect>
          ))}

          {lines.map(({ id, points, color }) => (
            <polyline
              key={id}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="4 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={color === ROSE_HEX ? "url(#arrowRose)" : "url(#arrowLime)"}
              opacity="0.75"
            >
              <animate attributeName="stroke-dashoffset" from="40" to="0" dur="1.8s" repeatCount="indefinite" />
            </polyline>
          ))}
        </svg>

        {/* ── Cards — 4-col grid ── */}
        <div className="grid gap-6 relative">

          {/* Row 1 — STT + Text: full width, each 50% */}
          <div className="grid grid-cols-2 gap-4">
            <div ref={sttRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-3">
                {renderIconDef(STT_ICON, isDark)}
                <span className="text-xs font-semibold">STT</span>
                <span className={`text-xs ${dimText}`}>Speech to Text</span>
              </div>
              <p className={`text-xs ${dimText} mb-1`}>Model</p>
              <CustomSelect isDark={isDark} accent="lime" value={sttModel} options={STT_MODELS} onChange={setSttModel} />
            </div>

            <div ref={textRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:text-box-outline" className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">Text</span>
                <span className={`text-xs ${dimText}`}>Direct input</span>
              </div>
              <p className={`text-xs ${dimText} leading-relaxed`}>
                Paste or type raw text as input to the pipeline.
              </p>
            </div>
          </div>

          {/* Row 2 — LLM 1: left-aligned */}
          <div className="grid grid-cols-2 gap-4">
            <LLMCard
              label="Research string normalisation"
              cardRef={llm1Ref}
              provider={llm1Provider}
              model={llm1Model}
              onProvider={setLlm1Provider}
              onModel={setLlm1Model}
            />
            <div />
          </div>

          {/* Row 3 — ArXiv + PDF: full width, each 50% */}
          <div className="grid grid-cols-2 gap-4">
            <div ref={arxivRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-2">
                {renderIconDef(ARXIV_ICON, isDark)}
                <span className="text-xs font-semibold">arXiv</span>
                <span className={`text-xs ${dimText}`}>Paper search</span>
              </div>
              <p className={`text-xs ${dimText} leading-relaxed`}>
                Search and download papers from ArXiv directly.
              </p>
            </div>

            <div ref={pdfRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="bi:file-earmark-pdf-fill" className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">PDF</span>
                <span className={`text-xs ${dimText}`}>Document upload</span>
              </div>
              <p className={`text-xs ${dimText} leading-relaxed`}>
                Upload a PDF — text extracted automatically.
              </p>
            </div>
          </div>

          {/* Row 4 — Preprocessing: centered */}
          <div className="grid grid-cols-4 gap-4">
            <div />
            <div className="col-span-2">
              <div ref={prepRef} className={`rounded-lg p-4 ${cardBg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon="mdi:cog-outline" className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-semibold">Preprocessing</span>
                </div>
                <p className={`text-xs ${dimText} leading-relaxed`}>
                  Text cleaning, sentence chunking and normalisation.
                </p>
              </div>
            </div>
            <div />
          </div>

          {/* Row 5 — LLM 2: centered */}
          <div className="grid grid-cols-4 gap-4">
            <div />
            <div className="col-span-2">
              <LLMCard
                label="Content curation"
                cardRef={llm2Ref}
                provider={llm2Provider}
                model={llm2Model}
                onProvider={setLlm2Provider}
                onModel={setLlm2Model}
              />
            </div>
            <div />
          </div>

          {/* Row 6 — TTS: centered */}
          <div className="grid grid-cols-4 gap-4">
            <div />
            <div className="col-span-2">
              <div ref={ttsRef} className={`rounded-lg p-4 ${cardBg}`}>
                <div className="flex items-center gap-2 mb-3">
                  {renderIconDef(TTS_BACKEND_ICONS[ttsBackend as TTSBackend], isDark, "w-4 h-4 rounded")}
                  <span className="text-xs font-semibold">TTS</span>
                  <span className={`text-xs ${dimText}`}>Text to Speech</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={`text-xs ${dimText} mb-1`}>Engine</p>
                    <CustomSelect isDark={isDark} accent="lime" value={ttsBackend} options={TTS_BACKENDS} onChange={(v) => { setTtsBackend(v); setTtsVoice(TTS_VOICES[v as TTSBackend][0]); }} />
                  </div>
                  <div>
                    <p className={`text-xs ${dimText} mb-1`}>Voice</p>
                    <CustomSelect isDark={isDark} accent="lime" value={ttsVoice} options={TTS_VOICES[ttsBackend as TTSBackend]} onChange={setTtsVoice} />
                  </div>
                </div>
              </div>
            </div>
            <div />
          </div>

        </div>{/* /cards grid */}
      </div>{/* /relative container */}

      {/* Save / saved indicator */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-xs bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 transition-colors disabled:opacity-50"
        >
          {saving
            ? <Icon icon="mdi:loading" className="w-3.5 h-3.5 animate-spin" />
            : <Icon icon="mdi:content-save" className="w-3.5 h-3.5" />
          }
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-lime-500">
            <Icon icon="mdi:check-circle" className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
