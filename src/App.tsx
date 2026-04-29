import { useState, useRef, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import {
  FileText,
  Save,
  FolderOpen,
  FilePlus,
  Copy,
  Scissors,
  RotateCcw,
  RotateCw,
  Search,
  X,
  Moon,
  Sun,
  Download,
  Info,
} from "lucide-react";

const INITIAL_TEXT = "Welcome to Notepad.\n\nStart typing here...";

interface CursorPos {
  line: number;
  col: number;
}

interface BtnProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: ReactNode;
  isDark: boolean;
  border: string;
  accent: string;
  textPrimary: string;
}

function Btn({ onClick, title, active = false, children, isDark, border, accent, textPrimary }: BtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "5px 9px",
        background: active ? (isDark ? "#3a2a22" : "#f0ddd5") : "transparent",
        border: `1px solid ${active ? accent : border}`,
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "12px",
        color: active ? accent : textPrimary,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "#2e2e2e" : "#e8e4de")}
      onMouseLeave={(e) => (e.currentTarget.style.background = active ? (isDark ? "#3a2a22" : "#f0ddd5") : "transparent")}
    >
      {children}
    </button>
  );
}

export default function Notepad() {
  const [content, setContent] = useState<string>(INITIAL_TEXT);
  const [fileName, setFileName] = useState<string>("untitled.txt");
  const [isDark, setIsDark] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replaceQuery, setReplaceQuery] = useState<string>("");
  const [wordCount, setWordCount] = useState<number>(3);
  const [charCount, setCharCount] = useState<number>(0);
  const [saved, setSaved] = useState<boolean>(true);
  const [, setUndoIndex] = useState<number>(0);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<CursorPos>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStackRef = useRef<string[]>([INITIAL_TEXT]);
  const undoIndexRef = useRef<number>(0);

  // Word / char count
  useEffect(() => {
    const words = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
    setWordCount(words);
    setCharCount(content.length);
  }, [content]);

  // Ctrl + wheel → zoom font size
  useEffect(() => {
    const handleWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      setFontSize((prev) => Math.min(40, Math.max(10, prev + delta)));
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  const pushUndo = useCallback((val: string): void => {
    const idx = undoIndexRef.current;
    const next = undoStackRef.current.slice(0, idx + 1);
    next.push(val);
    if (next.length > 100) next.shift();
    undoStackRef.current = next;
    const newIdx = next.length - 1;
    undoIndexRef.current = newIdx;
    setUndoIndex(newIdx);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value;
    setContent(val);
    setSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => pushUndo(val), 500);
  };

  const handleUndo = (): void => {
    const idx = undoIndexRef.current;
    if (idx > 0) {
      setContent(undoStackRef.current[idx - 1]);
      undoIndexRef.current = idx - 1;
      setUndoIndex(idx - 1);
    }
  };

  const handleRedo = (): void => {
    const idx = undoIndexRef.current;
    if (idx < undoStackRef.current.length - 1) {
      setContent(undoStackRef.current[idx + 1]);
      undoIndexRef.current = idx + 1;
      setUndoIndex(idx + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "z") { e.preventDefault(); handleUndo(); }
    if (mod && e.key === "y") { e.preventDefault(); handleRedo(); }
    if (mod && e.key === "s") { e.preventDefault(); handleSave(); }
    if (mod && e.key === "f") { e.preventDefault(); setShowSearch((v) => !v); }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = content.substring(0, start) + "    " + content.substring(end);
      setContent(newVal);
      setTimeout(() => {
        if (ta) { ta.selectionStart = ta.selectionEnd = start + 4; }
      }, 0);
    }
  };

  const handleCursorMove = (): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = content.substring(0, ta.selectionStart).split("\n");
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const handleNew = (): void => {
    if (!saved && content !== "") {
      if (!window.confirm("Unsaved changes. Create new file?")) return;
    }
    setContent("");
    setFileName("untitled.txt");
    setSaved(true);
    undoStackRef.current = [""];
    undoIndexRef.current = 0;
    setUndoIndex(0);
  };

  const handleOpen = (): void => fileInputRef.current?.click();

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      const text = ev.target?.result as string;
      setContent(text);
      setFileName(file.name);
      setSaved(true);
      undoStackRef.current = [text];
      undoIndexRef.current = 0;
      setUndoIndex(0);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSave = (): void => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  const handleCopy = (): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    navigator.clipboard.writeText(content.substring(ta.selectionStart, ta.selectionEnd) || content);
  };

  const handleCut = (): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    navigator.clipboard.writeText(content.substring(start, end));
    setContent(content.substring(0, start) + content.substring(end));
    setSaved(false);
  };

  const handleFind = (): void => {
    if (!searchQuery) return;
    const idx = content.indexOf(searchQuery);
    if (idx === -1) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(idx, idx + searchQuery.length);
  };

  const handleReplace = (): void => {
    if (!searchQuery) return;
    setContent(content.replace(searchQuery, replaceQuery));
    setSaved(false);
  };

  const handleReplaceAll = (): void => {
    if (!searchQuery) return;
    setContent(content.split(searchQuery).join(replaceQuery));
    setSaved(false);
  };

  // Theme tokens
  const bg = isDark ? "#1a1a1a" : "#f8f7f4";
  const surface = isDark ? "#242424" : "#ffffff";
  const border = isDark ? "#333" : "#e2e0db";
  const textPrimary = isDark ? "#e8e6e0" : "#1c1b18";
  const textMuted = isDark ? "#666" : "#9b9890";
  const accent = "#d85a30";
  const toolbarBg = isDark ? "#1e1e1e" : "#f0ede8";

  const btnProps = { isDark, border, accent, textPrimary };

  const shortcuts: string[] = [
    "Ctrl+S — Save",
    "Ctrl+Z/Y — Undo/Redo",
    "Ctrl+F — Find & Replace",
    "Ctrl+Scroll — Zoom in/out",
    "Tab — 4 spaces",
  ];

  const searchActions: [string, () => void][] = [
    ["Find", handleFind],
    ["Replace", handleReplace],
    ["Replace All", handleReplaceAll],
  ];

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        background: bg,
        color: textPrimary,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.js,.ts,.jsx,.tsx,.css,.html,.json,.py,.csv"
        style={{ display: "none" }}
        onChange={handleFileLoad}
      />

      {/* Toolbar */}
      <div
        style={{
          background: toolbarBg,
          borderBottom: `1px solid ${border}`,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
          <FileText size={15} color={accent} />
          <span style={{ fontWeight: 600, fontSize: "13px" }}>Notepad</span>
        </div>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={handleNew} title="New (Ctrl+N)" {...btnProps}>
          <FilePlus size={14} /><span className="lbl">New</span>
        </Btn>
        <Btn onClick={handleOpen} title="Open file" {...btnProps}>
          <FolderOpen size={14} /><span className="lbl">Open</span>
        </Btn>
        <Btn onClick={handleSave} title="Save (Ctrl+S)" {...btnProps}>
          <Save size={14} /><span className="lbl">Save</span>
        </Btn>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={handleCut} title="Cut" {...btnProps}>
          <Scissors size={14} /><span className="lbl">Cut</span>
        </Btn>
        <Btn onClick={handleCopy} title="Copy" {...btnProps}>
          <Copy size={14} /><span className="lbl">Copy</span>
        </Btn>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={handleUndo} title="Undo (Ctrl+Z)" {...btnProps}>
          <RotateCcw size={14} />
        </Btn>
        <Btn onClick={handleRedo} title="Redo (Ctrl+Y)" {...btnProps}>
          <RotateCw size={14} />
        </Btn>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={() => setShowSearch((v) => !v)} title="Find & Replace (Ctrl+F)" active={showSearch} {...btnProps}>
          <Search size={14} />
        </Btn>
        <Btn onClick={() => setWordWrap((v) => !v)} title="Toggle word wrap" active={wordWrap} {...btnProps}>
          <span style={{ fontSize: "11px" }}>Wrap</span>
        </Btn>

        <div style={{ flex: 1 }} />

        <Btn onClick={() => setIsDark((v) => !v)} title="Toggle dark mode" {...btnProps}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </Btn>
        <Btn onClick={() => setShowInfo((v) => !v)} title="Keyboard shortcuts" active={showInfo} {...btnProps}>
          <Info size={14} />
        </Btn>
      </div>

      {/* File name bar */}
      <div
        style={{
          background: surface,
          borderBottom: `1px solid ${border}`,
          padding: "5px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <FileText size={12} color={textMuted} />
        <input
          value={fileName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFileName(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: textPrimary,
            fontWeight: 500,
          }}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            const dot = e.target.value.lastIndexOf(".");
            e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
          }}
        />
        <span style={{ fontSize: "11px", color: saved ? textMuted : accent, fontWeight: saved ? 400 : 500 }}>
          {saved ? "Saved" : "Unsaved"}
        </span>
        <button
          onClick={handleSave}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 9px",
            background: accent,
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "11px",
            color: "#fff",
            fontWeight: 500,
          }}
        >
          <Download size={11} /> Download
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div
          style={{
            background: surface,
            borderBottom: `1px solid ${border}`,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <Search size={13} color={textMuted} />
          <input
            placeholder="Find…"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleFind()}
            style={{
              padding: "4px 10px",
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: "6px",
              fontSize: "13px",
              color: textPrimary,
              outline: "none",
              width: "150px",
            }}
          />
          <input
            placeholder="Replace…"
            value={replaceQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplaceQuery(e.target.value)}
            style={{
              padding: "4px 10px",
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: "6px",
              fontSize: "13px",
              color: textPrimary,
              outline: "none",
              width: "150px",
            }}
          />
          {searchActions.map(([label, action]) => (
            <button
              key={label}
              onClick={action}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: `1px solid ${border}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                color: textPrimary,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "#333" : "#e8e4de")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowSearch(false)}
            style={{ marginLeft: "auto", padding: "4px", background: "transparent", border: "none", cursor: "pointer", color: textMuted }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Info panel */}
      {showInfo && (
        <div
          style={{
            background: isDark ? "#1c1c1c" : "#fdfcfa",
            borderBottom: `1px solid ${border}`,
            padding: "8px 16px",
            fontSize: "12px",
            color: textMuted,
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <b style={{ color: textPrimary }}>Shortcuts</b>
          {shortcuts.map((s) => <span key={s}>{s}</span>)}
          <button
            onClick={() => setShowInfo(false)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: textMuted }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorMove}
          onKeyUp={handleCursorMove}
          spellCheck
          style={{
            flex: 1,
            width: "100%",
            minHeight: "calc(100vh - 180px)",
            padding: "28px 36px",
            background: surface,
            color: textPrimary,
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "'Courier New', 'Consolas', monospace",
            fontSize: `${fontSize}px`,
            lineHeight: 1.75,
            whiteSpace: wordWrap ? "pre-wrap" : "pre",
            overflowWrap: wordWrap ? "break-word" : "normal",
            overflowX: wordWrap ? "hidden" : "auto",
            boxSizing: "border-box",
            transition: "background 0.2s, color 0.2s, font-size 0.08s",
            caretColor: accent,
          }}
        />
      </div>

      {/* Status bar */}
      <div
        style={{
          background: toolbarBg,
          borderTop: `1px solid ${border}`,
          padding: "4px 16px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: "11px",
          color: textMuted,
        }}
      >
        <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span style={{ marginLeft: "auto" }}>{fontSize}px · {wordWrap ? "Wrap" : "No wrap"}</span>
      </div>

      <style>{`
        @media (max-width: 580px) { .lbl { display: none; } }
        textarea::selection { background: rgba(216,90,48,0.18); }
      `}</style>
    </div>
  );
}