import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import type { AudioEntry, ConvertResult, LivePreview, Theme } from "../App";
import {
  PROVIDERS,
  PROVIDER_ICONS,
  PROVIDER_MODELS,
  STT_MODELS,
  TTS_BACKENDS,
} from "../constants";
import type { LLMProvider } from "../constants";
import arxivLogo   from "../assets/arxiv.svg";
import systranLogo from "../assets/systran.svg";
import hexgradLogo from "../assets/hexgrad.webp";

interface MainProps {
  theme: Theme;
  activeAudio: AudioEntry | null;
  setActiveAudio: (a: AudioEntry | null) => void;
  onConverted: () => void;
  setLivePreviewPdf: (p: LivePreview | null) => void;
}

interface JobStatus {
  status: "running" | "done" | "error" | "cancelled";
  stage: string;
  stage_label: string;
  progress: number;
  log: string[];
  stats: Record<string, string | number>;
  result: ConvertResult | null;
  error: string | null;
  cancelled: boolean;
  pdf_path: string | null;
  pdf_title: string | null;
  paper_id: number | null;
}

// Stages shown for upload-convert flow
const CONVERT_STAGES = [
  { key: "extracting",    label: "PDF extraction",   color: "text-cyan-500" },
  { key: "preprocessing", label: "Pre-cleaning",      color: "text-purple-500" },
  { key: "curating",      label: "LLM curation",      color: "text-lime-500" },
  { key: "synthesizing",  label: "TTS synthesis",     color: "text-rose-500" },
  { key: "saving",        label: "Saving to library", color: "text-cyan-500" },
  { key: "done",          label: "Complete",          color: "text-lime-500" },
];

// Stages shown for research-convert flow (two extra stages at the start)
const RESEARCH_STAGES = [
  { key: "searching",     label: "Searching ArXiv",  color: "text-cyan-500" },
  { key: "downloading",   label: "Downloading PDF",  color: "text-cyan-500" },
  ...CONVERT_STAGES,
];

type Tab = "configuration" | "convert" | "research";

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

  const accentBorder  = accent === "lime" ? "border-lime-500/40"  : "border-rose-500/40";
  const accentHoverBorder = accent === "lime" ? "hover:border-lime-500/70" : "hover:border-rose-500/70";
  const accentSelBg   = accent === "lime" ? "bg-lime-950" : "bg-rose-950";
  const accentSelTxt  = accent === "lime" ? "text-lime-400"  : "text-rose-400";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-1 rounded border px-2 py-1.5 text-xs transition-colors
          ${isDark ? "bg-transparent text-white" : "bg-transparent text-black"}
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
            isDark ? "bg-zinc-900 border-white/10" : "bg-white border-black/10"
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

// ────────────────────────────────── ConfigurationPanel

interface ConfigPanelProps {
  theme: Theme;
  sttModel: string; setSttModel: (v: string) => void;
  llm1Provider: LLMProvider; setLlm1Provider: (v: LLMProvider) => void;
  llm1Model: string; setLlm1Model: (v: string) => void;
  llm2Provider: LLMProvider; setLlm2Provider: (v: LLMProvider) => void;
  llm2Model: string; setLlm2Model: (v: string) => void;
  ttsBackend: string; setTtsBackend: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}

