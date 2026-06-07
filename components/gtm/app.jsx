// App shell — router, rail / bottom-nav + records sheet, theme, tweaks
import React, { useState, useEffect, useRef } from "react";
import { Icons, LogoMark } from "./icons";
import { EntityIcon } from "./ui";
import { HomeScreen } from "./home";
import { ConnectorsScreen } from "./connectors";
import { EntityList } from "./entitylist";
import { EntityDetail } from "./entitydetail";
import { ChatScreen } from "./chat";
import { NotetakerScreen } from "./notetaker";
import { PlansScreen } from "./plans";
import { AGENTS, ENTITY_ORDER, ENTITIES, recordsOf, useDataStatus, getConnectors } from "@/lib/gtm/data";

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");
const systemTheme = () => (mq().matches ? "dark" : "light");

function useTweaks() {
  const load = (k, d) => { try { return localStorage.getItem("ampup-" + k) || d; } catch { return d; } };
  const [themePref, setThemePref] = useState(() => load("theme", "dark"));
  const [accent, setAccent] = useState(() => load("accent", "gold"));
  const [density, setDensity] = useState(() => load("density", "comfortable"));
  const set = (k, v, fn) => { fn(v); try { localStorage.setItem("ampup-" + k, v); } catch {} };
  useEffect(() => {
    const apply = () => { document.documentElement.dataset.theme = themePref === "system" ? systemTheme() : themePref; };
    apply();
    if (themePref === "system") { const m = mq(); m.addEventListener("change", apply); return () => m.removeEventListener("change", apply); }
  }, [themePref]);
  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);
  useEffect(() => { document.documentElement.dataset.density = density; }, [density]);
  return { themePref, accent, density, setThemePref: (v) => set("theme", v, setThemePref), setAccent: (v) => set("accent", v, setAccent), setDensity: (v) => set("density", v, setDensity) };
}

function Rail({ route, go, openList, openChat, themeResolved, toggleTheme, onTweaks }) {
  const isEntity = (t) => (route.name === "list" && route.type === t) || (route.name === "detail" && route.record.type === t);
  const Btn = ({ active, title, onClick, icon }) => (
    <button className={"rail-btn" + (active ? " active" : "")} title={title} onClick={onClick}>{React.createElement(icon, { size: 21 })}</button>
  );
  return (
    <nav className="rail">
      <div className="rail-logo" style={{ color: "#FDFCF7" }}><LogoMark size={26} /></div>
      <div className="rail-scroll">
        <Btn active={route.name === "home"} title="Home" icon={Icons.Home} onClick={() => go("home")} />
        <Btn active={route.name === "chat"} title="Chat" icon={Icons.Chat} onClick={() => openChat([])} />
        <div className="rail-divider" />
        {ENTITY_ORDER.map((t) => (
          <Btn key={t} active={isEntity(t)} title={ENTITIES[t].plural} icon={Icons[ENTITIES[t].icon]} onClick={() => openList(t)} />
        ))}
        <div className="rail-divider" />
        <Btn active={route.name === "connectors"} title="Connectors" icon={Icons.Plug} onClick={() => go("connectors")} />
        <Btn active={route.name === "notetaker"} title="Notetaker" icon={Icons.Brain} onClick={() => go("notetaker")} />
        <Btn active={route.name === "plans"} title="Plans" icon={Icons.Zap} onClick={() => go("plans")} />
      </div>
      <button className="rail-btn" title="Toggle theme" onClick={toggleTheme}>{React.createElement(themeResolved === "dark" ? Icons.Sun : Icons.Moon, { size: 20 })}</button>
      <button className="rail-btn" title="Tweaks" onClick={onTweaks}><Icons.Sliders size={20} /></button>
      <button className="rail-btn" title="Profile"><Icons.User size={20} /></button>
    </nav>
  );
}

function BottomNav({ route, go, openChat, onRecords, onTweaks }) {
  const a = (n) => (route.name === n ? "active" : "");
  const recordsActive = route.name === "list" || route.name === "detail" ? "active" : "";
  return (
    <nav className="botnav">
      <button className={a("home")} onClick={() => go("home")}><Icons.Home size={21} />Home</button>
      <button className={recordsActive} onClick={onRecords}><Icons.Layers size={21} />Records</button>
      <button className={a("chat")} onClick={() => openChat([])}><Icons.Chat size={21} />Chat</button>
      <button className={a("connectors")} onClick={() => go("connectors")}><Icons.Plug size={21} />Tools</button>
      <button onClick={onTweaks}><Icons.Sliders size={21} />Tweaks</button>
    </nav>
  );
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
            <span className="ct">{recordsOf(t).length}</span>
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
  const { ready } = useDataStatus(); // re-render the tree when records/connectors load
  const t = useTweaks();
  const themeResolved = t.themePref === "system" ? systemTheme() : t.themePref;
  const [route, setRoute] = useState({ name: "home" });
  const [chatSeed, setChatSeed] = useState([]);
  const [connectors, setConnectors] = useState([]);
  useEffect(() => { setConnectors(getConnectors()); }, [ready]);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = "info") => { setToast({ msg, type }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2400); };
  const toggleTheme = () => t.setThemePref(themeResolved === "dark" ? "light" : "dark");

  const go = (name) => setRoute({ name });
  const openList = (type) => setRoute({ name: "list", type });
  const openRecord = (record) => setRoute({ name: "detail", record });
  const openChat = (seed) => { setChatSeed((seed || []).filter(Boolean)); setRoute({ name: "chat" }); };

  return (
    <div className="app">
      <Rail route={route} go={go} openList={openList} openChat={openChat} themeResolved={themeResolved} toggleTheme={toggleTheme} onTweaks={() => setTweaksOpen((v) => !v)} />
      <main className="main">
        {route.name === "home" && <HomeScreen agents={AGENTS} connectors={connectors} openChat={openChat} openList={openList} onNav={go} />}
        {route.name === "connectors" && <ConnectorsScreen connectors={connectors} onToast={showToast} />}
        {route.name === "notetaker" && <NotetakerScreen onToast={showToast} />}
        {route.name === "plans" && <PlansScreen onToast={showToast} />}
        {route.name === "list" && <EntityList key={route.type} type={route.type} onOpen={openRecord} onChat={() => openChat([])} />}
        {route.name === "detail" && <EntityDetail key={route.record.id} record={route.record} onOpen={openRecord} onChat={(r) => openChat([r])} onBack={() => openList(route.record.type)} />}
        {route.name === "chat" && <ChatScreen key={chatSeed.map((r) => r.id).join(",")} seedAttached={chatSeed} onBack={() => go("home")} onOpenRecord={openRecord} onToast={showToast} />}
      </main>
      <BottomNav route={route} go={go} openChat={openChat} onRecords={() => setSheet(true)} onTweaks={() => setTweaksOpen((v) => !v)} />
      {sheet && <RecordsSheet openList={openList} onClose={() => setSheet(false)} />}
      {tweaksOpen && <TweaksPanel t={t} onClose={() => setTweaksOpen(false)} />}
      <Toast toast={toast} />
    </div>
  );
}
