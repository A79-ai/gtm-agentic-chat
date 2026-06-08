// Simplified side-nav — compact icon rail (Home · Records · Connectors),
// a consolidated Records flyout, and a Profile menu that absorbs the
// secondary actions (notetaker, tweaks, replay onboarding, restart, sign out).
import React, { useState, useRef, useEffect } from "react";
import { Icons, LogoMark } from "./icons";
import { EntityIcon } from "./ui";
import { ENTITY_ORDER, ENTITIES, countOf, initials } from "@/lib/gtm/data";
import { CONFIG } from "@/lib/gtm/config";

// close on outside-click / Escape
function useDismiss(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (ev) => { if (ref.current && !ref.current.contains(ev.target)) onClose(); };
    const k = (ev) => { if (ev.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  return ref;
}

function RecordsFlyout({ anchor, onPick, onClose, onFiles }) {
  const ref = useDismiss(onClose);
  const style = anchor ? { position: "fixed", left: anchor.left, top: Math.min(anchor.top, window.innerHeight - 380), zIndex: 90 } : {};
  return (
    <div ref={ref} className="navpop" style={style}>
      <div className="navpop-head">Records</div>
      <div className="navpop-list">
        {ENTITY_ORDER.map((t) => (
          <button key={t} className="navpop-item" onClick={() => { onPick(t); onClose(); }}>
            <EntityIcon type={t} size={30} />
            <span className="nm">{ENTITIES[t].plural}</span>
            <span className="ct">{countOf(t).toLocaleString()}</span>
            <Icons.ChevronRight size={16} style={{ color: "var(--fg-muted)" }} />
          </button>
        ))}
        <button key="files" className="navpop-item" onClick={() => { onFiles(); onClose(); }}>
          <span style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)" }}><Icons.Paperclip size={18} /></span>
          <span className="nm">Files</span>
          <span className="ct" />
          <Icons.ChevronRight size={16} style={{ color: "var(--fg-muted)" }} />
        </button>
      </div>
    </div>
  );
}

function ProfileMenu({ anchor, profile, on, onClose }) {
  const ref = useDismiss(onClose);
  const style = anchor ? { position: "fixed", left: anchor.left, bottom: anchor.bottom, zIndex: 90 } : {};
  const Item = ({ icon, label, sub, onClick }) => (
    <button className="menu-item" onClick={() => { onClick(); onClose(); }}>
      {React.createElement(icon, { size: 17 })}
      <span className="menu-label">{label}</span>
      {sub ? <span className="menu-sub">{sub}</span> : null}
    </button>
  );
  return (
    <div ref={ref} className="profile-menu" style={style}>
      <div className="profile-menu-head">
        <div className="avatar-lg">{initials(profile.name || "You")}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="pm-name">{profile.name || "Your name"}</div>
          <div className="pm-email">{profile.email || "you@company.com"}</div>
        </div>
      </div>
      <div className="menu-section">
        <Item icon={Icons.Brain} label="Notetaker" onClick={() => on("notetaker")} />
        {CONFIG.billing.enabled ? <Item icon={Icons.Spark} label="Plans & billing" onClick={() => on("plans")} /> : null}
        <Item icon={Icons.Sliders} label="Tweaks" onClick={() => on("tweaks")} />
      </div>
      <div className="menu-divider" />
      <div className="menu-section">
        <Item icon={Icons.Spark} label="Replay onboarding" onClick={() => on("onboarding")} />
      </div>
      <div className="menu-divider" />
      <div className="menu-section">
        <Item icon={Icons.Refresh} label="Restart demo" onClick={() => on("restart")} />
        <Item icon={Icons.LogOut} label="Sign out" onClick={() => on("signout")} />
      </div>
    </div>
  );
}

export function SideNav({ route, go, openList, openChat, themeResolved, toggleTheme, profile, on }) {
  const [flyout, setFlyout] = useState(null); // 'records' | 'profile' | null
  const [anchor, setAnchor] = useState(null);
  const recordsActive = route.name === "list" || route.name === "detail";

  const openFly = (which, ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setAnchor(which === "records"
      ? { left: r.right + 10, top: r.top - 6 }
      : { left: r.right + 10, bottom: window.innerHeight - r.bottom - 6 });
    setFlyout((f) => (f === which ? null : which));
  };

  const Btn = ({ active, title, onClick, icon }) => (
    <button className={"rail-btn" + (active ? " active" : "")} title={title} onClick={onClick}>
      {React.createElement(icon, { size: 21 })}
    </button>
  );

  return (
    <>
      <nav className="rail">
        <button className="rail-logo" style={{ color: "#FDFCF7", cursor: "pointer" }} title="Home" onClick={() => go("home")}><LogoMark size={26} /></button>
        <button className="rail-cta" title="New chat" onClick={() => openChat([])}><Icons.Plus size={20} /></button>
        <div className="rail-scroll" style={{ marginTop: 4 }}>
          <Btn active={route.name === "home"} title="Home" icon={Icons.Home} onClick={() => go("home")} />
          <Btn active={recordsActive || flyout === "records"} title="Records" icon={Icons.Layers} onClick={(ev) => openFly("records", ev)} />
          <Btn active={route.name === "connectors"} title="Connectors" icon={Icons.Plug} onClick={() => go("connectors")} />
        </div>
        <button className="rail-btn" title="Toggle theme" onClick={toggleTheme}>
          {React.createElement(themeResolved === "dark" ? Icons.Sun : Icons.Moon, { size: 20 })}
        </button>
        <button className={"rail-avatar" + (flyout === "profile" ? " active" : "")} title="Profile" onClick={(ev) => openFly("profile", ev)}>
          {initials(profile.name || "You")}
        </button>
      </nav>
      {flyout === "records" && <RecordsFlyout anchor={anchor} onPick={openList} onFiles={() => on("files")} onClose={() => setFlyout(null)} />}
      {flyout === "profile" && <ProfileMenu anchor={anchor} profile={profile} on={on} onClose={() => setFlyout(null)} />}
    </>
  );
}

export function BottomNav({ route, go, openChat, onRecords, onProfile }) {
  const a = (n) => (route.name === n ? "active" : "");
  const recordsActive = route.name === "list" || route.name === "detail" ? "active" : "";
  return (
    <nav className="botnav">
      <button className={a("home")} onClick={() => go("home")}><Icons.Home size={21} />Home</button>
      <button className={recordsActive} onClick={onRecords}><Icons.Layers size={21} />Records</button>
      <button className="fab" onClick={() => openChat([])}><Icons.Plus size={22} /></button>
      <button className={a("connectors")} onClick={() => go("connectors")}><Icons.Plug size={21} />Tools</button>
      <button onClick={onProfile}><Icons.User size={21} />You</button>
    </nav>
  );
}
