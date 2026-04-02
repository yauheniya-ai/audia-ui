import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { AudioEntry, LivePreview, Theme } from "../App";
import type { LLMProvider } from "../constants";
import { ConversionProgress, CONVERT_STAGES } from "./MainConvert";

// ────────────────────────────────── Stage definitions

export const RESEARCH_STAGES = [
  { key: "searching",   label: "Searching ArXiv", color: "text-cyan-500" },
  { key: "downloading", label: "Downloading PDF",  color: "text-cyan-500" },
  ...CONVERT_STAGES,
];

// ────────────────────────────────── Types

interface ArxivResult {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  pdf_url: string;
  published: string;
}

// ────────────────────────────────── MainResearch

export interface MainResearchProps {
  theme: Theme;
  llm1Provider: LLMProvider;
  llm1Model: string;
  ttsBackend: string;
  ttsVoice: string;
  onConverted: () => void;
  setActiveAudio: (a: AudioEntry | null) => void;
  setLivePreviewPdf: (p: LivePreview | null) => void;
}

export function MainResearch({
  theme,
  llm1Provider,
  llm1Model,
  ttsBackend,
  ttsVoice,
  onConverted,
  setActiveAudio,
  setLivePreviewPdf,
}: MainResearchProps) {
  const isDark   = theme === "dark";
  const dimText  = isDark ? "text-white/40" : "text-black/40";
  const inputBg  = isDark
    ? "bg-white/5 border-white/10 placeholder:text-white/30"
    : "bg-black/5 border-black/10 placeholder:text-black/30";

  const [query,          setQuery]          = useState("");
  const [searching,      setSearching]      = useState(false);
  const [results,        setResults]        = useState<ArxivResult[]>([]);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [researchJobs,   setResearchJobs]   = useState<Array<{ arxiv_id: string; job_id: string }>>([]);
  const [runningJobIds,  setRunningJobIds]  = useState<Set<string>>(new Set());
  const [recording,      setRecording]      = useState(false);
  const [normalizing,    setNormalizing]    = useState(false);
  const [normalizedQuery, setNormalizedQuery] = useState<string | null>(null);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);
  const [hasSearched,    setHasSearched]    = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  // rawQuery: pass an explicit string to bypass normalization
  const handleSearch = async (rawQuery?: string) => {
    const q = rawQuery !== undefined ? rawQuery : (normalizedQuery ?? query);
    if (!q.trim()) return;
    if (rawQuery !== undefined) { setNormalizedQuery(null); setNormalizeError(null); }
    setSearching(true);
    setHasSearched(true);
    setResults([]);
    try {
      const res  = await fetch("/api/research/search", {
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
    const res  = await fetch("/api/research/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arxiv_ids:    Array.from(selectedIds),
        query:        normalizedQuery ?? query,
        llm_provider: llm1Provider,
        llm_model:    llm1Model,
        tts_backend:  ttsBackend,
        tts_voice:    ttsVoice,
      }),
    });
    const data = await res.json();
    if (data.jobs) {
      const newJobs = data.jobs as Array<{ arxiv_id: string; job_id: string }>;
      setResearchJobs((prev) => [...prev, ...newJobs]);
      setRunningJobIds((prev) => {
        const next = new Set(prev);
        newJobs.forEach((j) => next.add(j.job_id));
        return next;
      });
      setSelectedIds(new Set());
    }
  };

  const removeRunning = (jobId: string) =>
    setRunningJobIds((prev) => { const n = new Set(prev); n.delete(jobId); return n; });

  const handleCancelJob = async (jobId: string) => {
    await fetch(`/api/research/jobs/${jobId}`, { method: "DELETE" });
    removeRunning(jobId);
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
          const res  = await fetch("/api/research/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (data.text) setQuery(data.text);
        } catch { /* silent */ }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <p className={`text-xs ${dimText} mb-6`}>
        Search arXiv for papers, select them, and convert to audio.
      </p>

      {/* Search input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNormalizedQuery(null);
            setNormalizeError(null);
            setHasSearched(false);
          }}
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
          isDark
            ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
            : "border-rose-400/50 bg-rose-50 text-rose-700"
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
            <p className={`text-xs font-medium ${isDark ? "text-purple-400" : "text-purple-700"}`}>
              LLM-normalised — edit if needed:
            </p>
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

      {/* Search button */}
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
                    : isDark
                    ? "border-white/10 hover:border-white/20"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  selectedIds.has(r.arxiv_id)
                    ? "bg-purple-500 border-purple-500"
                    : isDark ? "border-white/20" : "border-black/20"
                }`}>
                  {selectedIds.has(r.arxiv_id) && (
                    <Icon icon="mdi:check" className="w-3 h-3 text-black" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug">{r.title}</p>
                  <p className={`text-xs ${dimText} mt-0.5`}>
                    {r.authors.slice(0, 3).join(", ")}{r.authors.length > 3 ? " et al." : ""}
                  </p>
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
          {(selectedIds.size > 0 || runningJobIds.size > 0) && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleResearchEnqueue}
                disabled={runningJobIds.size > 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-500 rounded text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {runningJobIds.size > 0 ? (
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon icon="mdi:headphones" className="w-4 h-4" />
                )}
                {runningJobIds.size > 0
                  ? "Converting\u2026"
                  : `Convert ${selectedIds.size} selected paper${selectedIds.size > 1 ? "s" : ""} to audio`}
              </button>
              {runningJobIds.size > 0 && (
                <button
                  onClick={() => { runningJobIds.forEach((id) => handleCancelJob(id)); }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded text-sm text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                >
                  <Icon icon="mdi:cancel" className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Research job progress panels */}
          {researchJobs.map(({ arxiv_id, job_id }) => (
            <div key={job_id} className={`mt-4 p-4 rounded border ${isDark ? "border-white/10" : "border-black/10"}`}>
              <p className={`text-xs ${dimText} mb-1 truncate`} title={arxiv_id}>{arxiv_id}</p>
              <ConversionProgress
                jobId={job_id}
                theme={theme}
                onDone={(result) => {
                  removeRunning(job_id);
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
                onStopped={() => removeRunning(job_id)}
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
  );
}
