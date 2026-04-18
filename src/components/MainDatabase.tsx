import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import type { Theme } from "../App";
import { TTS_BACKENDS, TTS_VOICES } from "../constants";
import type { TTSBackend } from "../constants";

// ────────────────────────────────── Schema definition (static)

const SCHEMA = {
  papers: {
    icon: "mdi:file-document-outline",
    color: "rose",
    columns: [
      { name: "id",         type: "INTEGER", pk: true  },
      { name: "title",      type: "VARCHAR(512)"       },
      { name: "authors",    type: "TEXT (JSON)"        },
      { name: "abstract",   type: "TEXT"               },
      { name: "arxiv_id",   type: "VARCHAR(64)"        },
      { name: "pdf_path",   type: "TEXT"               },
      { name: "pdf_url",    type: "TEXT"               },
      { name: "created_at", type: "DATETIME"           },
    ],
  },
  audio_files: {
    icon: "mdi:music-note",
    color: "lime",
    columns: [
      { name: "id",               type: "INTEGER", pk: true  },
      { name: "paper_id",         type: "INTEGER", fk: "papers.id" },
      { name: "filename",         type: "VARCHAR(256)"       },
      { name: "file_path",        type: "TEXT"               },
      { name: "duration_seconds", type: "FLOAT"              },
      { name: "tts_backend",      type: "VARCHAR(32)"        },
      { name: "tts_voice",        type: "VARCHAR(128)"       },
      { name: "created_at",       type: "DATETIME"           },
    ],
  },
  research_sessions: {
    icon: "mdi:magnify",
    color: "cyan",
    columns: [
      { name: "id",         type: "INTEGER", pk: true  },
      { name: "query",      type: "TEXT"               },
      { name: "paper_ids",  type: "TEXT (JSON)"        },
      { name: "created_at", type: "DATETIME"           },
    ],
  },
  user_settings: {
    icon: "mdi:cog-outline",
    color: "purple",
    columns: [
      { name: "key",   type: "VARCHAR(128)", pk: true },
      { name: "value", type: "TEXT"                   },
    ],
  },
} as const;

type TableName = keyof typeof SCHEMA;

const TABLE_LABELS: Record<TableName, string> = {
  papers:            "papers",
  audio_files:       "audio_files",
  research_sessions: "research_sessions",
  user_settings:     "user_settings",
};

const TABLE_ENDPOINTS: Record<TableName, string> = {
  papers:            "/api/library/papers",
  audio_files:       "/api/library/audio",
  research_sessions: "/api/library/research_sessions",
  user_settings:     "/api/library/user_settings",
};

const TABLE_ROOT_KEY: Record<TableName, string> = {
  papers:            "papers",
  audio_files:       "audio_files",
  research_sessions: "research_sessions",
  user_settings:     "user_settings",
};

// ────────────────────────────────── Editable-cell config

const EDITABLE_COLS: Partial<Record<TableName, ReadonlySet<string>>> = {
  papers:            new Set(["title", "authors", "abstract", "arxiv_id", "pdf_url"]),
  audio_files:       new Set(["filename", "duration_seconds", "tts_backend", "tts_voice", "paper_id"]),
  research_sessions: new Set(["query"]),
  user_settings:     new Set(["value"]),
};

const TABLE_PK: Record<TableName, string> = {
  papers:            "id",
  audio_files:       "id",
  research_sessions: "id",
  user_settings:     "key",
};

const PATCH_URL: Record<TableName, (pk: unknown) => string> = {
  papers:            (pk) => `/api/library/papers/${pk}`,
  audio_files:       (pk) => `/api/library/audio/${pk}`,
  research_sessions: (pk) => `/api/library/research_sessions/${pk}`,
  user_settings:     (pk) => `/api/library/user_settings/${pk}`,
};

const NULLABLE_COLS = new Set(["arxiv_id", "pdf_url", "pdf_path"]);

// ────────────────────────────────── Colour helpers

