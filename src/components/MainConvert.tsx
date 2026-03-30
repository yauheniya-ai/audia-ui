import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import type { AudioEntry, ConvertResult, LivePreview, Theme } from "../App";
import type { LLMProvider } from "../constants";

// ────────────────────────────────── Stage definitions

export const CONVERT_STAGES = [
  { key: "extracting",    label: "PDF extraction",   color: "text-cyan-500" },
  { key: "preprocessing", label: "Pre-cleaning",      color: "text-purple-500" },
  { key: "curating",      label: "LLM curation",      color: "text-lime-500" },
  { key: "synthesizing",  label: "TTS synthesis",     color: "text-rose-500" },
  { key: "saving",        label: "Saving to library", color: "text-cyan-500" },
  { key: "done",          label: "Complete",          color: "text-lime-500" },
];

// ────────────────────────────────── JobStatus

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

// ────────────────────────────────── ConversionProgress

export function ConversionProgress({
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
  jobApiBase: string;
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

      <div className={`h-1 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"} overflow-hidden`}>
        <div
          className={`h-full transition-all duration-700 ${
            job.status === "cancelled" ? "bg-rose-500" :
            job.status === "error"     ? "bg-rose-500" : "bg-lime-500"
          }`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {stages.map((stage, idx) => {
          const done     = idx < currentStageIdx || job.status === "done";
          const active   = stage.key === job.stage && job.status === "running";
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

// ────────────────────────────────── AudioWaveform

function AudioWaveform({
  audioRef,
  isDark,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isDark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef    = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setup = () => {
      if (ctxRef.current) return;
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      ctxRef.current    = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current  = source;
    };

    const draw = () => {
      const canvas  = canvasRef.current;
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

// ────────────────────────────────── AudioPlayer

export function AudioPlayer({
  audio,
  theme,
  onClose,
}: {
  audio: AudioEntry;
  theme: Theme;
  onClose: () => void;
}) {
  const isDark   = theme === "dark";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const border = isDark ? "border-white/10" : "border-black/10";

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    playing ? el.pause() : el.play();
  };

  const fmt = (s: number) => {
    const m   = Math.floor(s / 60);
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

// ────────────────────────────────── MainConvert

export interface MainConvertProps {
  theme: Theme;
  ttsBackend: string;
  llm1Provider: LLMProvider;
  llm1Model: string;
  onConverted: () => void;
  setActiveAudio: (a: AudioEntry | null) => void;
  setLivePreviewPdf: (p: LivePreview | null) => void;
}

export function MainConvert({
  theme,
  ttsBackend,
  llm1Provider,
  llm1Model,
  onConverted,
  setActiveAudio,
  setLivePreviewPdf,
}: MainConvertProps) {
  const isDark   = theme === "dark";
  const dimText  = isDark ? "text-white/40" : "text-black/40";

  const [dragging,       setDragging]       = useState(false);
  const [file,           setFile]           = useState<File | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [jobId,          setJobId]          = useState<string | null>(null);
  const [convertResult,  setConvertResult]  = useState<ConvertResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    form.append("file",         file);
    form.append("tts_backend",  ttsBackend);
    form.append("llm_provider", llm1Provider);
    form.append("llm_model",    llm1Model);
    try {
      const res  = await fetch("/api/convert/enqueue", { method: "POST", body: form });
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

  return (
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

      {/* Reset */}
      {file && convertResult && (
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
  );
}
