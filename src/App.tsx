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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  fileName: string;
  content: string;
  saved: boolean;
  undoStack: string[];
  undoIndex: number;
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tabCounter = 1;

function makeTab(fileName = "untitled.txt", content = ""): Tab {
  return {
    id: `tab-${tabCounter++}`,
    fileName,
    content,
    saved: true,
    undoStack: [content],
    undoIndex: 0,
  };
}

// ─── Btn component ────────────────────────────────────────────────────────────

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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Notepad() {
  const [tabs, setTabs] = useState<Tab[]>([makeTab()]);
  const [activeId, setActiveId] = useState<string>(tabs[0].id);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replaceQuery, setReplaceQuery] = useState<string>("");
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<CursorPos>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Active tab
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const { content, fileName, saved } = activeTab;

  // Derived counts
  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
  const charCount = content.length;

  // Update a field on the active tab
  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Ctrl+wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setFontSize((prev) => Math.min(40, Math.max(10, prev + (e.deltaY < 0 ? 1 : -1))));
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Auto-dismiss info tooltip
  useEffect(() => {
    if (!showInfo) return;
    const timer = setTimeout(() => setShowInfo(false), 4000);
    const handleClick = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClick); };
  }, [showInfo]);

  // Focus textarea when switching tabs
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [activeId]);

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  const pushUndo = useCallback((id: string, val: string) => {
    setTabs((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const next = t.undoStack.slice(0, t.undoIndex + 1);
      next.push(val);
      if (next.length > 100) next.shift();
      return { ...t, undoStack: next, undoIndex: next.length - 1 };
    }));
  }, []);

  const handleUndo = useCallback(() => {
    setTabs((prev) => prev.map((t) => {
      if (t.id !== activeId || t.undoIndex <= 0) return t;
      const newIdx = t.undoIndex - 1;
      return { ...t, content: t.undoStack[newIdx], undoIndex: newIdx };
    }));
  }, [activeId]);

  const handleRedo = useCallback(() => {
    setTabs((prev) => prev.map((t) => {
      if (t.id !== activeId || t.undoIndex >= t.undoStack.length - 1) return t;
      const newIdx = t.undoIndex + 1;
      return { ...t, content: t.undoStack[newIdx], undoIndex: newIdx };
    }));
  }, [activeId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value;
    updateTab(activeId, { content: val, saved: false });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => pushUndo(activeId, val), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "z") { e.preventDefault(); handleUndo(); }
    if (mod && e.key === "y") { e.preventDefault(); handleRedo(); }
    if (mod && e.key === "s") { e.preventDefault(); handleSave(); }
    if (mod && e.key === "f") { e.preventDefault(); setShowSearch((v) => !v); }
    if (mod && e.key === "t") { e.preventDefault(); handleNewTab(); }
    if (mod && e.key === "w") { e.preventDefault(); handleCloseTab(activeId); }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = content.substring(0, start) + "    " + content.substring(end);
      updateTab(activeId, { content: newVal, saved: false });
      setTimeout(() => { if (ta) ta.selectionStart = ta.selectionEnd = start + 4; }, 0);
    }
  };

  const handleCursorMove = (): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = content.substring(0, ta.selectionStart).split("\n");
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const handleNewTab = (): void => {
    const tab = makeTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };

  const handleCloseTab = (id: string): void => {
    const tab = tabs.find((t) => t.id === id);
    if (tab && !tab.saved && tab.content !== "") {
      if (!window.confirm(`Close "${tab.fileName}" with unsaved changes?`)) return;
    }
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = makeTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        const idx = prev.findIndex((t) => t.id === id);
        setActiveId(next[Math.min(idx, next.length - 1)].id);
      }
      return next;
    });
  };

  const handleOpen = (): void => fileInputRef.current?.click();

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      const text = ev.target?.result as string;
      // Open in new tab if current tab has content, else reuse
      if (content !== "") {
        const tab = makeTab(file.name, text);
        setTabs((prev) => [...prev, tab]);
        setActiveId(tab.id);
      } else {
        updateTab(activeId, { fileName: file.name, content: text, saved: true, undoStack: [text], undoIndex: 0 });
      }
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
    updateTab(activeId, { saved: true });
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
    updateTab(activeId, { content: content.substring(0, start) + content.substring(end), saved: false });
  };

  const handleFind = (): void => {
    if (!searchQuery) return;
    const idx = content.indexOf(searchQuery);
    if (idx === -1) return;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(idx, idx + searchQuery.length);
  };

  const handleReplace = (): void => {
    if (!searchQuery) return;
    updateTab(activeId, { content: content.replace(searchQuery, replaceQuery), saved: false });
  };

  const handleReplaceAll = (): void => {
    if (!searchQuery) return;
    updateTab(activeId, { content: content.split(searchQuery).join(replaceQuery), saved: false });
  };

  // ── Theme ─────────────────────────────────────────────────────────────────────

  const bg          = isDark ? "#1a1a1a" : "#f8f7f4";
  const surface     = isDark ? "#242424" : "#ffffff";
  const border      = isDark ? "#333"    : "#e2e0db";
  const textPrimary = isDark ? "#e8e6e0" : "#1c1b18";
  const textMuted   = isDark ? "#666"    : "#9b9890";
  const accent      = "#d85a30";
  const toolbarBg   = isDark ? "#1e1e1e" : "#f0ede8";
  const tabBarBg    = isDark ? "#191919" : "#e8e5e0";
  const tabActive   = isDark ? "#242424" : "#ffffff";
  const tabInactive = isDark ? "#1e1e1e" : "#dedad4";

  const btnProps = { isDark, border, accent, textPrimary };

  const shortcuts = [
    "Ctrl+S — Save",
    "Ctrl+Z/Y — Undo/Redo",
    "Ctrl+F — Find & Replace",
    "Ctrl+T — New tab",
    "Ctrl+W — Close tab",
    "Ctrl+Scroll — Zoom",
    "Tab — 4 spaces",
  ];

  const searchActions: [string, () => void][] = [
    ["Find", handleFind],
    ["Replace", handleReplace],
    ["Replace All", handleReplaceAll],
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: bg, color: textPrimary, width: "100vw", minHeight: "100vh", height: "100%", display: "flex", flexDirection: "column", transition: "background 0.2s, color 0.2s", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      <input ref={fileInputRef} type="file" accept=".txt,.md,.js,.ts,.jsx,.tsx,.css,.html,.json,.py,.csv" style={{ display: "none" }} onChange={handleFileLoad} />

      {/* ── Toolbar ── */}
      <div style={{ background: toolbarBg, borderBottom: `1px solid ${border}`, padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
          <FileText size={15} color={accent} />
          <span style={{ fontWeight: 600, fontSize: "13px" }}>Notepad</span>
        </div>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={handleNewTab} title="New tab (Ctrl+T)" {...btnProps}><FilePlus size={14} /><span className="lbl">New</span></Btn>
        <Btn onClick={handleOpen}   title="Open file"        {...btnProps}><FolderOpen size={14} /><span className="lbl">Open</span></Btn>
        <Btn onClick={handleSave}   title="Save (Ctrl+S)"    {...btnProps}><Save size={14} /><span className="lbl">Save</span></Btn>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={handleCut}  title="Cut"  {...btnProps}><Scissors size={14} /><span className="lbl">Cut</span></Btn>
        <Btn onClick={handleCopy} title="Copy" {...btnProps}><Copy size={14} /><span className="lbl">Copy</span></Btn>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={handleUndo} title="Undo (Ctrl+Z)" {...btnProps}><RotateCcw size={14} /></Btn>
        <Btn onClick={handleRedo} title="Redo (Ctrl+Y)" {...btnProps}><RotateCw size={14} /></Btn>

        <div style={{ width: "1px", height: "18px", background: border }} />

        <Btn onClick={() => setShowSearch((v) => !v)} title="Find & Replace (Ctrl+F)" active={showSearch} {...btnProps}><Search size={14} /></Btn>
        <Btn onClick={() => setWordWrap((v) => !v)}   title="Toggle word wrap"         active={wordWrap}   {...btnProps}><span style={{ fontSize: "11px" }}>Wrap</span></Btn>

        <div style={{ flex: 1 }} />

        {/* GitHub */}
        <a
          href="https://github.com/himal-bhattarai/text-editor"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          style={{ display: "flex", alignItems: "center", padding: "5px 9px", background: "transparent", border: `1px solid ${border}`, borderRadius: "6px", cursor: "pointer", color: textPrimary, textDecoration: "none", transition: "background 0.12s" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "#2e2e2e" : "#e8e4de")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg role="img" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
        </a>

        <Btn onClick={() => setIsDark((v) => !v)} title="Toggle dark mode" {...btnProps}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </Btn>

        {/* Info tooltip */}
        <div ref={infoRef} style={{ position: "relative" }}>
          <Btn onClick={() => setShowInfo((v) => !v)} title="Keyboard shortcuts" active={showInfo} {...btnProps}>
            <Info size={14} />
          </Btn>
          {showInfo && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: isDark ? "#1e1e1e" : "#ffffff", border: `1px solid ${border}`, borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: textMuted, display: "flex", flexDirection: "column", gap: "6px", zIndex: 200, whiteSpace: "nowrap", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.12)" }}>
              <b style={{ color: textPrimary, marginBottom: "2px" }}>Shortcuts</b>
              {shortcuts.map((s) => <span key={s}>{s}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div
        ref={tabBarRef}
        style={{ background: tabBarBg, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "flex-end", overflowX: "auto", scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              title={tab.fileName}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? textPrimary : textMuted,
                background: isActive ? tabActive : tabInactive,
                borderTop: isActive ? `2px solid ${accent}` : "2px solid transparent",
                borderRight: `1px solid ${border}`,
                borderBottom: isActive ? `1px solid ${tabActive}` : "none",
                whiteSpace: "nowrap",
                maxWidth: "180px",
                minWidth: "80px",
                userSelect: "none",
                transition: "background 0.12s, color 0.12s",
                position: "relative",
                marginBottom: isActive ? "-1px" : "0",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = isDark ? "#222" : "#e2deda"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = tabInactive; }}
            >
              {/* Unsaved dot */}
              {!tab.saved && (
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent, flexShrink: 0 }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{tab.fileName}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
                title="Close tab (Ctrl+W)"
                style={{ display: "flex", alignItems: "center", padding: "1px", background: "transparent", border: "none", cursor: "pointer", color: textMuted, borderRadius: "3px", flexShrink: 0, opacity: 0.7 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = textPrimary; e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; e.currentTarget.style.opacity = "0.7"; }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        {/* New tab button */}
        <button
          onClick={handleNewTab}
          title="New tab (Ctrl+T)"
          style={{ display: "flex", alignItems: "center", padding: "7px 10px", background: "transparent", border: "none", cursor: "pointer", color: textMuted, fontSize: "16px", lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = textMuted)}
        >
          +
        </button>
      </div>

      {/* ── File name bar ── */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "5px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
        <FileText size={12} color={textMuted} />
        <input
          value={fileName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTab(activeId, { fileName: e.target.value })}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "13px", color: textPrimary, fontWeight: 500 }}
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
          style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 9px", background: accent, border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "11px", color: "#fff", fontWeight: 500 }}
        >
          <Download size={11} /> Download
        </button>
      </div>

      {/* ── Search bar ── */}
      {showSearch && (
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Search size={13} color={textMuted} />
          <input
            placeholder="Find…"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleFind()}
            style={{ padding: "4px 10px", background: bg, border: `1px solid ${border}`, borderRadius: "6px", fontSize: "13px", color: textPrimary, outline: "none", width: "150px" }}
          />
          <input
            placeholder="Replace…"
            value={replaceQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplaceQuery(e.target.value)}
            style={{ padding: "4px 10px", background: bg, border: `1px solid ${border}`, borderRadius: "6px", fontSize: "13px", color: textPrimary, outline: "none", width: "150px" }}
          />
          {searchActions.map(([label, action]) => (
            <button
              key={label}
              onClick={action}
              style={{ padding: "4px 10px", background: "transparent", border: `1px solid ${border}`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", color: textPrimary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "#333" : "#e8e4de")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >{label}</button>
          ))}
          <button onClick={() => setShowSearch(false)} style={{ marginLeft: "auto", padding: "4px", background: "transparent", border: "none", cursor: "pointer", color: textMuted }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Editor ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <textarea
          key={activeId}
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorMove}
          onKeyUp={handleCursorMove}
          placeholder="Start typing here..."
          spellCheck
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            padding: "28px 36px",
            background: surface,
            color: textPrimary,
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
            fontSize: `${fontSize}px`,
            lineHeight: 1.8,
            letterSpacing: "0.01em",
            whiteSpace: wordWrap ? "pre-wrap" : "pre",
            overflowWrap: wordWrap ? "break-word" : "normal",
            overflowX: wordWrap ? "hidden" : "auto",
            overflowY: "auto",
            boxSizing: "border-box",
            transition: "background 0.2s, color 0.2s, font-size 0.08s",
            caretColor: accent,
          }}
        />
      </div>

      {/* ── Status bar ── */}
      <div style={{ background: toolbarBg, borderTop: `1px solid ${border}`, padding: "4px 16px", display: "flex", alignItems: "center", gap: "20px", fontSize: "11px", color: textMuted }}>
        <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span style={{ marginLeft: "auto" }}>{tabs.length} tab{tabs.length !== 1 ? "s" : ""} · {fontSize}px · {wordWrap ? "Wrap" : "No wrap"}</span>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; min-height: 100vh; overflow: hidden; }
        body { overflow-y: auto; }
        @media (max-width: 580px) { .lbl { display: none; } }
        textarea::selection { background: rgba(216,90,48,0.18); }
        textarea::placeholder { color: ${textMuted}; opacity: 1; }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}