const COLORS: Record<string, { border: string; heading: string; badge: string; dimBadge: string }> = {
  rose:   { border: "border-rose-500/40",   heading: "text-rose-500",   badge: "bg-rose-500/15 text-rose-500",   dimBadge: "bg-rose-500/10 text-rose-300/60"   },
  lime:   { border: "border-lime-500/40",   heading: "text-lime-500",   badge: "bg-lime-500/15 text-lime-500",   dimBadge: "bg-lime-500/10 text-lime-300/60"   },
  cyan:   { border: "border-cyan-500/40",   heading: "text-cyan-500",   badge: "bg-cyan-500/15 text-cyan-500",   dimBadge: "bg-cyan-500/10 text-cyan-300/60"   },
  purple: { border: "border-purple-500/40", heading: "text-purple-500", badge: "bg-purple-500/15 text-purple-500", dimBadge: "bg-purple-500/10 text-purple-300/60" },
};

// ────────────────────────────────── TableSelect (custom, no native)

function TableSelect({ value, onChange, isDark }: {
  value: TableName;
  onChange: (t: TableName) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tables = Object.keys(TABLE_LABELS) as TableName[];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-md border transition-colors
          ${
            isDark
              ? "bg-transparent text-white border-white/15 hover:border-white/35"
              : "bg-transparent text-black border-black/15 hover:border-black/30"
          }`}
      >
        <span>{value}</span>
        <Icon
          icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
          className={`w-3.5 h-3.5 ${
            isDark ? "text-white/30" : "text-black/30"
          }`}
        />
      </button>
      {open && (
        <div
          className={`absolute z-50 top-full right-0 mt-1 rounded-md border shadow-lg overflow-hidden min-w-full ${
            isDark ? "bg-zinc-900 border-white/10" : "bg-white border-black/10"
          }`}
        >
          {tables.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                t === value
                  ? isDark ? "bg-white/5 text-white" : "bg-black/5 text-black"
                  : isDark ? "text-white/60 hover:bg-white/5" : "text-black/60 hover:bg-black/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────── CellSelect (portal-based for use inside overflow-x-auto tables)

function CellSelect({ value, options, onChange, isDark }: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 130) });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-1 rounded border px-2 py-1 text-xs font-mono ${
          isDark
            ? "bg-zinc-800 border-zinc-600 text-white"
            : "bg-gray-50 border-gray-300 text-black"
        }`}
      >
        <span className="truncate">{value}</span>
        <Icon
          icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
          className="w-3 h-3 opacity-40 shrink-0"
        />
      </button>
      {open && pos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              zIndex: 9999,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`rounded border shadow-xl overflow-y-auto max-h-56 ${
              isDark ? "bg-zinc-900 border-white/15" : "bg-white border-black/10"
            }`}
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs font-mono whitespace-nowrap transition-colors ${
                  opt === value
                    ? isDark ? "bg-lime-950 text-lime-400" : "bg-lime-50 text-lime-700"
                    : isDark ? "text-white/70 hover:bg-zinc-800" : "text-black/70 hover:bg-gray-100"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// ────────────────────────────────── Sub-components

function SchemaCard({ name, isDark }: { name: TableName; isDark: boolean }) {
  const def = SCHEMA[name];
  const c   = COLORS[def.color];
  const bg  = isDark ? "bg-white/[0.03] border-white/10" : "bg-black/[0.03] border-black/8";
  const dim = isDark ? "text-white/40" : "text-black/40";

  return (
    <div className={`rounded-lg border ${bg} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${c.border} border-opacity-60`}>
        <Icon icon={def.icon} className={`w-3.5 h-3.5 ${c.heading}`} />
        <span className={`text-xs font-mono font-semibold ${c.heading}`}>{name}</span>
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {def.columns.map((col) => (
          <div key={col.name} className="flex items-center gap-2 py-0.5">
            <span className="font-mono text-[11px] min-w-[120px]">{col.name}</span>
            <span className={`font-mono text-[10px] ${dim}`}>{col.type}</span>
            {"pk" in col && col.pk && (
              <span className={`ml-auto text-[9px] px-1 rounded font-mono ${c.badge}`}>PK</span>
            )}
            {"fk" in col && col.fk && (
              <span className={`ml-auto text-[9px] px-1.5 rounded font-mono ${c.dimBadge}`}>
                FK → {(col as { fk: string }).fk}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CellValue({ value, isEditable, isDark }: { value: unknown; isEditable?: boolean; isDark?: boolean }) {
  if (value === null || value === undefined) {
    return <span className="opacity-30 italic">null</span>;
  }
  if (Array.isArray(value)) {
    return (
      <span className="font-mono text-xs">
        [{value.map((v, i) => <span key={i}>{i > 0 && ", "}{String(v)}</span>)}]
      </span>
    );
  }
  const s = String(value);
  if (s === "" && isEditable) {
    // Empty-string cells need a visible target so the user can click to edit
    return (
      <span className={`text-xs italic ${isDark ? "text-white/20" : "text-black/20"}`}>
        (empty)
      </span>
    );
  }
  return <span className="font-mono text-xs break-all">{s}</span>;
}

// ────────────────────────────────── EditableCell

function EditableCell({
  value,
  isEditable,
  isDark,
  multiline,
  selectOptions,
  onSave,
}: {
  value: unknown;
  isEditable: boolean;
  isDark: boolean;
  multiline?: boolean;
  selectOptions?: readonly string[];
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [flash,   setFlash]   = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const toStr = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  };

  const startEdit = () => {
    if (!isEditable || saving) return;
    setDraft(toStr(value));
    setEditing(true);
  };

  useEffect(() => {
    if (editing && !selectOptions) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [editing, selectOptions]);

  const commit = async (val = draft) => {
    setEditing(false);
    if (val === toStr(value)) return;
    setSaving(true);
    try {
      await onSave(val);
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    } catch {
      /* keep display value unchanged on error */
    } finally {
      setSaving(false);
    }
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setEditing(false); return; }
    if (e.key === "Enter" && !multiline) { e.preventDefault(); void commit(); }
    if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void commit(); }
  };

  const inputCls =
    `w-full text-xs font-mono rounded border px-2 py-1 outline-none ${
      isDark
        ? "bg-zinc-800 border-zinc-600 text-white focus:border-zinc-400"
        : "bg-gray-50 border-gray-300 text-black focus:border-gray-500"
    }`;

  if (editing) {
    if (selectOptions) {
      return (
        <CellSelect
          value={draft}
          options={selectOptions}
          isDark={isDark}
          onChange={(v) => { void (async () => {
            setEditing(false);
            if (v === toStr(value)) return;
            setSaving(true);
            try { await onSave(v); setFlash(true); setTimeout(() => setFlash(false), 1200); }
            catch { /* noop */ } finally { setSaving(false); }
          })(); }}
        />
      );
    }
    if (multiline) {
      return (
        <textarea
          ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={keyDown}
          rows={3}
          className={`${inputCls} resize-y min-w-[200px]`}
        />
      );
    }
    return (
      <input
        ref={inputRef as unknown as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={keyDown}
        className={`${inputCls} min-w-[100px]`}
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={[
        "font-mono text-xs leading-relaxed transition-all rounded min-h-[1.25rem]",
        multiline ? "max-h-24 overflow-y-auto" : "",
        isEditable
          ? [
              "cursor-text px-1.5 py-0.5 -mx-1.5 -my-0.5",
              isDark
                ? "hover:bg-white/5"
                : "hover:bg-black/5",
            ].join(" ")
          : "",
        flash ? (isDark ? "bg-lime-500/10 !border-lime-500/40" : "bg-lime-50 !border-lime-400/50") : "",
        saving ? "opacity-40" : "",
      ].filter(Boolean).join(" ")}
    >
      {saving
        ? <Icon icon="mdi:loading" className="w-3 h-3 animate-spin opacity-50" />
        : <CellValue value={value} isEditable={isEditable} isDark={isDark} />}
    </div>
  );
}

// ────────────────────────────────── MainDatabase

export interface MainDatabaseProps {
  theme: Theme;
  onPreviewPaper?: (paperId: number, title: string) => void;
  activeProject: string | null;
}

export function MainDatabase({ theme, onPreviewPaper, activeProject }: MainDatabaseProps) {
  const pqs = activeProject ? `?project=${encodeURIComponent(activeProject)}` : "";
  const isDark  = theme === "dark";
  const border  = isDark ? "border-white/10" : "border-black/10";
  const dimText = isDark ? "text-white/40"   : "text-black/40";
  const cardBg  = isDark ? "bg-white/[0.03]" : "bg-black/[0.02]";

  const [selectedTable, setSelectedTable] = useState<TableName>("papers");
  const [rows,          setRows]          = useState<Record<string, unknown>[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    setRows([]);
    setError(null);
    setLoading(true);
    fetch(TABLE_ENDPOINTS[selectedTable] + pqs)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Record<string, unknown[]>) => {
        const key = TABLE_ROOT_KEY[selectedTable];
        setRows((data[key] ?? []) as Record<string, unknown>[]);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedTable]);

  const handleCellSave = useCallback(async (rowIdx: number, col: string, rawVal: string): Promise<void> => {
    const row = rows[rowIdx];
    const pk  = row[TABLE_PK[selectedTable]];
    const url = PATCH_URL[selectedTable](pk);

    let fieldVal: unknown;
    if (col === "authors") {
      fieldVal = rawVal.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (col === "paper_id") {
      fieldVal = rawVal === "" ? null : parseInt(rawVal, 10);
    } else if (col === "duration_seconds") {
      fieldVal = rawVal === "" ? null : parseFloat(rawVal);
    } else if (NULLABLE_COLS.has(col) && rawVal === "") {
      fieldVal = null;
    } else {
      fieldVal = rawVal;
    }

    const res = await fetch(url + pqs, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ [col]: fieldVal }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [col]: fieldVal } : r)));
  }, [rows, selectedTable]);

  const getCellSelectOpts = (col: string, row: Record<string, unknown>): readonly string[] | undefined => {
    if (col === "tts_backend") return TTS_BACKENDS;
    if (col === "tts_voice")   return TTS_VOICES[String(row["tts_backend"] ?? "") as TTSBackend] ?? undefined;
    return undefined;
  };

  const columns = rows.length > 0
    ? Object.keys(rows[0])
    : SCHEMA[selectedTable].columns.map((c) => c.name);

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set<string>());

  // Reset hidden cols when table changes
  useEffect(() => { setHiddenCols(new Set<string>()); }, [selectedTable]);

  const toggleCol = (col: string) =>
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });

  const visibleCols   = columns.filter((c) => !hiddenCols.has(c));
  const collapsedCols = columns.filter((c) =>  hiddenCols.has(c));

  // Column-width hints
  const cellCls = (col: string) =>
    col === "abstract" || col === "query"
      ? "px-3 py-2 align-top whitespace-normal min-w-[200px] max-w-xs"
      : col === "title" || col === "filename" || col === "authors"
      ? "px-3 py-2 align-top whitespace-normal min-w-[160px] max-w-[280px]"
      : "px-3 py-2 align-top whitespace-nowrap";

  return (
    <div className="space-y-8">

      {/* ── Schema overview ─────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 opacity-50">
          Schema
        </h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {(Object.keys(SCHEMA) as TableName[]).map((name) => (
            <SchemaCard key={name} name={name} isDark={isDark} />
          ))}
        </div>

        {/* Relationships */}
        <div className={`mt-3 flex flex-wrap gap-4 text-[11px] font-mono ${dimText}`}>
          <span className="flex items-center gap-1.5">
            <span className="text-violet-500">audio_files.paper_id</span>
            <Icon icon="mdi:arrow-right" className="w-3 h-3" />
            <span className="text-rose-500">papers.id</span>
            <span className="opacity-60 ml-1">(FK, one-to-many)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-500">research_sessions.paper_ids</span>
            <Icon icon="mdi:arrow-right-dashed" className="w-3 h-3" />
            <span className="text-rose-500">papers.id[]</span>
            <span className="opacity-60 ml-1">(JSON, logical)</span>
          </span>
        </div>
      </section>

      {/* ── Data explorer ───────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest opacity-50">
            Data Explorer
          </h2>
          <TableSelect value={selectedTable} onChange={setSelectedTable} isDark={isDark} />
        </div>
        <p className={`text-xs mb-4 ${dimText}`}>
          Click any cell to edit it inline.{" "}
          {onPreviewPaper && "Click an "}
          {onPreviewPaper && <span className="text-rose-500 font-mono">id</span>}
          {onPreviewPaper && " to preview the paper PDF."}
        </p>

        {loading && (
          <div className={`flex items-center gap-2 text-xs ${dimText}`}>
            <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-400 flex items-center gap-2">
            <Icon icon="mdi:alert-circle-outline" className="w-4 h-4" />
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className={`text-xs ${dimText} italic`}>No rows.</div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Hidden column chips */}
            {collapsedCols.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {collapsedCols.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => toggleCol(col)}
                    className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      isDark
                        ? "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30"
                        : "border-black/10 text-black/40 hover:text-black/60 hover:border-black/20"
                    }`}
                  >
                    <Icon icon="mdi:eye-outline" className="w-3 h-3" />
                    {col}
                  </button>
                ))}
              </div>
            )}

          <div className={`rounded-lg border ${border} overflow-x-auto`}>
            <table className="table-auto min-w-max text-xs text-left">
              <thead>
                <tr className={`border-b ${border} ${cardBg}`}>
                  {visibleCols.map((col) => {
                    const def = SCHEMA[selectedTable].columns.find((c) => c.name === col);
                    const isPk = def && "pk" in def && def.pk;
                    const isFk = def && "fk" in def && (def as { fk?: string }).fk;
                    const c = COLORS[SCHEMA[selectedTable].color];
                    return (
                      <th
                        key={col}
                        className={`px-3 py-2 font-mono font-semibold whitespace-nowrap ${c.heading}`}
                      >
                        <span className="flex items-center gap-1.5">
                          {col}
                          {isPk && <span className={`text-[9px] px-1 rounded ${c.badge}`}>PK</span>}
                          {isFk && <span className="text-[9px] px-1 rounded opacity-50">FK</span>}
                          <button
                            type="button"
                            onClick={() => toggleCol(col)}
                            title={`Hide ${col}`}
                            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <Icon icon="mdi:eye-off-outline" className="w-3 h-3" />
                          </button>
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b last:border-0 ${border} group ${
                      isDark ? "hover:bg-white/[0.02]" : "hover:bg-black/[0.02]"
                    } transition-colors`}
                  >
                    {visibleCols.map((col) => {
                      const isPaperIdClick =
                        onPreviewPaper &&
                        ((selectedTable === "papers" && col === "id") ||
                         (selectedTable === "audio_files" && col === "paper_id" && row[col] != null));
                      const paperId = isPaperIdClick
                        ? Number(col === "id" ? row["id"] : row["paper_id"])
                        : null;
                      const paperTitle = isPaperIdClick && selectedTable === "papers"
                        ? String(row["title"] ?? "")
                        : "";
                      return (
                      <td key={col} className={cellCls(col)}>
                        {isPaperIdClick ? (
                          <button
                            type="button"
                            onClick={() => onPreviewPaper!(paperId!, paperTitle)}
                            className="font-mono text-xs text-rose-500 hover:underline tabular-nums"
                            title="Preview PDF"
                          >
                            {String(row[col])}
                          </button>
                        ) : (
                          <EditableCell
                            value={row[col]}
                            isEditable={EDITABLE_COLS[selectedTable]?.has(col) ?? false}
                            isDark={isDark}
                            multiline={col === "abstract" || col === "query"}
                            selectOptions={getCellSelectOpts(col, row)}
                            onSave={(val) => handleCellSave(i, col, val)}
                          />
                        )}
                      </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
