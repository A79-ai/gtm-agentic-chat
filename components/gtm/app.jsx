// App shell — router, rail / bottom-nav + records sheet, theme, tweaks
import React, { useState, useEffect, useRef } from "react";
import { Icons } from "./icons";
import { EntityIcon } from "./ui";
import { HomeScreen } from "./home";
import { ConnectorsScreen } from "./connectors";
import { EntityList } from "./entitylist";
import { EntityDetail } from "./entitydetail";
import { ChatScreen } from "./chat";
import { NotetakerScreen } from "./notetaker";
import { FilesScreen } from "./files";
import { SideNav, BottomNav } from "./nav";
import { Onboarding } from "./onboarding";
import { AGENTS, ENTITY_ORDER, ENTITIES, countOf, useDataStatus, getConnectors } from "@/lib/gtm/data";

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");
const systemTheme = () => (mq().matches ? "dark" : "light");

function useTweaks() {
  const load = (k, d) => { try { return localStorage.getItem("ampup-" + k) || d; } catch { return d; } };
  const [themePref, setThemePref] = useState(() => load("theme", "dark"));
  const [accent, setAccent] = useState(() => load("accent", "gold"));
  const [density, setDensity] = useState(() => load("density", "comfortable"));
  const set = (k, v, fn) => { fn(v); try { localStorage.setItem("ampup-" + k, v); } catch {} };
  useEffect(() => {
    const apply = () => {
      const resolved = themePref === "system" ? systemTheme() : themePref;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    apply();
    if (themePref === "system") { const m = mq(); m.addEventListener("change", apply); return () => m.removeEventListener("change", apply); }
  }, [themePref]);
  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);
  useEffect(() => { document.documentElement.dataset.density = density; }, [density]);
  return { themePref, accent, density, setThemePref: (v) => set("theme", v, setThemePref), setAccent: (v) => set("accent", v, setAccent), setDensity: (v) => set("density", v, setDensity) };
}