function ConfigurationPanel({
  theme, sttModel, setSttModel,
  llm1Provider, setLlm1Provider, llm1Model, setLlm1Model,
  llm2Provider, setLlm2Provider, llm2Model, setLlm2Model,
  ttsBackend, setTtsBackend,
  onSave, saving, saved,
}: ConfigPanelProps) {
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

    // STT elbow into LLM1 top
    const midY1 = sttB.y + (llm1T.y - sttB.y) / 2;

    // LLM1 bottom → ArXiv top  (LLM spans cols 2-3, ArXiv is at col 2)
    const midY2 = llm1B.y + (arxivT.y - llm1B.y) / 2;

    // ArXiv → Prep top-left area
    const prepTL = { x: prepR.x + prepR.w * 0.30, y: prepR.y };
    const midY3  = arxivB.y + (prepTL.y - arxivB.y) / 2;

    // PDF → Prep top-right area
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
        <Icon icon={PROVIDER_ICONS[provider]} className="w-4 h-4" />
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
        <div className="grid gap-6 relative z-10">

          {/* Row 1 — STT + Text: full width, each 50% */}
          <div className="grid grid-cols-2 gap-4">
            <div ref={sttRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <img src={systranLogo} alt="Systran" className="w-4 h-4 object-contain" />
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

          {/* Row 2 — LLM 1: left-aligned (same column as STT above) */}
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
                <img src={arxivLogo} alt="ArXiv" className="w-4 h-4 object-contain" />
                <span className="text-xs font-semibold">ArXiv</span>
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

          {/* Row 4 — Preprocessing: centered (col1 empty, col-span-2, col4 empty) */}
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
                  {ttsBackend === "kokoro" ? (
                    <img src={hexgradLogo} alt="Kokoro" className="w-4 h-4 object-contain rounded" />
                  ) : ttsBackend === "edge-tts" ? (
                    <Icon icon="logos:microsoft-icon" className="w-4 h-4" />
                  ) : (
                    <Icon icon="logos:openai-icon" className="w-4 h-4" />
                  )}
                  <span className="text-xs font-semibold">TTS</span>
                  <span className={`text-xs ${dimText}`}>Text to Speech</span>
                </div>
                <p className={`text-xs ${dimText} mb-1`}>Engine</p>
                <CustomSelect isDark={isDark} accent="lime" value={ttsBackend} options={TTS_BACKENDS} onChange={setTtsBackend} />
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
          {saving ? "Saving…" : "Save configuration"}
        </button>
        {saved && (
          <span className={`flex items-center gap-1 text-xs text-lime-500`}>
            <Icon icon="mdi:check-circle" className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

interface ArxivResult {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  pdf_url: string;
  published: string;
}

// ────────────────────────────────── Waveform component

function AudioWaveform({
  audioRef,
  isDark,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isDark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setup = () => {
      if (ctxRef.current) return; // already set up
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      ctxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    };

    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLen);
      analyser.getByteFrequencyData(data);

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const barW = (W / bufferLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLen; i++) {
        const barH = (data[i] / 255) * H;
        // Use a lime → cyan gradient for bars
        const ratio = i / bufferLen;
        const r = Math.round(50 + ratio * 30);
        const g = Math.round(200 + ratio * 55);
        const b = Math.round(100 + ratio * 155);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, H - barH, barW, barH);
        x += barW + 1;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    audio.addEventListener("play", setup);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      audio.removeEventListener("play", setup);
      cancelAnimationFrame(animRef.current);
    };
  }, [audioRef]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={56}
      className="w-full rounded"
      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }}
    />
  );
}

// ────────────────────────────────── Audio Player component

function AudioPlayer({
  audio,
  theme,
  onClose,
}: {
  audio: AudioEntry;
  theme: Theme;
  onClose: () => void;
}) {
  const isDark = theme === "dark";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const border = isDark ? "border-white/10" : "border-black/10";

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`border-t ${border} px-6 py-4`}>
      <audio
        ref={audioRef}
        src={audio.download_url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) =>
          setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)
        }
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        preload="metadata"
      />

      {/* Title row */}
      <div className="flex items-center gap-3 mb-3">
        <Icon icon="mdi:headphones" className="w-4 h-4 text-lime-500 shrink-0" />
        <span className="text-xs flex-1 truncate">{audio.filename}</span>
        <span className={`text-xs ${isDark ? "text-white/30" : "text-black/30"}`}>
          {audio.tts_voice || audio.tts_backend}
        </span>
        <button
          onClick={onClose}
          className={`p-1 rounded ${isDark ? "hover:bg-white/10 text-white/40" : "hover:bg-black/10 text-black/40"} hover:text-rose-500 transition-colors`}
        >
          <Icon icon="mdi:close" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Waveform */}
      <AudioWaveform audioRef={audioRef} isDark={isDark} />

      {/* Controls */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={toggle}
          className="p-2 rounded-full bg-lime-500/10 hover:bg-lime-500/20 text-lime-500 transition-colors"
        >
          <Icon icon={playing ? "mdi:pause" : "mdi:play"} className="w-5 h-5" />
        </button>

        {/* Scrubber */}
        <div className="flex-1 flex items-center gap-2">
          <span className={`text-xs ${isDark ? "text-white/30" : "text-black/30"} tabular-nums w-10`}>
            {fmt((progress / 100) * duration)}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => {
              const el = audioRef.current;
              if (!el) return;
              el.currentTime = (parseFloat(e.target.value) / 100) * el.duration;
            }}
            className="flex-1 accent-lime-500 h-1 cursor-pointer"
          />
          <span className={`text-xs ${isDark ? "text-white/30" : "text-black/30"} tabular-nums w-10 text-right`}>
            {fmt(duration)}
          </span>
        </div>

        {/* Download */}
        <a
          href={audio.download_url}
          download={audio.filename}
          className={`p-1 rounded ${isDark ? "hover:bg-white/10 text-white/40" : "hover:bg-black/10 text-black/40"} hover:text-cyan-500 transition-colors`}
          title="Download"
        >
          <Icon icon="mdi:download" className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// ────────────────────────────────── ConversionProgress component

