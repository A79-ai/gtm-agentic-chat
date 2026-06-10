// App shell — router, rail / bottom-nav + records sheet, theme, tweaks
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Icons } from "./icons";
import { AUTH0_ENABLED } from "@/lib/gtm/auth";
import { EntityIcon } from "./ui";
import { HomeScreen } from "./home";
import { ConnectorsScreen } from "./connectors";
import { EntityList } from "./entitylist";
import { EntityDetail } from "./entitydetail";
import { ChatScreen } from "./chat";
import { NotetakerScreen } from "./notetaker";
import { FilesScreen } from "./files";
import { PlansScreen } from "./plans";
import { SideNav, BottomNav } from "./nav";
import { Onboarding } from "./onboarding";
import { Signup } from "./signup";
import { AgentBuilder } from "./agentbuilder";
import { ENTITY_ORDER, ENTITIES, countOf, useDataStatus, getConnectors, byId } from "@/lib/gtm/data";
import { listAgents, duplicateAgent } from "@/lib/gtm/agents";
import { CONFIG } from "@/lib/gtm/config";
import { getAccount, isSignedUp, saveAccount, startTrial, resetBilling, billingStatus, refreshBillingStatus } from "@/lib/gtm/billing";

const mq = () => window.matchMedia("(prefers-color-scheme: dark)");
const systemTheme = () => (mq().matches ? "dark" : "light");

// Named screens that map 1:1 to /<name>. "home" maps to "/".
const NAMED_ROUTES = ["home", "chat", "connectors", "notetaker", "files", "plans"];

function pathForRoute(route) {
  if (!route || !route.name) return "/";
  if (route.name === "home") return "/";
  if (route.name === "list") return `/records/${route.type}`;
  if (route.name === "detail") {
    const r = route.record || {};
    return r.type && r.id ? `/records/${r.type}/${r.id}` : "/records";
  }
  return `/${route.name}`;
}

function routeForPath(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "home" };
  const seg = path.split("/").filter(Boolean);
  if (seg[0] === "records") {
    const type = seg[1];
    if (!type) return { name: "home" };
    if (seg[2]) {
      const record = byId(seg[2]);
      return record ? { name: "detail", record } : { name: "list", type };
    }
    return { name: "list", type };
  }
  if (NAMED_ROUTES.includes(seg[0])) return { name: seg[0] };
  return { name: "home" };
}

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