function RecordsSheet({ openList, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        {ENTITY_ORDER.map((t) => (
          <div key={t} className="sheet-item" onClick={() => { openList(t); onClose(); }}>
            <EntityIcon type={t} size={38} />
            <span className="nm">{ENTITIES[t].plural}</span>
            <span className="ct">{countOf(t).toLocaleString()}</span>
            <Icons.ChevronRight size={18} style={{ color: "var(--fg-muted)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TweaksPanel({ t, onClose }) {
  const ref = useRef(null), drag = useRef(null);
  const onDown = (e) => {
    const el = ref.current, r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    const move = (ev) => { el.style.left = ev.clientX - drag.current.dx + "px"; el.style.top = ev.clientY - drag.current.dy + "px"; el.style.right = "auto"; el.style.bottom = "auto"; };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const Seg = ({ value, set, opts }) => (
    <div className="seg">{opts.map(([v, l, ic]) => <button key={v} className={value === v ? "on" : ""} onClick={() => set(v)}>{ic ? React.createElement(Icons[ic], { size: 14 }) : null}{l}</button>)}</div>
  );
  const accents = [["gold", "var(--g-500)"], ["teal", "var(--teal-base)"], ["mint", "var(--mint-base)"]];
  return (
    <div className="tweaks" ref={ref} style={{ right: 86, bottom: 18 }}>
      <div className="tweaks-head" onMouseDown={onDown}><Icons.Sliders size={15} style={{ marginRight: 8 }} /> Tweaks
        <button className="icon-btn" style={{ marginLeft: "auto", width: 28, height: 28 }} onClick={onClose}><Icons.X size={16} /></button></div>
      <div className="tweaks-body">
        <div><div className="tweak-label">Theme</div><Seg value={t.themePref} set={t.setThemePref} opts={[["light", "Light", "Sun"], ["dark", "Dark", "Moon"], ["system", "Auto", "Refresh"]]} /></div>
        <div><div className="tweak-label">Accent</div><div className="swatch-row">{accents.map(([k, c]) => <button key={k} className={"swatch" + (t.accent === k ? " on" : "")} style={{ background: c }} onClick={() => t.setAccent(k)} title={k}>{t.accent === k && <Icons.Check size={16} style={{ color: "#1a1200", position: "absolute", inset: 0, margin: "auto" }} />}</button>)}</div></div>
        <div><div className="tweak-label">Density</div><Seg value={t.density} set={t.setDensity} opts={[["comfortable", "Comfortable"], ["compact", "Compact"]]} /></div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const Ic = toast.type === "success" ? Icons.CheckCircle : toast.type === "error" ? Icons.X : Icons.Bell;
  return (
    <div style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 90, background: "var(--fg-primary)", color: "var(--bg-surface)", borderRadius: 9999, padding: "10px 18px", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 500, boxShadow: "var(--shadow-lg)", animation: "fadeUp .25s ease both" }}>
      <Ic size={16} style={{ color: toast.type === "success" ? "var(--mint-base)" : "var(--accent)" }} />{toast.msg}
    </div>
  );
}

export function App() {
  const { ready, refresh } = useDataStatus(); // re-render the tree when records/connectors load
  const t = useTweaks();
  const themeResolved = t.themePref === "system" ? systemTheme() : t.themePref;
  const [route, setRoute] = useState({ name: "home" });
  const [chatSeed, setChatSeed] = useState([]);
  const [chatResume, setChatResume] = useState(null);
  const [chatKey, setChatKey] = useState(0);
  const [connectors, setConnectors] = useState([]);
  useEffect(() => { setConnectors(getConnectors()); }, [ready]);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [profile, setProfile] = useState(() => { try { return JSON.parse(localStorage.getItem("ampup-profile") || "{}"); } catch { return {}; } });
  const [flow, setFlow] = useState(() => {
    try { return localStorage.getItem("ampup-onboarded") === "1" ? null : { name: "onboarding", firstRun: true }; } catch { return null; }
  });

  const showToast = (msg, type = "info") => { setToast({ msg, type }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2400); };
  const toggleTheme = () => t.setThemePref(themeResolved === "dark" ? "light" : "dark");

  const go = (name) => setRoute({ name });
  const openList = (type) => setRoute({ name: "list", type });
  const openRecord = (record) => setRoute({ name: "detail", record });
  const openChat = (seed) => { setChatSeed((seed || []).filter(Boolean)); setChatResume(null); setChatKey((k) => k + 1); setRoute({ name: "chat" }); };
  const openConversation = (conv) => { setChatSeed([]); setChatResume(conv); setChatKey((k) => k + 1); setRoute({ name: "chat" }); };

  const restartDemo = () => {
    ["onboarded", "profile"].forEach((k) => { try { localStorage.removeItem("ampup-" + k); } catch {} });
    window.location.reload();
  };
  const onboardingDone = (data) => {
    const p = { name: data.name, email: data.email, company: data.company, role: data.role, size: data.size, goals: data.goals, calendar: !!data.calendar };
    setProfile(p);
    try { localStorage.setItem("ampup-profile", JSON.stringify(p)); localStorage.setItem("ampup-onboarded", "1"); } catch {}
    const firstRun = flow && flow.firstRun;
    setFlow(null);
    if (firstRun) showToast("Welcome to AmpUp" + (data.name ? `, ${data.name.split(" ")[0]}` : "") + " 👋", "success");
  };

  const onProfileAction = (action) => {
    if (action === "notetaker") go("notetaker");
    else if (action === "files") go("files");
    else if (action === "tweaks") setTweaksOpen(true);
    else if (action === "onboarding") setFlow({ name: "onboarding", firstRun: false });
    else if (action === "restart") restartDemo();
    else if (action === "signout") showToast("Signed out (demo)", "info");
  };

  return (
    <div className="app">
      <SideNav route={route} go={go} openList={openList} openChat={openChat} themeResolved={themeResolved} toggleTheme={toggleTheme} profile={profile} on={onProfileAction} />
      <main className="main">
        {route.name === "home" && <HomeScreen agents={AGENTS} connectors={connectors} openChat={openChat} openList={openList} onNav={go} />}
        {route.name === "connectors" && <ConnectorsScreen connectors={connectors} onToast={showToast} />}
        {route.name === "notetaker" && <NotetakerScreen onToast={showToast} />}
        {route.name === "files" && <FilesScreen onNewChat={openChat} />}
        {route.name === "list" && <EntityList key={route.type} type={route.type} onOpen={openRecord} onChat={(recs) => openChat(recs || [])} onToast={showToast} onRefresh={refresh} />}
        {route.name === "detail" && <EntityDetail key={route.record.id} record={route.record} onOpen={openRecord} onChat={(r) => openChat([r])} onBack={() => openList(route.record.type)} />}
        {route.name === "chat" && <ChatScreen key={chatKey} seedAttached={chatSeed} resume={chatResume} onBack={() => go("home")} onOpenRecord={openRecord} onToast={showToast} onOpenConversation={openConversation} onNewChat={() => openChat([])} />}
      </main>
      <BottomNav route={route} go={go} openChat={openChat} onRecords={() => setSheet(true)} onProfile={() => setTweaksOpen((v) => !v)} />
      {sheet && <RecordsSheet openList={openList} onClose={() => setSheet(false)} />}
      {tweaksOpen && <TweaksPanel t={t} onClose={() => setTweaksOpen(false)} />}
      {flow && flow.name === "onboarding" && (
        <Onboarding initial={profile} onFinish={onboardingDone} onCancel={flow.firstRun ? null : () => setFlow(null)} />
      )}
      <Toast toast={toast} />
    </div>
  );
}
