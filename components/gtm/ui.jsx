// Shared UI primitives: entity icons, badges, chips, avatars
import React from "react";
import { CONNECTORS, ENTITIES, healthTone, initials as initialsOf } from "@/lib/gtm/data";
import { Icons, Logos } from "./icons";

const e = React.createElement;

export const TONES = {
  gold: { bg: "var(--accent-soft)", fg: "var(--accent-text)" },
  teal: { bg: "var(--teal-glow-subtle)", fg: "var(--teal-deep)" },
  mint: { bg: "var(--mint-glow-subtle)", fg: "var(--mint-deep)" },
};

export function EntityIcon({ type, size = 36, radius }) {
  const meta = ENTITIES[type] || ENTITIES.deal;
  const Ic = Icons[meta.icon] || Icons.Layers;
  const tone = TONES[meta.tone] || TONES.gold;
  return e(
    "div",
    {
      style: {
        width: size,
        height: size,
        borderRadius: radius || Math.round(size * 0.28),
        background: tone.bg,
        color: tone.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
    },
    e(Ic, { size: Math.round(size * 0.55) })
  );
}

export function Avatar({ name, size = 30 }) {
  return e(
    "div",
    {
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 600,
        color: "var(--fg-secondary)",
        flexShrink: 0,
      },
    },
    initialsOf(name)
  );
}

export function TBadge({ value, tone }) {
  const t = tone || healthTone(value || "");
  const map = {
    success: { bg: "var(--mint-glow-subtle)", fg: "var(--fg-success)" },
    danger: { bg: "rgba(190,18,60,.12)", fg: "var(--fg-danger)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent-text)" },
    neutral: { bg: "var(--bg-surface)", fg: "var(--fg-secondary)" },
  };
  const sty = map[t] || map.neutral;
  return e(
    "span",
    {
      className: "badge",
      style: {
        background: sty.bg,
        color: sty.fg,
        border: t === "neutral" ? "1px solid var(--border-default)" : "1px solid transparent",
        padding: "2px 9px",
      },
    },
    value
  );
}

export function ConnLogo({ logo, size = 48 }) {
  const Logo = Logos[logo];
  return e(
    "div",
    {
      className: "conn-logo",
      style: {
        width: size,
        height: size,
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        padding: size * 0.16,
      },
    },
    Logo ? e(Logo) : null
  );
}

export function SourceTile({ src, size = 22 }) {
  const c = CONNECTORS.find((x) => x.id === src);
  const Logo = c && Logos[c.logo];
  return e(
    "span",
    {
      style: {
        width: size,
        height: size,
        borderRadius: 5,
        padding: size * 0.16,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        display: "inline-flex",
        flexShrink: 0,
      },
    },
    Logo ? e(Logo) : null
  );
}

export function RefChip({ record, onOpen, removable, onRemove }) {
  if (!record) {
    return null;
  }
  return e(
    "span",
    {
      className: "ref-chip",
      onClick: onOpen
        ? (ev) => {
            ev.stopPropagation();
            onOpen(record);
          }
        : null,
      style: { cursor: onOpen ? "pointer" : "default" },
    },
    e(EntityIcon, { type: record.type, size: 18 }),
    e(
      "span",
      { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
      record.name
    ),
    removable
      ? e(
          "button",
          {
            className: "ref-x",
            onClick: (ev) => {
              ev.stopPropagation();
              onRemove && onRemove(record);
            },
          },
          e(Icons.X, { size: 13 })
        )
      : null
  );
}
