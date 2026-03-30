import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { AudioEntry, LivePreview, Theme } from "../App";
import { PROVIDERS, PROVIDER_MODELS, STT_MODELS, TTS_BACKENDS } from "../constants";
import type { LLMProvider } from "../constants";
import { MainConfiguration } from "./MainConfiguration";
import { MainConvert, AudioPlayer } from "./MainConvert";
import { MainResearch } from "./MainResearch";
import { MainDatabase } from "./MainDatabase";

interface MainProps {
  theme: Theme;
  activeAudio: AudioEntry | null;
  setActiveAudio: (a: AudioEntry | null) => void;
  onConverted: () => void;
  setLivePreviewPdf: (p: LivePreview | null) => void;
}

type Tab = "configuration" | "convert" | "research" | "database";







// ────────────────────────────────── Main component

export default function Main({ theme, activeAudio, setActiveAudio, onConverted, setLivePreviewPdf }: MainProps) {
  const isDark  = theme === "dark";
  const border  = isDark ? "border-white/10" : "border-black/10";
  const dimText = isDark ? "text-white/40"   : "text-black/40";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-black/5";

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



  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className={`flex items-center gap-1 px-6 pt-4 pb-0 border-b ${border}`}>
        {([
          { id: "configuration", label: "Configuration", icon: "mdi:tune-vertical" },
          { id: "convert",       label: "Convert",       icon: "mdi:file-arrow-up-down" },
          { id: "research",      label: "Research",      icon: "mdi:magnify" },
          { id: "database",     label: "Database",      icon: "mdi:database-outline" },
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
        {tab === "configuration" && (
          <MainConfiguration
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
        {tab === "convert" && (
          <MainConvert
            theme={theme}
            ttsBackend={ttsBackend}
            llm1Provider={llm1Provider}
            llm1Model={llm1Model}
            onConverted={onConverted}
            setActiveAudio={setActiveAudio}
            setLivePreviewPdf={setLivePreviewPdf}
          />
        )}
        {tab === "research" && (
          <MainResearch
            theme={theme}
            llm1Provider={llm1Provider}
            llm1Model={llm1Model}
            ttsBackend={ttsBackend}
            onConverted={onConverted}
            setActiveAudio={setActiveAudio}
            setLivePreviewPdf={setLivePreviewPdf}
          />
        )}
        {tab === "database" && (
          <MainDatabase theme={theme} />
        )}
      </div>

      {/* Audio player (full width, pinned to bottom) */}
      {activeAudio && (
        <AudioPlayer audio={activeAudio} theme={theme} onClose={() => setActiveAudio(null)} />
      )}
    </div>
  );
}

