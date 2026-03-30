import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { Theme } from "../App";

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
    color: "violet",
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
    color: "amber",
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

// ────────────────────────────────── Colour helpers

const COLORS: Record<string, { border: string; heading: string; badge: string; dimBadge: string }> = {
  rose:   { border: "border-rose-500/40",   heading: "text-rose-500",   badge: "bg-rose-500/15 text-rose-500",   dimBadge: "bg-rose-500/10 text-rose-300/60"   },
  violet: { border: "border-violet-500/40", heading: "text-violet-500", badge: "bg-violet-500/15 text-violet-500", dimBadge: "bg-violet-500/10 text-violet-300/60" },
  cyan:   { border: "border-cyan-500/40",   heading: "text-cyan-500",   badge: "bg-cyan-500/15 text-cyan-500",   dimBadge: "bg-cyan-500/10 text-cyan-300/60"   },
  amber:  { border: "border-amber-500/40",  heading: "text-amber-500",  badge: "bg-amber-500/15 text-amber-500", dimBadge: "bg-amber-500/10 text-amber-300/60"  },
};

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

function CellValue({ value }: { value: unknown }) {
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
  return <span className="font-mono text-xs break-all">{s}</span>;
}

// ────────────────────────────────── MainDatabase

export interface MainDatabaseProps {
  theme: Theme;
}

export function MainDatabase({ theme }: MainDatabaseProps) {
  const isDark  = theme === "dark";
  const border  = isDark ? "border-white/10" : "border-black/10";
  const dimText = isDark ? "text-white/40"   : "text-black/40";
  const inputBg = isDark
    ? "bg-white/5 border-white/10"
    : "bg-black/5 border-black/10";
  const cardBg  = isDark ? "bg-white/[0.03]" : "bg-black/[0.02]";

  const [selectedTable, setSelectedTable] = useState<TableName>("papers");
  const [rows,          setRows]          = useState<Record<string, unknown>[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    setRows([]);
    setError(null);
    setLoading(true);
    fetch(TABLE_ENDPOINTS[selectedTable])
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

  const columns = rows.length > 0 ? Object.keys(rows[0]) : SCHEMA[selectedTable].columns.map((c) => c.name);

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
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest opacity-50">
            Data Explorer
          </h2>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value as TableName)}
            className={`ml-auto text-xs font-mono px-2 py-1.5 rounded-md border ${inputBg} ${border} outline-none`}
          >
            {(Object.keys(TABLE_LABELS) as TableName[]).map((t) => (
              <option key={t} value={t}>{TABLE_LABELS[t]}</option>
            ))}
          </select>
        </div>

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
          <div className={`rounded-lg border ${border} overflow-x-auto`}>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className={`border-b ${border} ${cardBg}`}>
                  {columns.map((col) => {
                    const def = SCHEMA[selectedTable].columns.find((c) => c.name === col);
                    const isPk = def && "pk" in def && def.pk;
                    const isFk = def && "fk" in def && (def as { fk?: string }).fk;
                    const c = COLORS[SCHEMA[selectedTable].color];
                    return (
                      <th
                        key={col}
                        className={`px-3 py-2 font-mono font-semibold whitespace-nowrap ${c.heading}`}
                      >
                        <span className="flex items-center gap-1">
                          {col}
                          {isPk && <span className={`text-[9px] px-1 rounded ${c.badge}`}>PK</span>}
                          {isFk && <span className="text-[9px] px-1 rounded opacity-50">FK</span>}
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
                    className={`border-b last:border-0 ${border} ${
                      isDark ? "hover:bg-white/[0.02]" : "hover:bg-black/[0.02]"
                    } transition-colors`}
                  >
                    {columns.map((col) => (
                      <td key={col} className={`px-3 py-2 align-top max-w-xs`}>
                        <CellValue value={row[col]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
