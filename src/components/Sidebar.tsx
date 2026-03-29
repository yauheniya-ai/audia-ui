import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { Paper, AudioEntry, Theme } from "../App";

interface SidebarProps {
  theme: Theme;
  refreshKey: number;
  selectedPaper: Paper | null;
  setSelectedPaper: (p: Paper | null) => void;
  setActiveAudio: (a: AudioEntry | null) => void;
  onDeleted: () => void;
}

interface ConfirmState {
  type: "paper" | "audio";
  id: number;
  paperId?: number;
}

export default function Sidebar({
  theme,
  refreshKey,
  selectedPaper,
  setSelectedPaper,
  setActiveAudio,
  onDeleted,
}: SidebarProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [audioMap, setAudioMap] = useState<Record<number, AudioEntry[]>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState<number | null>(null);

  const isDark = theme === "dark";
  const border = isDark ? "border-white/10" : "border-black/10";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-black/5";
  const dimText = isDark ? "text-white/40" : "text-black/40";
  const activeBg = isDark ? "bg-white/10" : "bg-black/10";

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/library/papers").then((r) => r.json()),
      fetch("/api/library/audio").then((r) => r.json()),
    ])
      .then(([papersData, audioData]) => {
        setPapers(papersData.papers ?? []);
        const map: Record<number, AudioEntry[]> = {};
        for (const af of audioData.audio_files ?? []) {
          if (af.paper_id != null) {
            if (!map[af.paper_id]) map[af.paper_id] = [];
            map[af.paper_id].push(af);
          }
        }
        setAudioMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleDeletePaper = async (paperId: number) => {
    await fetch(`/api/library/papers/${paperId}`, { method: "DELETE" });
    setConfirm(null);
    if (selectedPaper?.id === paperId) setSelectedPaper(null);
    onDeleted();
  };

  const handleDeleteAudio = async (audioId: number) => {
    await fetch(`/api/library/audio/${audioId}`, { method: "DELETE" });
    setConfirm(null);
    onDeleted();
  };

  return (
    <aside
      className={`w-58 shrink-0 flex flex-col border-r ${border} overflow-y-auto`}
      style={{ width: "220px" }}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${border} flex items-center gap-2`}>
        <Icon icon="mdi:bookshelf" className="w-3.5 h-3.5 text-cyan-500" />
        <span className="text-xs font-semibold tracking-widest uppercase text-cyan-500">
          Library
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className={`${dimText} text-xs px-4 py-3 flex items-center gap-2`}>
            <Icon icon="mdi:loading" className="w-3 h-3 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && papers.length === 0 && (
          <div className={`${dimText} text-xs px-4 py-3`}>
            No papers yet.
          </div>
        )}

        {papers.map((paper) => {
          const audios = audioMap[paper.id] ?? [];
          const isSelected = selectedPaper?.id === paper.id;
          const isExpanded = expandedPaper === paper.id;

          return (
            <div key={paper.id}>
              {/* Paper row */}
              <div
                className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${hoverBg} ${isSelected ? activeBg : ""}`}
              >
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => {
                    setSelectedPaper(isSelected ? null : paper);
                    setExpandedPaper(isExpanded ? null : paper.id);
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <Icon
                      icon="bi:file-earmark-pdf-fill"
                      className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5"
                    />
                    <span className="text-xs leading-snug line-clamp-2 break-words">
                      {paper.title}
                    </span>
                  </div>
                  {audios.length > 0 && (
                    <div className="mt-1 ml-5 flex items-center gap-1">
                      <Icon icon="mdi:headphones" className="w-3 h-3 text-lime-500" />
                      <span className={`text-xs ${dimText}`}>{audios.length} audio</span>
                    </div>
                  )}
                </button>

                {/* Delete paper button */}
                <button
                  className={`opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded transition-all ${dimText} hover:text-rose-500`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm({ type: "paper", id: paper.id });
                  }}
                  title="Delete paper"
                >
                  <Icon icon="mdi:delete-outline" className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Inline delete confirmation for paper */}
              {confirm?.type === "paper" && confirm.id === paper.id && (
                <div className={`mx-3 mb-1 px-2 py-1.5 rounded border ${border} text-xs flex items-center gap-2`}>
                  <span className="text-rose-500 flex-1">Delete paper + audio?</span>
                  <button
                    className="text-lime-500 hover:text-lime-300 px-1"
                    onClick={() => handleDeletePaper(paper.id)}
                  >
                    yes
                  </button>
                  <button
                    className={`${dimText} hover:text-white px-1`}
                    onClick={() => setConfirm(null)}
                  >
                    no
                  </button>
                </div>
              )}

              {/* Audio sub-rows */}
              {isExpanded &&
                audios.map((af) => (
                  <div key={af.id}>
                    <div
                      className={`group flex items-center gap-2 pl-8 pr-3 py-1.5 cursor-pointer transition-colors ${hoverBg}`}
                      onClick={() => setActiveAudio(af)}
                    >
                      <Icon icon="mdi:music-note" className="w-3 h-3 text-lime-500 shrink-0" />
                      <span className={`text-xs ${dimText} flex-1 truncate`}>{af.filename}</span>
                      <button
                        className={`opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded transition-all ${dimText} hover:text-rose-500`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirm({ type: "audio", id: af.id, paperId: paper.id });
                        }}
                        title="Delete audio"
                      >
                        <Icon icon="mdi:delete-outline" className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Audio delete confirm */}
                    {confirm?.type === "audio" && confirm.id === af.id && (
                      <div className={`mx-3 mb-1 px-2 py-1.5 rounded border ${border} text-xs flex items-center gap-2`}>
                        <span className="text-rose-500 flex-1">Delete audio file?</span>
                        <button
                          className="text-lime-500 hover:text-lime-300 px-1"
                          onClick={() => handleDeleteAudio(af.id)}
                        >
                          yes
                        </button>
                        <button
                          className={`${dimText} hover:text-white px-1`}
                          onClick={() => setConfirm(null)}
                        >
                          no
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
