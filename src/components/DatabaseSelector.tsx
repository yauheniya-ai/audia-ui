import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { Theme } from "../App";

// ── Types ────────────────────────────────────────────────────────────────────

export type ProjectInfo = {
  name:        string;
  path:        string;
  root:        string;
  size_kb:     number;
  documents:   number;
  quizzes:     number;   // audio files in audia's case
  is_default:  boolean;
  is_active:   boolean;
  exists:      boolean;
  created_at:  string;
};

type Props = {
  theme:         Theme;
  activeProject: string | null;   // null → "default"
  onSelect:      (project: ProjectInfo | null) => void;
};

// ── Validation ───────────────────────────────────────────────────────────────

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function validateName(name: string): string | null {
  if (!name.trim()) return "Name cannot be empty.";
  if (!NAME_RE.test(name))
    return "Lowercase letters, digits, hyphens and underscores only. Must start with a letter or digit.";
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DatabaseSelector({ theme, activeProject, onSelect }: Props) {
  const isDark = theme === "dark";
  const [open,     setOpen]     = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const [adding,   setAdding]   = useState(false);
  const [newName,  setNewName]  = useState("");
  const [nameErr,  setNameErr]  = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const qs  = activeProject ? `?active_project=${encodeURIComponent(activeProject)}` : "";
      const res = await fetch(`/api/projects${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      setFetchErr("Failed to load projects. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);
  useEffect(() => { if (adding) setTimeout(() => inputRef.current?.focus(), 50); }, [adding]);

  // ── create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const trimmed = newName.trim().toLowerCase();
    const err = validateName(trimmed);
    if (err) { setNameErr(err); return; }

    setCreating(true);
    setNameErr(null);
    try {
      const res = await fetch(`/api/projects`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json();
        setNameErr(d.detail ?? "Failed to create project.");
        return;
      }
      const created: ProjectInfo = await res.json();
      setAdding(false);
      setNewName("");
      await load();
      onSelect(created);
      setOpen(false);
    } catch {
      setNameErr("Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (name: string) => {
    try {
      await fetch(`/api/projects/${encodeURIComponent(name)}?keep_files=false`, {
        method: "DELETE",
      });
      setConfirmDelete(null);
      const deleted = projects.find(p => p.name === name);
      await load();
      if (deleted?.is_active) onSelect(null);
    } catch {
      setFetchErr("Failed to delete project.");
    }
  };

  const closeModal = () => {
    setOpen(false);
    setAdding(false);
    setNewName("");
    setNameErr(null);
    setConfirmDelete(null);
  };

  const label = activeProject ?? "default";

  // ── theme-aware classes ───────────────────────────────────────────────────
  const modalBg    = isDark ? "bg-zinc-900 border-zinc-700"            : "bg-white border-black";
  const headerBg   = "bg-cyan-700";
  const rowHover   = isDark ? "hover:bg-white/5"                       : "hover:bg-black/5";
  const activeRow  = isDark ? "bg-cyan-900/40 border-l-4 border-l-cyan-500" : "bg-cyan-50 border-l-4 border-l-cyan-500";
  const textMain   = isDark ? "text-white"  : "text-black";
  const textDim    = isDark ? "text-white/50" : "text-black/50";
  const divider    = isDark ? "border-white/10" : "border-black/10";
  const inputCls   = isDark
    ? "bg-zinc-800 border-cyan-600 text-white placeholder-white/30 focus:border-cyan-400"
    : "bg-white border-cyan-300 text-black placeholder-black/30 focus:border-cyan-500";
  const addFormBg  = isDark ? "bg-cyan-950/40 border-white/10" : "bg-cyan-50/60 border-black/10";

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-bold font-mono text-white/70 hover:text-white transition-colors border border-white/20 rounded px-2 py-1 bg-white/5 hover:bg-white/10 max-w-[130px] min-w-0"
        title={label}
      >
        <Icon icon="mdi:database" className="w-3 h-3 text-cyan-400 shrink-0" />
        <span className="text-cyan-300 truncate min-w-0 flex-1">{label}</span>
        <Icon icon="mdi:chevron-down" className="w-3 h-3 shrink-0" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
          onClick={closeModal}
        >
          <div
            className={`${modalBg} border-2 rounded-lg w-full max-w-lg flex flex-col overflow-hidden shadow-2xl`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-5 py-4 border-b-2 border-cyan-900 ${headerBg} flex items-center justify-between`}>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Project Database
                </h2>
                <p className="text-xs text-white/60 font-mono mt-0.5">~/.audia/</p>
              </div>
              <button onClick={closeModal} className="text-white/80 hover:text-white">
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto max-h-96">
              {loading && (
                <div className={`flex items-center justify-center gap-2 py-12 ${textDim} text-sm font-mono`}>
                  <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
                  Scanning projects…
                </div>
              )}

              {fetchErr && (
                <div className="m-4 px-3 py-2 bg-red-950/50 border border-red-700 rounded text-xs text-red-400 font-mono">
                  {fetchErr}
                </div>
              )}

              {!loading && !fetchErr && projects.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Icon icon="mdi:database-off" className="w-10 h-10 text-white/20" />
                  <p className={`${textDim} text-xs font-mono`}>No projects found.</p>
                </div>
              )}

              {!loading && projects.map(proj => {
                const isActive     = proj.is_active;
                const isConfirming = confirmDelete === proj.name;

                return (
                  <div
                    key={proj.name}
                    className={`border-b ${divider} last:border-0 ${isActive ? activeRow : rowHover}`}
                  >
                    <div className="flex items-center gap-3 px-5 py-3">
                      <button
                        onClick={() => { onSelect(proj); setOpen(false); }}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        {isActive
                          ? <Icon icon="mdi:database-check" className="w-5 h-5 shrink-0 text-cyan-400" />
                          : <Icon icon="mdi:database" className="w-5 h-5 shrink-0 text-white/30" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-sm font-black truncate ${textMain}`} title={proj.name}>{proj.name}</span>
                            {proj.is_default && (
                              <span className="text-[9px] font-black uppercase bg-cyan-600 text-white px-1.5 py-0.5 rounded leading-none">
                                default
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[9px] font-black uppercase bg-cyan-500 text-white px-1.5 py-0.5 rounded leading-none">
                                active
                              </span>
                            )}
                            {!proj.exists && (
                              <span className={`text-[9px] font-black uppercase ${isDark ? "bg-white/20 text-white/50" : "bg-black/10 text-black/40"} px-1.5 py-0.5 rounded leading-none`}>
                                new
                              </span>
                            )}
                          </div>
                          <p className={`text-xs ${textDim} font-mono truncate mt-0.5`}>{proj.path}</p>
                        </div>
                        <div className={`shrink-0 text-right text-xs font-mono ${textDim}`}>
                          <div className={`font-black ${textMain}`}>{proj.documents} docs</div>
                          <div>{proj.quizzes} audio · {proj.size_kb} KB</div>
                        </div>
                      </button>

                      {!proj.is_default && (
                        <button
                          onClick={() => setConfirmDelete(isConfirming ? null : proj.name)}
                          className={`shrink-0 ${textDim} hover:text-red-400 transition-colors ml-1`}
                          title="Delete project"
                        >
                          <Icon icon="mdi:delete" className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isConfirming && (
                      <div className="mx-5 mb-3 px-3 py-2 bg-red-950/50 border border-red-700 rounded flex items-center justify-between gap-3">
                        <span className="text-xs text-red-400 font-bold">
                          Delete "{proj.name}"? This cannot be undone.
                        </span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleDelete(proj.name)}
                            className="text-[11px] font-black bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[11px] font-black bg-transparent text-red-400 border border-red-600 px-2 py-0.5 rounded hover:bg-red-950/50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {adding && (
                <div className={`px-5 py-4 border-t ${addFormBg}`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${textDim} mb-2`}>
                    New project name
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      ref={inputRef}
                      value={newName}
                      onChange={e => { setNewName(e.target.value.toLowerCase()); setNameErr(null); }}
                      onKeyDown={e => {
                        if (e.key === "Enter")  handleCreate();
                        if (e.key === "Escape") { setAdding(false); setNewName(""); setNameErr(null); }
                      }}
                      placeholder="my-project"
                      className={`flex-1 text-xs font-mono border rounded px-2 py-1.5 outline-none transition-colors ${inputCls}`}
                    />
                    <button
                      onClick={handleCreate}
                      disabled={creating}
                      className="shrink-0 text-xs font-bold bg-cyan-600 text-white px-3 py-1.5 rounded hover:bg-cyan-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      {creating
                        ? <><Icon icon="mdi:loading" className="w-3.5 h-3.5 animate-spin" /> Creating…</>
                        : "Create"
                      }
                    </button>
                    <button
                      onClick={() => { setAdding(false); setNewName(""); setNameErr(null); }}
                      className={`shrink-0 ${textDim} hover:text-white transition-colors`}
                    >
                      <Icon icon="mdi:close" className="w-4 h-4" />
                    </button>
                  </div>
                  {nameErr && (
                    <p className="text-[10px] text-red-400 font-mono mt-1.5">{nameErr}</p>
                  )}
                  <p className={`text-[10px] ${textDim} font-mono mt-1.5`}>
                    Lowercase letters, digits, hyphens and underscores only.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t ${divider} flex items-center gap-4`}>
              <button
                onClick={load}
                className={`text-xs ${textDim} hover:text-white font-mono flex items-center gap-1 transition-colors`}
              >
                <Icon icon="mdi:refresh" className="w-3.5 h-3.5" />
                Refresh
              </button>
              {!adding && (
                <button
                  onClick={() => { setAdding(true); setConfirmDelete(null); }}
                  className={`text-xs font-bold ${textDim} hover:text-white flex items-center gap-1.5 transition-colors`}
                >
                  <Icon icon="mdi:plus-circle" className="w-3.5 h-3.5" />
                  New project
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
