import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import type { AudioEntry, ConvertResult, LivePreview, Theme } from "../App";

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

// ────────────────────────────────── Configuration constants

type LLMProvider = "Anthropic" | "OpenAI" | "Google" | "Mistral";

const LLM_PROVIDERS: LLMProvider[] = ["Anthropic", "OpenAI", "Google", "Mistral"];

const LLM_MODELS: Record<LLMProvider, string[]> = {
  Anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  OpenAI: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  Google: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
  Mistral: ["mistral-large", "mistral-small"],
};

const STT_MODELS = ["whisper-large-v3", "whisper-medium", "whisper-small"];
const TTS_MODELS = ["edge-tts", "coqui-xtts", "piper", "kokoro"];

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
const rtC  = (r: CardRectData) => ({ x: r.x + r.w, y: r.y + r.h / 2 });
const pts  = (...ps: Array<{ x: number; y: number }>) => ps.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');

// ────────────────────────────────── ConfigurationPanel

function ConfigurationPanel({ theme }: { theme: Theme }) {
  const isDark = theme === "dark";
  const cardBg  = isDark ? "bg-zinc-900/80" : "bg-white";
  const dimText = isDark ? "text-white/40"  : "text-black/40";
  const selectCls = `rounded border px-2 py-1.5 text-xs w-full ${
    isDark ? "bg-zinc-800 border-white/10 text-white" : "bg-gray-50 border-black/10 text-black"
  }`;

  const [sttModel,     setSttModel]     = useState(STT_MODELS[0]);
  const [llm1Provider, setLlm1Provider] = useState<LLMProvider>("Anthropic");
  const [llm1Model,    setLlm1Model]    = useState(LLM_MODELS["Anthropic"][0]);
  const [llm2Provider, setLlm2Provider] = useState<LLMProvider>("Anthropic");
  const [llm2Model,    setLlm2Model]    = useState(LLM_MODELS["Anthropic"][0]);
  const [ttsModel,     setTtsModel]     = useState(TTS_MODELS[0]);

  const containerRef = useRef<HTMLDivElement>(null);
  const sttRef  = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pdfRef  = useRef<HTMLDivElement>(null);
  const llm1Ref = useRef<HTMLDivElement>(null);
  const prepRef = useRef<HTMLDivElement>(null);
  const llm2Ref = useRef<HTMLDivElement>(null);
  const ttsRef  = useRef<HTMLDivElement>(null);

  const [lines, setLines] = useState<DiagramLine[]>([]);
  const [rects, setRects] = useState<DiagramRect[]>([]);

  const updateDiagram = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const allRefs = [sttRef, textRef, pdfRef, llm1Ref, prepRef, llm2Ref, ttsRef];
    if (allRefs.some(r => !r.current)) return;

    const sttR  = getRelRect(sttRef.current!,  container);
    const textR = getRelRect(textRef.current!, container);
    const pdfR  = getRelRect(pdfRef.current!,  container);
    const llm1R = getRelRect(llm1Ref.current!, container);
    const prepR = getRelRect(prepRef.current!, container);
    const llm2R = getRelRect(llm2Ref.current!, container);
    const ttsR  = getRelRect(ttsRef.current!,  container);

    const gap = 18;

    // STT → LLM1 (elbow)
    const sttB  = btmC(sttR);
    const llm1T = topC(llm1R);
    const midY1 = sttB.y + (llm1T.y - sttB.y) / 2;

    // Text → LLM1 (elbow)
    const txtB = btmC(textR);

    // PDF → Preprocessing (right-side entry)
    const pdfB  = btmC(pdfR);
    const prepRt = rtC(prepR);
    const rightX = prepRt.x + gap;

    const newLines: DiagramLine[] = [
      {
        id: "stt-llm1",
        color: LIME_HEX,
        points: pts(sttB, { x: sttB.x, y: midY1 }, { x: llm1T.x, y: midY1 }, llm1T),
      },
      {
        id: "txt-llm1",
        color: ROSE_HEX,
        points: pts(txtB, { x: txtB.x, y: midY1 }, { x: llm1T.x, y: midY1 }, llm1T),
      },
      {
        id: "llm1-prep",
        color: ROSE_HEX,
        points: pts(btmC(llm1R), topC(prepR)),
      },
      {
        id: "pdf-prep",
        color: ROSE_HEX,
        points: pts(
          pdfB,
          { x: pdfB.x, y: prepRt.y },
          { x: rightX, y: prepRt.y },
          prepRt,
        ),
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
      { id: "r-stt",  rect: sttR,  color: LIME_HEX },
      { id: "r-txt",  rect: textR, color: ROSE_HEX },
      { id: "r-pdf",  rect: pdfR,  color: ROSE_HEX },
      { id: "r-llm1", rect: llm1R, color: ROSE_HEX },
      { id: "r-prep", rect: prepR, color: ROSE_HEX },
      { id: "r-llm2", rect: llm2R, color: ROSE_HEX },
      { id: "r-tts",  rect: ttsR,  color: LIME_HEX },
    ];

    setLines(newLines);
    setRects(newRects);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(updateDiagram));
    const t = setTimeout(updateDiagram, 120);
    window.addEventListener("resize", updateDiagram);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateDiagram);
    };
  }, [updateDiagram]);

  const LLMCard = ({
    label, cardRef, provider, model,
    onProvider, onModel,
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
        <Icon icon="mdi:brain" className="w-4 h-4 text-rose-500" />
        <span className="text-xs font-semibold">LLM</span>
        <span className={`text-xs ${dimText}`}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={`text-xs ${dimText} mb-1`}>Provider</p>
          <select
            className={selectCls}
            value={provider}
            onChange={e => {
              const p = e.target.value as LLMProvider;
              onProvider(p);
              onModel(LLM_MODELS[p][0]);
            }}
          >
            {LLM_PROVIDERS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <p className={`text-xs ${dimText} mb-1`}>Model</p>
          <select
            className={selectCls}
            value={model}
            onChange={e => onModel(e.target.value)}
          >
            {LLM_MODELS[provider].map(m => <option key={m}>{m}</option>)}
          </select>
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
        {/* ── Animated SVG overlay (borders + connectors) ── */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker id="arrowRose" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={ROSE_HEX} opacity="0.85" />
            </marker>
            <marker id="arrowLime" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={LIME_HEX} opacity="0.85" />
            </marker>
          </defs>

          {/* Animated card outlines */}
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
              <animate
                attributeName="stroke-dashoffset"
                from="48"
                to="0"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </rect>
          ))}

          {/* Animated connector lines */}
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
              <animate
                attributeName="stroke-dashoffset"
                from="40"
                to="0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </polyline>
          ))}
        </svg>

        {/* ── Cards grid ── */}
        <div className="grid gap-6 relative z-10">

          {/* Row 1 — Inputs */}
          <div className="grid grid-cols-3 gap-4">
            {/* LEFT: STT + Text */}
            <div className="col-span-2 grid grid-cols-2 gap-4">
              {/* STT */}
              <div ref={sttRef} className={`rounded-lg p-4 ${cardBg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="mdi:microphone" className="w-4 h-4 text-lime-500" />
                  <span className="text-xs font-semibold">STT</span>
                  <span className={`text-xs ${dimText}`}>Speech to Text</span>
                </div>
                <p className={`text-xs ${dimText} mb-1`}>Model</p>
                <select
                  className={selectCls}
                  value={sttModel}
                  onChange={e => setSttModel(e.target.value)}
                >
                  {STT_MODELS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Text */}
              <div ref={textRef} className={`rounded-lg p-4 ${cardBg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="mdi:text-box-outline" className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-semibold">Text</span>
                  <span className={`text-xs ${dimText}`}>Direct input</span>
                </div>
                <p className={`text-xs ${dimText} text-xs leading-relaxed`}>
                  Paste or type raw text as input to the pipeline.
                </p>
              </div>
            </div>

            {/* RIGHT: PDF */}
            <div ref={pdfRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="bi:file-earmark-pdf-fill" className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">PDF</span>
                <span className={`text-xs ${dimText}`}>Document upload</span>
              </div>
              <p className={`text-xs ${dimText} leading-relaxed`}>
                Upload a PDF — text is extracted automatically and skips the STT/Text LLM step.
              </p>
            </div>
          </div>

          {/* Row 2 — LLM 1 (STT / Text path) */}
          <div className="max-w-xs w-full" style={{ marginLeft: "calc(25% - 3rem)" }}>
            <LLMCard
              label="Research string normalisation"
              cardRef={llm1Ref}
              provider={llm1Provider}
              model={llm1Model}
              onProvider={setLlm1Provider}
              onModel={setLlm1Model}
            />
          </div>

          {/* Row 3 — Preprocessing */}
          <div className="max-w-xs mx-auto w-full">
            <div ref={prepRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="mdi:cog-outline" className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">Preprocessing</span>
              </div>
              <p className={`text-xs ${dimText} leading-relaxed`}>
                Text cleaning, sentence chunking and normalisation before synthesis.
              </p>
            </div>
          </div>

          {/* Row 4 — LLM 2 (content curation) */}
          <div className="max-w-xs mx-auto w-full">
            <LLMCard
              label="Content curation"
              cardRef={llm2Ref}
              provider={llm2Provider}
              model={llm2Model}
              onProvider={setLlm2Provider}
              onModel={setLlm2Model}
            />
          </div>

          {/* Row 5 — TTS */}
          <div className="max-w-xs mx-auto w-full">
            <div ref={ttsRef} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:waveform" className="w-4 h-4 text-lime-500" />
                <span className="text-xs font-semibold">TTS</span>
                <span className={`text-xs ${dimText}`}>Text to Speech</span>
              </div>
              <p className={`text-xs ${dimText} mb-1`}>Model</p>
              <select
                className={selectCls}
                value={ttsModel}
                onChange={e => setTtsModel(e.target.value)}
              >
                {TTS_MODELS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

        </div>{/* /grid */}
      </div>{/* /relative container */}
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

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_results: 10 }),
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
      body: JSON.stringify({ arxiv_ids: Array.from(selectedIds) }),
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
          <ConfigurationPanel theme={theme} />
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
              Search ArXiv for papers, select them, and convert to audio.
            </p>

            {/* Search input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. Architectural designs in agentic AI"
                className={`flex-1 bg-transparent border ${inputBg} rounded px-3 py-2 text-sm outline-none focus:border-cyan-500 transition-colors`}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-500 rounded text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {searching ? (
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon icon="mdi:magnify" className="w-4 h-4" />
                )}
                Search
              </button>
            </div>

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

            {!searching && results.length === 0 && query && (
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
