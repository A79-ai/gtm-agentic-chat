// Auto-playing product carousel: cycles through AmpUp agent screens (gif-like
// loop). The window is always the real (light) AmpUp UI; theme only tints the
// caption + dots. Ported from the Claude Design "AmpUp Homepage" handoff.
import React from "react";
import { LogoMark } from "./icons";

const FONT = "var(--font-sans)";

function Pill({ bg, fg, children }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}

// Fades its frame in on mount (keyed remount per active frame → replays).
function FadeFrame({ Comp }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(10px)",
        transition: "opacity .45s ease, transform .45s ease",
      }}
    >
      <Comp />
    </div>
  );
}

// ---- FRAME 1 · Deal Risk Scorer ----
function FrameRisk() {
  const deals = [
    { name: "Acme Corp", amt: "$84k", lvl: "High", bg: "#FFE4E6", fg: "#BE123C" },
    { name: "Globex", amt: "$120k", lvl: "Med", bg: "#F1E3C1", fg: "#937123" },
    { name: "Initech", amt: "$46k", lvl: "High", bg: "#FFE4E6", fg: "#BE123C" },
  ];
  return (
    <div style={{ padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 13 }}>
      <div
        style={{
          alignSelf: "flex-end",
          maxWidth: "78%",
          background: "#232428",
          color: "#FDFCF7",
          fontSize: 13,
          padding: "9px 13px",
          borderRadius: "14px 14px 4px 14px",
        }}
      >
        Which deals slipped this week, and why?
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "#FDFCF7",
            border: "1px solid #E7E4DC",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#181D27",
          }}
        >
          <LogoMark size={13} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#2B2A28" }}>
            3 deals lost momentum. Acme and Globex stalled right after pricing; Initech has been
            quiet for 9 days.
          </div>
          <div
            style={{
              marginTop: 11,
              border: "1px solid #E7E4DC",
              borderRadius: 12,
              overflow: "hidden",
              background: "#FFFFFF",
            }}
          >
            <div
              style={{
                padding: "9px 13px",
                borderBottom: "1px solid #F0ECE3",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#807E78",
              }}
            >
              At-risk deals · this week
            </div>
            {deals.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: i < 2 ? "1px solid #F4F0E8" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#181D27" }}>{d.name}</span>
                  <span style={{ fontSize: 12.5, color: "#807E78" }}>{d.amt}</span>
                </div>
                <Pill bg={d.bg} fg={d.fg}>
                  {d.lvl} risk
                </Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- FRAME 2 · Account Brief Generator ----
function FrameBrief() {
  const signals = [
    "Series C ($90M) closed 3 weeks ago, expansion budget likely",
    "New VP Sales started; prior stack included a competitor",
    "Two champions opened your pricing page 5× last week",
  ];
  return (
    <div style={{ padding: "18px 18px 14px", display: "flex", gap: 9 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "#FDFCF7",
          border: "1px solid #E7E4DC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#181D27",
        }}
      >
        <LogoMark size={13} />
      </div>
      <div
        style={{
          flex: 1,
          border: "1px solid #E7E4DC",
          borderRadius: 12,
          overflow: "hidden",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #F0ECE3",
            display: "flex",
            alignItems: "center",
            gap: 11,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "#1F6FEB",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#181D27" }}>Northwind Traders</div>
            <div style={{ fontSize: 12, color: "#807E78" }}>
              Enterprise · $240k ARR · Renewal in 62 days
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#807E78",
              marginBottom: 8,
            }}
          >
            Recent signals
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {signals.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  color: "#2B2A28",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: "#D2A232",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                {s}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 9,
              background: "rgba(210,162,50,0.10)",
              border: "1px solid rgba(210,162,50,0.30)",
              fontSize: 12.5,
              lineHeight: 1.4,
              color: "#5C4A14",
            }}
          >
            <strong style={{ color: "#3D3109" }}>Next step:</strong> Loop in the new VP Sales with
            the multi-team ROI deck before renewal.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- FRAME 3 · Meeting Followup Drafter ----
function FrameFollowup() {
  const todos = [
    "Send security questionnaire to Priya",
    "Share Q3 rollout timeline",
    "Book technical deep-dive for Thu",
  ];
  return (
    <div style={{ padding: "18px 18px 14px", display: "flex", gap: 9 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "#FDFCF7",
          border: "1px solid #E7E4DC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#181D27",
        }}
      >
        <LogoMark size={13} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#2B2A28", marginBottom: 10 }}>
          Drafted from your call with <strong>Acme Corp</strong> (24 min). Ready to send.
        </div>
        <div
          style={{
            border: "1px solid #E7E4DC",
            borderRadius: 12,
            overflow: "hidden",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #F0ECE3",
              fontSize: 12.5,
              color: "#807E78",
            }}
          >
            To: <span style={{ color: "#181D27" }}>priya@acme.com</span> · Subject:{" "}
            <span style={{ color: "#181D27" }}>Great chatting, next steps</span>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 12.5, lineHeight: 1.5, color: "#2B2A28" }}>
            Hi Priya, thanks for the time today. Recapping what we agreed on, plus a couple of items
            to keep us moving…
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              {todos.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 12.5,
                    color: "#2B2A28",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      background: "#D7EDE9",
                      color: "#00675B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      fill="none"
                      height="10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3.5"
                      viewBox="0 0 24 24"
                      width="10"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- FRAME 4 · Pipeline Health Monitor ----
function FramePipeline() {
  const stats = [
    { k: "Pipeline", v: "$4.2M", d: "+8%" },
    { k: "Win rate", v: "31%", d: "+3pt" },
    { k: "Stalled", v: "6", d: "-2" },
  ];
  const bars = [42, 55, 48, 63, 58, 71, 80];
  return (
    <div style={{ padding: "18px 18px 14px", display: "flex", gap: 9 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "#FDFCF7",
          border: "1px solid #E7E4DC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#181D27",
        }}
      >
        <LogoMark size={13} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #E7E4DC",
                borderRadius: 10,
                padding: "10px 12px",
                background: "#FFFFFF",
              }}
            >
              <div style={{ fontSize: 11, color: "#807E78", marginBottom: 3 }}>{s.k}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: "#181D27" }}>{s.v}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#00675B" }}>{s.d}</span>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 10,
            border: "1px solid #E7E4DC",
            borderRadius: 12,
            padding: "13px 14px",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#807E78",
              marginBottom: 12,
            }}
          >
            Pipeline created · last 7 weeks
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 70 }}>
            {bars.map((b, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${b}%`,
                  borderRadius: "5px 5px 2px 2px",
                  background: i === bars.length - 1 ? "#D2A232" : "rgba(210,162,50,0.28)",
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            marginTop: 9,
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "#807E78",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#00675B" }} />
          Morning digest posted to <strong style={{ color: "#2B2A28" }}>#revenue</strong>
        </div>
      </div>
    </div>
  );
}

const CAROUSEL_FRAMES = [
  {
    id: "risk",
    title: "Deal Risk Scorer",
    badge: "Live",
    badgeBg: "#D7EDE9",
    badgeFg: "#00675B",
    caption: "Flags at-risk pipeline from calls, CRM momentum & engagement.",
    Frame: FrameRisk,
  },
  {
    id: "brief",
    title: "Account Brief Generator",
    badge: "Research",
    badgeBg: "#E8EEF8",
    badgeFg: "#2F588B",
    caption: "One-page briefs: signals, org changes, recommended next step.",
    Frame: FrameBrief,
  },
  {
    id: "followup",
    title: "Meeting Followup Drafter",
    badge: "Meetings",
    badgeBg: "#F1E3C1",
    badgeFg: "#937123",
    caption: "Turns every call into a ready-to-send follow-up with action items.",
    Frame: FrameFollowup,
  },
  {
    id: "pipeline",
    title: "Pipeline Health Monitor",
    badge: "Analytics",
    badgeBg: "#EDE6F3",
    badgeFg: "#6D4AA0",
    caption: "Daily pipeline trends, win-rate shifts and a Slack digest.",
    Frame: FramePipeline,
  },
];

const DURATION = 3600;

export function ProductCarousel({ theme = "dark", width = 600 }) {
  const dark = theme === "dark";
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) {
      return;
    }
    const t = setTimeout(() => setIdx((i) => (i + 1) % CAROUSEL_FRAMES.length), DURATION);
    return () => clearTimeout(t);
  }, [idx, paused]);

  const active = CAROUSEL_FRAMES[idx];
  const capInk = dark ? "#BBB8B0" : "#4C4C4A";
  const capStrong = dark ? "#FDFCF7" : "#181D27";
  const dotOff = dark ? "rgba(255,255,255,0.22)" : "rgba(24,29,39,0.18)";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        width,
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        fontFamily: FONT,
      }}
    >
      {/* window */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1px solid #E7E4DC",
          overflow: "hidden",
          boxShadow: "0 50px 90px -30px rgba(20,16,8,0.45)",
          display: "flex",
        }}
      >
        {/* rail */}
        <div
          style={{
            width: 52,
            background: "#FAF8F2",
            borderRight: "1px solid #ECE8E0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "14px 0",
            gap: 14,
            color: "#181D27",
          }}
        >
          <LogoMark size={20} />
          {CAROUSEL_FRAMES.map((f, i) => (
            <button
              aria-label={f.title}
              key={f.id}
              onClick={() => setIdx(i)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: i === idx ? "rgba(210,162,50,0.16)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background .3s",
              }}
            >
              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 5,
                  border: `2px solid ${i === idx ? "#D2A232" : "#C9C6BF"}`,
                  transition: "border-color .3s",
                }}
              />
            </button>
          ))}
        </div>
        {/* main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              padding: "13px 18px",
              borderBottom: "1px solid #ECE8E0",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid #E7E4DC",
                background: "#FDFCF7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#181D27",
              }}
            >
              <LogoMark size={15} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#181D27", flex: 1 }}>
              {active.title}
            </div>
            <Pill bg={active.badgeBg} fg={active.badgeFg}>
              {active.badge}
            </Pill>
          </div>
          {/* body: only the active frame renders; keyed remount replays the fade */}
          <div
            style={{
              position: "relative",
              height: 400,
              overflow: "hidden",
              background: "linear-gradient(180deg,#FFFFFF,#FBFAF6)",
            }}
          >
            <div key={active.id} style={{ position: "absolute", inset: 0 }}>
              <FadeFrame Comp={active.Frame} />
            </div>
            {/* progress bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 3,
                background: "rgba(210,162,50,0.12)",
              }}
            >
              <div
                key={idx + (paused ? "p" : "r")}
                style={{
                  height: "100%",
                  background: "#D2A232",
                  width: paused ? "32%" : "100%",
                  transition: paused ? "none" : `width ${DURATION}ms linear`,
                  transformOrigin: "left",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* caption + dots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          paddingLeft: 4,
        }}
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: capInk, maxWidth: 380 }}>
          <strong style={{ color: capStrong, fontWeight: 600 }}>{active.title}.</strong>{" "}
          {active.caption}
        </div>
        <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
          {CAROUSEL_FRAMES.map((f, i) => (
            <button
              aria-label={f.title}
              key={f.id}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 22 : 7,
                height: 7,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: i === idx ? "#D2A232" : dotOff,
                transition: "width .3s, background .3s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