function ConversionProgress({
  jobId,
  theme,
  onDone,
  jobApiBase,
  stages,
  onSetPreview,
}: {
  jobId: string;
  theme: Theme;
  onDone: (result: ConvertResult) => void;
  jobApiBase: string;   // e.g. "/api/convert" or "/api/research"
  stages: typeof CONVERT_STAGES;
  onSetPreview: (p: { url: string; title: string } | null) => void;
}) {
  const isDark = theme === "dark";
  const [job, setJob] = useState<JobStatus | null>(null);
  const dimText = isDark ? "text-white/40" : "text-black/40";
  const logRef = useRef<HTMLDivElement>(null);
  const previewShown = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const data: JobStatus = await fetch(`${jobApiBase}/status/${jobId}`).then((r) => r.json());
        setJob(data);

        // Show PDF in preview panel as soon as it's available
        if (data.pdf_path && !previewShown.current) {
          previewShown.current = true;
          onSetPreview({
            url: `${jobApiBase}/jobs/${jobId}/pdf`,
            title: data.pdf_title || jobId,
          });
        }

        if (data.status === "done" && data.result) {
          clearInterval(interval);
          onDone(data.result);
        } else if (data.status === "error" || data.status === "cancelled") {
          clearInterval(interval);
        }
      } catch {
        // keep polling
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [jobId, onDone, jobApiBase, onSetPreview]);

  // Auto-scroll log to bottom whenever log grows
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job?.log?.length]);

  if (!job) return null;

  const currentStageIdx = stages.findIndex((s) => s.key === job.stage);

  const handleCancel = async () => {
    await fetch(`${jobApiBase}/jobs/${jobId}`, { method: "DELETE" });
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Header row: stage label + cancel button */}
      <div className="flex items-center gap-3">
        <span className={`text-xs flex-1 ${dimText}`}>{job.stage_label}</span>
        {job.status === "running" && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
          >
            <Icon icon="mdi:cancel" className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className={`h-1 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"} overflow-hidden`}>
        <div
          className={`h-full transition-all duration-700 ${
            job.status === "cancelled" ? "bg-rose-500" :
            job.status === "error" ? "bg-rose-500" : "bg-lime-500"
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* Stage steps */}
      <div className="space-y-1.5">
        {stages.map((stage, idx) => {
          const done = idx < currentStageIdx || job.status === "done";
          const active = stage.key === job.stage && job.status === "running";
          const upcoming = idx > currentStageIdx && job.status === "running";

          return (
            <div key={stage.key} className={`flex items-center gap-3 text-xs ${upcoming ? dimText : ""}`}>
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {done ? (
                  <Icon icon="mdi:check-circle" className="w-4 h-4 text-lime-500" />
                ) : active ? (
                  <Icon icon="mdi:loading" className={`w-4 h-4 ${stage.color} animate-spin`} />
                ) : (
                  <Icon icon="mdi:circle-outline" className="w-4 h-4" />
                )}
              </div>
              <span className={active ? stage.color : ""}>{stage.label}</span>
              {done && stage.key === "extracting" && job.stats.num_pages && (
                <span className={`ml-auto ${dimText}`}>
                  {job.stats.num_pages} pages · {Number(job.stats.raw_chars ?? 0).toLocaleString()} chars
                </span>
              )}
              {done && stage.key === "preprocessing" && job.stats.precleaned_chars && (
                <span className={`ml-auto ${dimText}`}>
                  {Number(job.stats.precleaned_chars).toLocaleString()} chars
                </span>
              )}
              {done && stage.key === "curating" && job.stats.curated_chars && (
                <span className={`ml-auto ${dimText}`}>
                  {Number(job.stats.curated_chars).toLocaleString()} chars
                </span>
              )}
              {done && stage.key === "synthesizing" && job.stats.audio_filename && (
                <span className={`ml-auto ${dimText} truncate max-w-40`}>{job.stats.audio_filename}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal log */}
      {job.log && job.log.length > 0 && (
        <div
          ref={logRef}
          className={`font-mono text-xs rounded p-3 overflow-y-auto max-h-44 space-y-0.5 leading-relaxed
            ${isDark ? "bg-white/3 text-white/60" : "bg-black/3 text-black/60"}`}
        >
          {job.log.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
          ))}
        </div>
      )}

      {job.status === "error" && (
        <div className="flex items-start gap-2 text-xs text-rose-500">
          <Icon icon="mdi:alert-circle" className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{job.error}</span>
        </div>
      )}
      {job.status === "cancelled" && (
        <div className="flex items-center gap-2 text-xs text-rose-400">
          <Icon icon="mdi:cancel" className="w-4 h-4 shrink-0" />
          <span>Conversion cancelled.</span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────── Main component

export default function Main({ theme, activeAudio, setActiveAudio, onConverted, setLivePreviewPdf }: MainProps) {
  const isDark = theme === "dark";
  const border = isDark ? "border-white/10" : "border-black/10";
  const dimText = isDark ? "text-white/40" : "text-black/40";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-black/5";
  const inputBg = isDark ? "bg-white/5 border-white/10 placeholder:text-white/30" : "bg-black/5 border-black/10 placeholder:text-black/30";

  const [tab, setTab] = useState<Tab>("configuration");

  // ── Pipeline config – shared across Configuration / Convert / Research
  const [sttModel,     setSttModel]     = useState<string>(STT_MODELS[0]);
  const [llm1Provider, setLlm1Provider] = useState<LLMProvider>(PROVIDERS[0]);
  const [llm1Model,    setLlm1Model]    = useState(PROVIDER_MODELS[PROVIDERS[0]][0]);
  const [llm2Provider, setLlm2Provider] = useState<LLMProvider>(PROVIDERS[0]);
  const [llm2Model,    setLlm2Model]    = useState(PROVIDER_MODELS[PROVIDERS[0]][0]);
  const [ttsBackend,   setTtsBackend]   = useState<string>(TTS_BACKENDS[0]);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved,  setConfigSaved]  = useState(false);

  // Load persisted config on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Record<string, string>) => {
        if (d.stt_model)     setSttModel(d.stt_model);
        if (d.llm1_provider) setLlm1Provider(d.llm1_provider as LLMProvider);
        if (d.llm1_model)    setLlm1Model(d.llm1_model);
        if (d.llm2_provider) setLlm2Provider(d.llm2_provider as LLMProvider);
        if (d.llm2_model)    setLlm2Model(d.llm2_model);
        if (d.tts_backend)   setTtsBackend(d.tts_backend);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stt_model:    sttModel,
          llm1_provider: llm1Provider,
          llm1_model:   llm1Model,
          llm2_provider: llm2Provider,
          llm2_model:   llm2Model,
          tts_backend:  ttsBackend,
        }),
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } finally {
      setConfigSaving(false);
    }
  };

  // ── Convert tab state
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Research tab state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ArxivResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [researchJobs, setResearchJobs] = useState<Array<{ arxiv_id: string; job_id: string }>>([]);
  const [recording,       setRecording]       = useState(false);
  const [normalizing,     setNormalizing]     = useState(false);
  const [normalizedQuery, setNormalizedQuery] = useState<string | null>(null);
  const [normalizeError,  setNormalizeError]  = useState<string | null>(null);
  const [hasSearched,     setHasSearched]     = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".pdf")) setFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setJobId(null);
    setConvertResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("tts_backend",  ttsBackend);
    form.append("llm_provider", llm1Provider);
    form.append("llm_model",    llm1Model);
    try {
      const res = await fetch("/api/convert/enqueue", { method: "POST", body: form });
      const data = await res.json();
      setJobId(data.job_id);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleConvertDone = useCallback(
    (result: ConvertResult) => {
      setConvertResult(result);
      onConverted();
      // Build a synthetic AudioEntry to auto-play
      setActiveAudio({
        id: result.audio_id,
        paper_id: result.paper_id,
        filename: result.audio_filename,
        download_url: result.download_url,
        tts_backend: "",
        tts_voice: "",
        created_at: new Date().toISOString(),
      });
    },
    [onConverted, setActiveAudio]
  );

  const handleNormalize = async () => {
    if (!query.trim()) return;
    setNormalizing(true);
    setNormalizedQuery(null);
    setNormalizeError(null);
    setResults([]);
    try {
      const res = await fetch("/api/research/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, llm_provider: llm1Provider, llm_model: llm1Model }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNormalizeError(err.detail ?? `Server error ${res.status}`);
      } else {
        const data = await res.json();
        setNormalizedQuery(data.search_string ?? query);
      }
    } catch (e) {
      setNormalizeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setNormalizing(false);
    }
  };

  // rawQuery: pass explicit string for a direct search (bypasses normalization)
  const handleSearch = async (rawQuery?: string) => {
    const q = rawQuery !== undefined ? rawQuery : (normalizedQuery ?? query);
    if (!q.trim()) return;
    if (rawQuery !== undefined) { setNormalizedQuery(null); setNormalizeError(null); }
    setSearching(true);
    setHasSearched(true);
    setResults([]);
    try {
      const res = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, max_results: 10 }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleResearchEnqueue = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch("/api/research/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arxiv_ids:    Array.from(selectedIds),
        llm_provider: llm1Provider,
        llm_model:    llm1Model,
        tts_backend:  ttsBackend,
      }),
    });
    const data = await res.json();
    if (data.jobs) {
      setResearchJobs((prev) => [...prev, ...data.jobs]);
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("file", blob, "recording.webm");
        try {
          const res = await fetch("/api/research/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (data.text) setQuery(data.text);
        } catch { /* silent – transcription failed */ }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { /* mic denied or unavailable */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className={`flex items-center gap-1 px-6 pt-4 pb-0 border-b ${border}`}>
        {([
          { id: "configuration", label: "Configuration", icon: "mdi:tune-vertical" },
          { id: "convert",       label: "Convert",       icon: "mdi:file-arrow-up-down" },
          { id: "research",      label: "Research",      icon: "mdi:magnify" },
        ] as Array<{ id: Tab; label: string; icon: string }>).map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors border-b-2 -mb-px ${
                active
                  ? "border-rose-500 text-rose-500"
                  : `border-transparent ${dimText} ${hoverBg}`
              }`}
            >
              <Icon icon={icon} className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* ── Configuration tab ── */}
        {tab === "configuration" && (
          <ConfigurationPanel
            theme={theme}
            sttModel={sttModel}         setSttModel={setSttModel}
            llm1Provider={llm1Provider} setLlm1Provider={setLlm1Provider}
            llm1Model={llm1Model}       setLlm1Model={setLlm1Model}
            llm2Provider={llm2Provider} setLlm2Provider={setLlm2Provider}
            llm2Model={llm2Model}       setLlm2Model={setLlm2Model}
            ttsBackend={ttsBackend}     setTtsBackend={setTtsBackend}
            onSave={handleSaveConfig}
            saving={configSaving}
            saved={configSaved}
          />
        )}

        {/* ── Convert tab ── */}
        {tab === "convert" && (
          <div className="max-w-2xl mx-auto">
            <p className={`text-xs ${dimText} mb-6`}>
              Upload a PDF to extract, clean with LLM, and synthesise to audio.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded p-10 cursor-pointer transition-all
                ${dragging
                  ? "border-lime-500 bg-lime-500/5"
                  : file
                  ? "border-rose-500/40 bg-rose-500/5"
                  : isDark ? "border-white/15 hover:border-white/30" : "border-black/15 hover:border-black/30"
                }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setJobId(null);
                    setConvertResult(null);
                  }
                }}
              />
              <Icon
                icon={file ? "bi:file-earmark-pdf-fill" : "mdi:upload"}
                className={`w-10 h-10 ${file ? "text-rose-500" : dimText}`}
              />
              {file ? (
                <div className="text-center">
                  <p className="text-sm text-rose-500">{file.name}</p>
                  <p className={`text-xs ${dimText} mt-1`}>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm">Drop a PDF here</p>
                  <p className={`text-xs ${dimText} mt-1`}>or click to browse</p>
                </div>
              )}
            </div>

            {/* Convert button */}
            {file && !jobId && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-500 rounded text-sm transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon icon="mdi:play" className="w-4 h-4" />
                )}
                {uploading ? "Uploading…" : "Convert to audio"}
              </button>
            )}

            {/* Reset – only when conversion is complete */}
            {(file && convertResult) && (
              <button
                onClick={() => { setFile(null); setJobId(null); setConvertResult(null); }}
                className={`mt-3 text-xs ${dimText} hover:text-rose-500 transition-colors flex items-center gap-1`}
              >
                <Icon icon="mdi:refresh" className="w-3.5 h-3.5" />
                Convert another file
              </button>
            )}

            {/* Progress */}
            {jobId && !convertResult && (
              <ConversionProgress
                jobId={jobId}
                theme={theme}
                onDone={handleConvertDone}
                jobApiBase="/api/convert"
                stages={CONVERT_STAGES}
                onSetPreview={setLivePreviewPdf}
              />
            )}

            {/* Done message */}
            {convertResult && (
              <div className="mt-4 flex items-center gap-2 text-xs text-lime-500">
                <Icon icon="mdi:check-circle" className="w-4 h-4" />
                <span>{convertResult.title} — {convertResult.num_pages} pages converted. See player below.</span>
              </div>
            )}
          </div>
        )}

        {/* ── Research tab ── */}
        {tab === "research" && (
          <div className="max-w-2xl mx-auto">
            <p className={`text-xs ${dimText} mb-6`}>
              Search arXiv for papers, select them, and convert to audio.
            </p>

            {/* Search input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setNormalizedQuery(null); setNormalizeError(null); setHasSearched(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. Architectural designs in agentic AI"
                className={`flex-1 bg-transparent border ${inputBg} rounded px-3 py-2 text-sm outline-none focus:border-cyan-500 transition-colors`}
              />
              <button
                onClick={recording ? stopRecording : startRecording}
                title={recording ? "Stop recording" : "Record voice query"}
                className={`px-3 py-2 rounded border text-sm transition-colors flex items-center ${
                  recording
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse"
                    : "bg-lime-500/10 hover:bg-lime-500/20 border-lime-500/30 text-lime-500"
                }`}
              >
                <Icon icon={recording ? "mdi:stop" : "mdi:microphone"} className="w-4 h-4" />
              </button>
              {/* LLM-assisted normalise */}
              <button
                onClick={handleNormalize}
                disabled={normalizing || searching || !query.trim()}
                title="Rewrite query with LLM for better ArXiv results"
                className={`px-3 py-2 rounded border text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                  isDark
                    ? "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-400"
                    : "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-700"
                }`}
              >
                {normalizing ? (
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon icon="hugeicons:ai-brain-03" className="w-4 h-4" />
                )}
                Normalize query
              </button>
            </div>

            {/* Normalize spinner */}
            {normalizing && (
              <div className={`mt-3 flex items-center gap-2 text-xs ${dimText}`}>
                <Icon icon="mdi:loading" className="w-3.5 h-3.5 animate-spin" />
                Normalising query with LLM…
              </div>
            )}

            {/* Normalize error */}
            {!normalizing && normalizeError !== null && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded border text-xs ${
                isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-rose-400/50 bg-rose-50 text-rose-700"
              }`}>
                <Icon icon="mdi:alert-circle-outline" className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">LLM normalization failed: {normalizeError}</span>
                <button onClick={() => setNormalizeError(null)} className="opacity-60 hover:opacity-100 transition-opacity">
                  <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* LLM normalization confirmation pane */}
            {!normalizing && normalizedQuery !== null && (
              <div className={`mt-3 p-3 rounded border ${
                isDark ? "border-purple-500/30 bg-purple-500/5" : "border-purple-300/50 bg-purple-50"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-xs font-medium ${
                    isDark ? "text-purple-400" : "text-purple-700"
                  }`}>LLM-normalised — edit if needed:</p>
                  <button
                    onClick={() => setNormalizedQuery(null)}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    title="Dismiss"
                  >
                    <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  value={normalizedQuery}
                  onChange={(e) => setNormalizedQuery(e.target.value)}
                  rows={2}
                  className={`w-full bg-transparent border ${
                    isDark ? "border-white/20" : "border-black/20"
                  } rounded px-2.5 py-1.5 text-sm outline-none focus:border-cyan-500 resize-none transition-colors`}
                />
              </div>
            )}

            {/* Search ArXiv button — always present below input/pane */}
            <button
              onClick={() => handleSearch()}
              disabled={searching || normalizing || !query.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-500 rounded text-sm transition-colors disabled:opacity-50"
            >
              {searching ? (
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
              ) : (
                <Icon icon="mdi:magnify" className="w-4 h-4" />
              )}
              Search arXiv
            </button>

            {/* Results */}
            {results.length > 0 && (
              <>
                <div className="mt-4 space-y-3">
                  {results.map((r) => (
                    <div
                      key={r.arxiv_id}
                      onClick={() => toggleSelect(r.arxiv_id)}
                      className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${
                        selectedIds.has(r.arxiv_id)
                          ? "border-purple-500/50 bg-purple-500/5"
                          : `${isDark ? "border-white/10 hover:border-white/20" : "border-black/10 hover:border-black/20"}`
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        selectedIds.has(r.arxiv_id) ? "bg-purple-500 border-purple-500" : isDark ? "border-white/20" : "border-black/20"
                      }`}>
                        {selectedIds.has(r.arxiv_id) && (
                          <Icon icon="mdi:check" className="w-3 h-3 text-black" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug">{r.title}</p>
                        <p className={`text-xs ${dimText} mt-0.5`}>{r.authors.slice(0, 3).join(", ")}{r.authors.length > 3 ? " et al." : ""}</p>
                        <p className={`text-xs ${dimText} mt-1 line-clamp-2`}>{r.abstract}</p>
                        <div className={`flex items-center gap-3 mt-1.5 text-xs ${dimText}`}>
                          <span>{r.published?.slice(0, 10)}</span>
                          <a
                            href={r.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-cyan-500 transition-colors"
                          >
                            <Icon icon="mdi:open-in-new" className="w-3 h-3" />
                            PDF
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Convert selected */}
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleResearchEnqueue}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-500 rounded text-sm transition-colors"
                  >
                    <Icon icon="mdi:headphones" className="w-4 h-4" />
                    Convert {selectedIds.size} selected paper{selectedIds.size > 1 ? "s" : ""} to audio
                  </button>
                )}

                {/* Research job progress panels */}
                {researchJobs.map(({ arxiv_id, job_id }) => (
                  <div key={job_id} className={`mt-4 p-4 rounded border ${isDark ? "border-white/10" : "border-black/10"}`}>
                    <p className={`text-xs ${dimText} mb-1 truncate`} title={arxiv_id}>{arxiv_id}</p>
                    <ConversionProgress
                      jobId={job_id}
                      theme={theme}
                      onDone={(result) => {
                        onConverted();
                        setActiveAudio({
                          id: result.audio_id,
                          paper_id: result.paper_id,
                          filename: result.audio_filename,
                          download_url: result.download_url,
                          tts_backend: "",
                          tts_voice: "",
                          created_at: new Date().toISOString(),
                        });
                      }}
                      jobApiBase="/api/research"
                      stages={RESEARCH_STAGES}
                      onSetPreview={setLivePreviewPdf}
                    />
                  </div>
                ))}
              </>
            )}

            {!searching && results.length === 0 && hasSearched && (
              <p className={`text-xs ${dimText} mt-4`}>No results found.</p>
            )}
          </div>
        )}
      </div>

      {/* Audio player (full width, pinned to bottom) */}
      {activeAudio && (
        <AudioPlayer audio={activeAudio} theme={theme} onClose={() => setActiveAudio(null)} />
      )}
    </div>
  );
}
