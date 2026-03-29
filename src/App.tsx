import { useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Sidebar from "./components/Sidebar";
import Main from "./components/Main";
import PreviewPanel from "./components/PreviewPanel";

export type Theme = "dark" | "light";

export interface Paper {
  id: number;
  title: string;
  authors: string[];
  arxiv_id: string | null;
  pdf_path: string | null;
  created_at: string;
}

export interface AudioEntry {
  id: number;
  paper_id: number | null;
  filename: string;
  download_url: string;
  tts_backend: string;
  tts_voice: string;
  created_at: string;
}

export interface ConvertResult {
  audio_id: number;
  paper_id: number;
  audio_filename: string;
  download_url: string;
  title: string;
  num_pages: number;
}

export interface LivePreview {
  url: string;
  title: string;
}

function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [livePreviewPdf, setLivePreviewPdf] = useState<LivePreview | null>(null);
  const [activeAudio, setActiveAudio] = useState<AudioEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-black text-white" : "bg-white text-black";

  const refreshLibrary = () => setRefreshKey((k) => k + 1);

  // When a library paper is selected, clear live preview (and vice versa)
  const handleSelectPaper = (p: Paper | null) => {
    setSelectedPaper(p);
    if (p) setLivePreviewPdf(null);
  };

  const handleSetLivePreview = (preview: LivePreview | null) => {
    setLivePreviewPdf(preview);
    if (preview) setSelectedPaper(null);
  };

  // Derive the preview to show (library paper takes precedence when explicitly selected)
  const activePreview: LivePreview | null = selectedPaper
    ? { url: `/api/library/pdf/${selectedPaper.id}`, title: selectedPaper.title }
    : livePreviewPdf;

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-mono ${bg}`}>
      <Header theme={theme} toggleTheme={() => setTheme(isDark ? "light" : "dark")} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          theme={theme}
          refreshKey={refreshKey}
          selectedPaper={selectedPaper}
          setSelectedPaper={handleSelectPaper}
          setActiveAudio={setActiveAudio}
          onDeleted={refreshLibrary}
        />
        <Main
          theme={theme}
          activeAudio={activeAudio}
          setActiveAudio={setActiveAudio}
          onConverted={refreshLibrary}
          setLivePreviewPdf={handleSetLivePreview}
        />
        {activePreview && (
          <PreviewPanel
            theme={theme}
            title={activePreview.title}
            pdfUrl={activePreview.url}
            onClose={() => {
              setSelectedPaper(null);
              setLivePreviewPdf(null);
            }}
          />
        )}
      </div>
      <Footer theme={theme} />
    </div>
  );
}

export default App;
