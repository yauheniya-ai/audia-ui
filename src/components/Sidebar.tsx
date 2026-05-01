import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { Paper, AudioEntry, Theme } from "../App";
import Tooltip from "./Tooltip";
import DatabaseSelector from "./DatabaseSelector";
import type { ProjectInfo } from "./DatabaseSelector";

interface SidebarProps {
  theme: Theme;
  refreshKey: number;
  selectedPaper: Paper | null;
  setSelectedPaper: (p: Paper | null) => void;
  setActiveAudio: (a: AudioEntry | null) => void;
  onDeleted: () => void;
  activeProject: string | null;
  onSelectProject: (name: string | null) => void;
}

interface ConfirmState {
  type: "paper" | "audio";
  id: number;
  paperId?: number;
}

interface MoveState {
  paperId: number;
  projects: string[];
  selected: string;
  loading: boolean;
}

export default function Sidebar({
  theme,
  refreshKey,
  selectedPaper,
  setSelectedPaper,
  setActiveAudio,
  onDeleted,
  activeProject,
  onSelectProject,
}: SidebarProps) {
  const pqs = activeProject ? `?project=${encodeURIComponent(activeProject)}` : "";
  const [papers, setPapers] = useState<Paper[]>([]);
  const [audioMap, setAudioMap] = useState<Record<number, AudioEntry[]>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [move, setMove] = useState<MoveState | null>(null);
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
      fetch(`/api/library/papers${pqs}`).then((r) => r.json()),
      fetch(`/api/library/audio${pqs}`).then((r) => r.json()),
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
    await fetch(`/api/library/papers/${paperId}${pqs}`, { method: "DELETE" });
    setConfirm(null);
    if (selectedPaper?.id === paperId) setSelectedPaper(null);
    onDeleted();
  };

  const handleDeleteAudio = async (audioId: number) => {
    await fetch(`/api/library/audio/${audioId}${pqs}`, { method: "DELETE" });
    setConfirm(null);
    onDeleted();
  };

  const handleOpenMove = async (paperId: number) => {
    setConfirm(null);
    setMove({ paperId, projects: [], selected: "", loading: true });
    try {
      const res = await fetch(`/api/projects?active_project=${encodeURIComponent(activeProject ?? "default")}`);
      const data = await res.json();
      const others: string[] = (data.projects as { name: string }[])
        .map((p) => p.name)
        .filter((n) => n !== (activeProject ?? "default"));
      setMove({ paperId, projects: others, selected: others[0] ?? "", loading: false });
    } catch {
      setMove(null);
    }
  };

  const handleConfirmMove = async () => {
    if (!move || !move.selected) return;
    const src = activeProject ? `?project=${encodeURIComponent(activeProject)}` : "";
    await fetch(`/api/library/papers/${move.paperId}/move${src}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_project: move.selected }),
    });
    setMove(null);
    if (selectedPaper?.id === move.paperId) setSelectedPaper(null);
    onDeleted();
  };

  return (
    <aside
      className={`w-58 shrink-0 flex flex-col border-r ${border} overflow-y-auto`}
      style={{ width: "250px" }}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${border} flex items-center gap-2`}>
        <Icon icon="mdi:bookshelf" className="w-3.5 h-3.5 text-cyan-500" />
        <span className="text-xs font-semibold tracking-widest uppercase text-cyan-500 shrink-0">
          Library
        </span>
        <div className="flex-1 min-w-0 flex justify-end">
          <DatabaseSelector
            theme={theme}
            activeProject={activeProject}
            onSelect={(p: ProjectInfo | null) => onSelectProject(p?.name ?? null)}
          />
        </div>
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

                {/* Move paper button */}
                <Tooltip label="Move" variant="move">
                  <button
                    className={`opacity-70 hover:opacity-100 cursor-pointer shrink-0 p-0.5 rounded transition-all ${dimText} hover:text-cyan-400`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMove(paper.id);
                    }}
                  >
                    <Icon icon="mdi:folder-move-outline" className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>

                {/* Delete paper button */}
                <Tooltip label="Delete" variant="delete">
                  <button
                    className={`opacity-70 hover:opacity-100 cursor-pointer shrink-0 p-0.5 rounded transition-all ${dimText} hover:text-rose-500`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirm({ type: "paper", id: paper.id });
                    }}
                  >
                    <Icon icon="mdi:delete-outline" className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>

              {/* Inline delete confirmation for paper */}
              {confirm?.type === "paper" && confirm.id === paper.id && (
                <div className={`mx-3 mb-1 px-2 py-1.5 rounded border ${border} text-xs flex items-center gap-2`}>
                  <span className="text-rose-500 flex-1">Delete paper + audio?</span>
                  <button
                    className="text-rose-500 hover:text-rose-300 cursor-pointer px-1"
                    onClick={() => handleDeletePaper(paper.id)}
                  >
                    yes
                  </button>
                  <button
                    className={`${dimText} hover:text-white cursor-pointer px-1`}
                    onClick={() => setConfirm(null)}
                  >
                    no
                  </button>
                </div>
              )}

              {/* Inline move picker */}
              {move?.paperId === paper.id && (
                <div className={`mx-3 mb-1 px-2 py-1.5 rounded border ${border} text-xs flex flex-col gap-1.5`}>
                  {move.loading ? (
                    <span className={dimText}>Loading projects…</span>
                  ) : move.projects.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <span className={`${dimText} flex-1`}>No other projects.</span>
                      <button className={`${dimText} hover:text-white cursor-pointer px-1`} onClick={() => setMove(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      {/* Row 1: label + ✕ */}
                      <div className="flex items-center gap-1.5">
                        <Icon icon="mdi:folder-move-outline" className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="text-cyan-400 flex-1">Move to project:</span>
                        <Tooltip label="Cancel" variant="cancel">
                          <button
                            className={`${dimText} hover:text-white cursor-pointer px-1 shrink-0`}
                            onClick={() => setMove(null)}
                          >
                            ✕
                          </button>
                        </Tooltip>
                      </div>
                      {/* Row 2: select + move button */}
                      <div className="flex items-center gap-2">
                        <select
                          className={`flex-1 min-w-0 bg-transparent border ${border} rounded px-1 py-0.5 text-xs outline-none`}
                          value={move.selected}
                          onChange={(e) => setMove({ ...move, selected: e.target.value })}
                        >
                          {move.projects.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <button
                          className="text-cyan-400 hover:text-cyan-200 cursor-pointer px-1 shrink-0"
                          onClick={handleConfirmMove}
                        >
                          move
                        </button>
                      </div>
                    </>
                  )}
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
