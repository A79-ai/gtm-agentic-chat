// Unauthenticated welcome / get-started splash. Immersive two-panel design from
// the Claude Design handoff: a focused auth column on the left and an
// auto-playing product carousel on the right that sells the product visually.
// A self-contained light/dark toggle (persisted) lets a visitor preview both.
// Both CTAs route to Auth0 Universal Login for the free-trial org (which offers
// Google + email); a new user is auto-provisioned on first login.
import React from "react";
import { Icons, Logo, Logos } from "./icons";
import { ProductCarousel } from "./product-carousel";

const FONT = "var(--font-sans)";

function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";
  return (
    <button onClick={onToggle} aria-label="Toggle theme" style={{
      position: "fixed", top: 20, right: 22, zIndex: 110, height: 38, padding: "0 14px 0 12px",
      borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
      border: `1px solid ${dark ? "rgba(255,255,255,0.16)" : "#E0DCD2"}`,
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
      color: dark ? "#EDEAE3" : "#2B2A28", fontSize: 13, fontWeight: 500, backdropFilter: "blur(8px)",
      fontFamily: FONT,
    }}>
      {dark ? <Icons.Sun size={15} stroke={2} /> : <Icons.Moon size={15} stroke={2} />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}

export function Welcome({ onLogin, onSignup, onGoogle }) {
  const [theme, setTheme] = React.useState("dark");
  React.useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("ampup-theme");
    if (saved) setTheme(saved);
  }, []);
  React.useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ampup-theme", theme);
  }, [theme]);
  const dark = theme === "dark";

  const T = dark
    ? { leftBg: "#1A1917", rightBg: "radial-gradient(110% 90% at 72% 8%, #2A2620 0%, #1B1916 58%, #131210 100%)", ink: "#FDFCF7", body: "#BBB8B0", muted: "#878478", accent: "#F2B33C", eyebrow: "#E0BE70", logoInk: "#FDFCF7", btnBorder: "rgba(255,255,255,0.14)", btnInk: "#EDEAE3", edge: "rgba(255,255,255,0.08)" }
    : { leftBg: "#FFFFFF", rightBg: "radial-gradient(110% 90% at 72% 8%, #F3EFE6 0%, #ECE7DB 55%, #E3DDCD 100%)", ink: "#181D27", body: "#4C4C4A", muted: "#807E78", accent: "#B7860F", eyebrow: "#9A7A24", logoInk: "#181D27", btnBorder: "#DCD9D0", btnInk: "#2B2A28", edge: "#ECE8E0" };

  const trust = ["Grounded in your CRM & calls", "No credit card", "14-day trial"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto", background: T.leftBg, fontFamily: FONT }}>
      <style>{`
        .wl-grid { display: grid; grid-template-columns: minmax(420px, 0.82fr) 1.18fr; min-height: 100dvh; }
        .wl-right { display: flex; }
        @media (max-width: 920px) {
          .wl-grid { grid-template-columns: 1fr; }
          .wl-right { display: none; }
        }
      `}</style>
      <ThemeToggle theme={theme} onToggle={() => setTheme(dark ? "light" : "dark")} />

      <div className="wl-grid">
        {/* LEFT — auth */}
        <div style={{ padding: "clamp(40px, 5vw, 64px)", display: "flex", flexDirection: "column", background: T.leftBg, borderRight: `1px solid ${T.edge}`, minHeight: "100dvh" }}>
          <Logo ink={T.logoInk} height={26} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 420, padding: "48px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: T.eyebrow, marginBottom: 14 }}>Welcome</div>
            <h1 style={{ margin: 0, fontSize: "clamp(34px, 4vw, 44px)", fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.025em", color: T.ink }}>
              Get started<br />with <span style={{ color: T.accent }}>AmpUp</span>
            </h1>
            <p style={{ margin: "18px 0 0", fontSize: 17, lineHeight: 1.5, color: T.body, maxWidth: 380 }}>
              Spin up your GTM agent over your own CRM, meetings and knowledge base.
            </p>

            <button onClick={onSignup} style={{
              marginTop: 32, height: 58, borderRadius: 999, border: "none", cursor: "pointer",
              background: "linear-gradient(180deg, #F8C04A 0%, #F0AE26 100%)", color: "#1E1B12",
              fontWeight: 600, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: "0 14px 30px -10px rgba(240,174,38,0.5)", fontFamily: FONT,
            }}>Get started — it’s free <Icons.ArrowRight size={18} stroke={2} /></button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <button onClick={onGoogle || onLogin} style={{ height: 52, borderRadius: 999, background: "transparent", border: `1px solid ${T.btnBorder}`, color: T.btnInk, fontWeight: 500, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer", fontFamily: FONT }}>
                <span style={{ width: 18, height: 18, display: "inline-flex" }}><Logos.Google /></span> Google
              </button>
              <button onClick={onLogin} style={{ height: 52, borderRadius: 999, background: "transparent", border: `1px solid ${T.btnBorder}`, color: T.btnInk, fontWeight: 500, fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Log in</button>
            </div>

            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: "10px 18px" }}>
              {trust.map((t, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: T.muted }}>
                  <span style={{ color: T.accent, display: "flex" }}><Icons.Check size={13} stroke={2.4} /></span>{t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — carousel */}
        <div className="wl-right" style={{ position: "relative", background: T.rightBg, overflow: "hidden", alignItems: "center", minHeight: "100dvh" }}>
          <div style={{ position: "absolute", left: "clamp(40px, 5vw, 72px)", right: "clamp(32px, 3vw, 56px)", top: "50%", transform: "translateY(-50%)" }}>
            <ProductCarousel theme={theme} width={760} />
          </div>
        </div>
      </div>
    </div>
  );
}