// Soft trial nag in the app shell. Never hard-blocks (demo trial clock is
// trivially bypassed; hard gating only makes sense once a real provider is the
// source of truth). Hidden on the plans page, which shows its own status strip.
function TrialBanner({ route, onUpgrade }) {
  if (!CONFIG.billing.enabled || route.name === "plans") return null;
  const st = billingStatus();
  if (st.state !== "trialing" && st.state !== "expired") return null;
  const expired = st.state === "expired";
  return (
    <div className="trial-banner">
      {expired ? <Icons.Bell size={15} /> : <Icons.Spark size={15} />}
      <span>{expired ? "Your free trial has ended." : `${st.daysLeft} day${st.daysLeft === 1 ? "" : "s"} left in your free trial.`}</span>
      <button className="btn btn-sm btn-primary" onClick={onUpgrade}>Upgrade</button>
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

export function App({ authUser, onAuth0Logout } = {}) {
  const { ready, refresh } = useDataStatus(); // re-render the tree when records/connectors load

  // Onboarding completion is remembered PER signed-in user — the app is
  // multi-tenant (a shared free-trial org), so a returning user skips
  // onboarding on every later login, while a different user on the same
  // browser still gets their own first run. Keyed off the stable Auth0 id.
  const userKey = (authUser && (authUser.sub || authUser.email)) || "local";
  const OB_KEY = `ampup-onboarded:${userKey}`;
  const PROFILE_KEY = `ampup-profile:${userKey}`;
  // True once this user has finished onboarding. Falls back to the legacy,
  // pre-multi-tenant single key and migrates it to this user once (then clears
  // it), so an already-onboarded user isn't sent through onboarding again.
  const readOnboarded = () => {
    try {
      if (localStorage.getItem(OB_KEY) === "1") return true;
      if (localStorage.getItem("ampup-onboarded") === "1") {
        localStorage.setItem(OB_KEY, "1");
        const lp = localStorage.getItem("ampup-profile");
        if (lp && !localStorage.getItem(PROFILE_KEY)) localStorage.setItem(PROFILE_KEY, lp);
        localStorage.removeItem("ampup-onboarded");
        localStorage.removeItem("ampup-profile");
        return true;
      }
      return false;
    } catch { return false; }
  };
  const t = useTweaks();
  const themeResolved = t.themePref === "system" ? systemTheme() : t.themePref;
  const [route, setRoute] = useState(() => routeForPath(window.location.pathname));
  const [chatSeed, setChatSeed] = useState([]);
  const [chatResume, setChatResume] = useState(null);
  const [chatAgent, setChatAgent] = useState(null);
  const [chatKey, setChatKey] = useState(0);
  const [builder, setBuilder] = useState(null); // null | "new" | agent
  const [agentsVersion, setAgentsVersion] = useState(0);
  const agents = useMemo(() => listAgents(), [agentsVersion, ready]);
  const [connectors, setConnectors] = useState([]);
  useEffect(() => { setConnectors(getConnectors()); }, [ready]);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [profile, setProfile] = useState(() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || localStorage.getItem("ampup-profile") || "{}"); } catch { return {}; } });
  const [account, setAccount] = useState(() => getAccount());
  // When Auth0 owns identity, show the real signed-in user in the profile menu.
  const navProfile = authUser
    ? { ...profile, name: profile.name || authUser.name || authUser.email, email: authUser.email || profile.email, picture: authUser.picture }
    : profile;
  // Pre-fill the onboarding "About you" step from the signed-in Auth0 profile.
  // Auth0's `name` is often just the email for database users — fall back to
  // given/family name in that case so we don't drop the email into the name box.
  const onboardingInitial = (() => {
    if (!authUser) return profile;
    const realName =
      authUser.name && authUser.name !== authUser.email
        ? authUser.name
        : [authUser.given_name, authUser.family_name].filter(Boolean).join(" ");
    return {
      ...profile,
      name: profile.name || realName || "",
      email: profile.email || authUser.email || "",
    };
  })();
  const [flow, setFlow] = useState(() => {
    if (CONFIG.signup.enabled && !AUTH0_ENABLED && !isSignedUp()) return { name: "signup", firstRun: true };
    if (CONFIG.onboarding.enabled && !readOnboarded()) return { name: "onboarding", firstRun: true };
    return null;
  });

  const showToast = (msg, type = "info") => { setToast({ msg, type }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2400); };
  const toggleTheme = () => t.setThemePref(themeResolved === "dark" ? "light" : "dark");
  const [, setBillingTick] = useState(0);

  // Stripe provider: pull live entitlement (by signup email) on load and after a
  // checkout return, then re-render so the trial banner reflects Stripe truth.
  useEffect(() => {
    if (CONFIG.billing.provider !== "stripe") return;
    refreshBillingStatus().then(() => setBillingTick((n) => n + 1));
    const params = new URLSearchParams(window.location.search);
    const b = params.get("billing");
    if (b === "success") showToast("Subscription active — welcome to Pro! 🎉", "success");
    else if (b === "cancelled") showToast("Checkout cancelled — no charge made.", "info");
    if (b) window.history.replaceState({ route }, "", window.location.pathname);
  }, []);

  // Single entry point for forward navigation: update state + push a matching
  // URL so the address bar and Back/Forward stay in sync. The full route object
  // (record included) is stored in history state so popstate can restore it.
  const navigate = (next) => { setRoute(next); window.history.pushState({ route: next }, "", pathForRoute(next)); };

  const go = (name) => navigate({ name });
  const openList = (type) => navigate({ name: "list", type });
  const openRecord = (record) => navigate({ name: "detail", record });
  const openChat = (seed) => { setChatSeed((seed || []).filter(Boolean)); setChatResume(null); setChatAgent(null); setChatKey((k) => k + 1); navigate({ name: "chat" }); };
  const openConversation = (conv) => { setChatSeed([]); setChatResume(conv); setChatAgent(null); setChatKey((k) => k + 1); navigate({ name: "chat" }); };
  const openAgent = (agent, seed) => {
    if (agent?.enterprise) { showToast(`${agent.name} is an Enterprise agent — contact sales to enable it.`, "info"); return; }
    setChatSeed((seed || []).filter(Boolean)); setChatResume(null); setChatAgent(agent); setChatKey((k) => k + 1); navigate({ name: "chat" });
  };

  // Sync the initial history entry with the starting route (so the first Back
  // works), and restore route state on Back/Forward. The popstate handler only
  // calls setRoute — never pushState — to avoid navigation loops.
  useEffect(() => {
    window.history.replaceState({ route }, "", pathForRoute(route) + window.location.search);
    const onPop = (e) => setRoute(e.state?.route || routeForPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const restartDemo = () => {
    [OB_KEY, PROFILE_KEY].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    resetBilling();
    window.location.reload();
  };
  const signupDone = (data) => {
    saveAccount({ name: data.name, email: data.email, company: data.company });
    if (CONFIG.billing.enabled) startTrial();
    setAccount(getAccount());
    const next = { ...profile, name: data.name, email: data.email, company: data.company };
    setProfile(next);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch {}
    if (CONFIG.onboarding.enabled && !readOnboarded()) setFlow({ name: "onboarding", firstRun: true });
    else { setFlow(null); showToast("Welcome to AmpUp" + (data.name ? `, ${data.name.split(" ")[0]}` : "") + " 👋", "success"); }
  };

  // Google sign-in: if a session cookie is present, treat it as a completed
  // signup (verified email drives the trial/billing). Also toasts on return.
  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => {
      const newGoogle = d && d.user && d.user.email && !isSignedUp();
      if (newGoogle) signupDone({ name: d.user.name || "", email: d.user.email, company: "" });
      const params = new URLSearchParams(window.location.search);
      const s = params.get("signin");
      if (s === "google" && !newGoogle) showToast("Signed in with Google", "success");
      else if (s === "error") showToast("Google sign-in didn’t complete — try again", "error");
      if (s) window.history.replaceState({ route }, "", window.location.pathname);
    }).catch(() => {});
  }, []);
  const onboardingDone = (data) => {
    const p = { name: data.name, email: data.email, company: data.company, role: data.role, size: data.size, goals: data.goals, calendar: !!data.calendar };
    setProfile(p);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); localStorage.setItem(OB_KEY, "1"); } catch {}
    const firstRun = flow && flow.firstRun;
    setFlow(null);
    if (firstRun) showToast("Welcome to AmpUp" + (data.name ? `, ${data.name.split(" ")[0]}` : "") + " 👋", "success");
  };

  const onProfileAction = (action) => {
    if (action === "notetaker") go("notetaker");
    else if (action === "files") go("files");
    else if (action === "plans") go("plans");
    else if (action === "tweaks") setTweaksOpen(true);
    else if (action === "onboarding") setFlow({ name: "onboarding", firstRun: false });
    else if (action === "restart") restartDemo();
    else if (action === "signout") {
      // End the auth session. Under Auth0 we must call logout() — the session
      // lives in localStorage and would otherwise silently re-authenticate on
      // reload. Auth0 logout redirects to origin, landing on the sign-in screen
      // (so no manual reload here). We intentionally KEEP the per-user
      // onboarding/profile keys so a returning user isn't re-onboarded on every
      // login; "Restart" replays onboarding for the current user on demand.
      resetBilling();
      if (AUTH0_ENABLED && onAuth0Logout) {
        onAuth0Logout();
      } else {
        // Legacy single-org path: clear the Google session cookie, then reload.
        fetch("/api/auth/session", { method: "POST" }).catch(() => {}).finally(() => restartDemo());
      }
    }
  };

  return (
    <div className="app">
      <SideNav route={route} go={go} openList={openList} openChat={openChat} themeResolved={themeResolved} toggleTheme={toggleTheme} profile={navProfile} on={onProfileAction} />
      <main className="main">
        <TrialBanner route={route} onUpgrade={() => go("plans")} />
        {route.name === "home" && <HomeScreen agents={agents} connectors={connectors} openChat={openChat} openAgent={openAgent} openList={openList} onNav={go} onCreateAgent={() => setBuilder("new")} onEditAgent={(a) => setBuilder(a)} onCopyAgent={(a) => { duplicateAgent(a); setAgentsVersion((v) => v + 1); showToast(`Duplicated ${a.name}`, "success"); }} />}
        {route.name === "connectors" && <ConnectorsScreen connectors={connectors} onToast={showToast} />}
        {route.name === "notetaker" && <NotetakerScreen onToast={showToast} />}
        {route.name === "files" && <FilesScreen onNewChat={openChat} />}
        {route.name === "plans" && <PlansScreen onToast={showToast} />}
        {route.name === "list" && <EntityList key={route.type} type={route.type} onOpen={openRecord} onChat={(recs) => openChat(recs || [])} onToast={showToast} onRefresh={refresh} />}
        {route.name === "detail" && <EntityDetail key={route.record.id} record={route.record} onOpen={openRecord} onChat={(r) => openChat([r])} onBack={() => openList(route.record.type)} />}
        {route.name === "chat" && <ChatScreen key={chatKey} seedAttached={chatSeed} resume={chatResume} agent={chatAgent} onBack={() => go("home")} onOpenRecord={openRecord} onToast={showToast} onOpenConversation={openConversation} onNewChat={() => openChat([])} onNav={go} />}
      </main>
      <BottomNav route={route} go={go} openChat={openChat} onRecords={() => setSheet(true)} onProfile={() => setTweaksOpen((v) => !v)} />
      {sheet && <RecordsSheet openList={openList} onClose={() => setSheet(false)} />}
      {tweaksOpen && <TweaksPanel t={t} onClose={() => setTweaksOpen(false)} />}
      {flow && flow.name === "signup" && (
        <Signup initial={{ name: profile.name, email: profile.email, company: profile.company }} onFinish={signupDone} />
      )}
      {flow && flow.name === "onboarding" && (
        <Onboarding initial={onboardingInitial} onFinish={onboardingDone} onCancel={flow.firstRun ? null : () => setFlow(null)} collectIdentity={!isSignedUp()} />
      )}
      {builder && (
        <AgentBuilder
          agent={builder === "new" ? null : builder}
          onClose={() => setBuilder(null)}
          onOpenConnectors={() => { setBuilder(null); go("connectors"); }}
          onSave={() => { setBuilder(null); setAgentsVersion((v) => v + 1); showToast("Agent saved", "success"); }}
          onDeleted={() => { setBuilder(null); setAgentsVersion((v) => v + 1); showToast("Agent deleted", "info"); }}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}
