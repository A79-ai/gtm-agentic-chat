// Icons — Lucide-style UI glyphs + AmpUp mark + connector logos
import React from "react";

const L =
  (paths, vb = 24) =>
  ({ size = 20, stroke = 1.75, style, ...p }) =>
    React.createElement(
      "svg",
      {
        width: size,
        height: size,
        viewBox: `0 0 ${vb} ${vb}`,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: stroke,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style,
        ...p,
      },
      paths.map((d, i) =>
        typeof d === "string"
          ? React.createElement("path", { key: i, d })
          : React.createElement(d.t, { key: i, ...d.a })),
    );

export const Icons = {
  Search: L(["m21 21-4.3-4.3", { t: "circle", a: { cx: 11, cy: 11, r: 8 } }]),
  Calendar: L([{ t: "rect", a: { x: 3, y: 4, width: 18, height: 18, rx: 2 } }, "M16 2v4", "M8 2v4", "M3 10h18"]),
  Chat: L(["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]),
  Spark: L(["M9.94 14.06 4 20", "M14.06 9.94 20 4", { t: "path", a: { d: "M12 3l1.6 4.3a3 3 0 0 0 1.78 1.78L19.7 10.7a.3.3 0 0 1 0 .56l-4.32 1.62a3 3 0 0 0-1.78 1.78L12 19l-1.62-4.32a3 3 0 0 0-1.78-1.78L4.3 11.28a.3.3 0 0 1 0-.56l4.3-1.62a3 3 0 0 0 1.78-1.78z" } }]),
  Bars: L(["M3 3v16a2 2 0 0 0 2 2h16", "m19 9-5 5-4-4-3 3"]),
  Brain: L(["M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z", "M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"]),
  Plug: L(["M12 22v-5", "M9 8V2", "M15 8V2", "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"]),
  Home: L(["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"]),
  Plus: L(["M5 12h14", "M12 5v14"]),
  ArrowUp: L(["m5 12 7-7 7 7", "M12 19V5"]),
  ArrowRight: L(["M5 12h14", "m12 5 7 7-7 7"]),
  ArrowLeft: L(["M19 12H5", "m12 19-7-7 7-7"]),
  Paperclip: L(["m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"]),
  At: L([{ t: "circle", a: { cx: 12, cy: 12, r: 4 } }, "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"]),
  Sliders: L(["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"]),
  History: L(["M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8", "M3 3v5h5", "M12 7v5l4 2"]),
  Share: L(["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "m16 6-4-4-4 4", "M12 2v13"]),
  Sun: L([{ t: "circle", a: { cx: 12, cy: 12, r: 4 } }, "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m6.3 17.7-1.4 1.4", "m19.1 4.9-1.4 1.4"]),
  Moon: L(["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"]),
  Check: L(["M20 6 9 17l-5-5"]),
  CheckCircle: L([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, "m8.5 12.5 2.5 2.5 4.5-5"]),
  ChevronDown: L(["m6 9 6 6 6-6"]),
  X: L(["M18 6 6 18", "m6 6 12 12"]),
  Clock: L([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, "M12 7v5l3 2"]),
  Zap: L(["M13 2 3 14h7l-1 8 10-12h-7z"]),
  FileText: L(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6", "M9 17h6"]),
  Activity: L(["M22 12h-4l-3 9L9 3l-3 9H2"]),
  Users: L(["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { t: "circle", a: { cx: 9, cy: 7, r: 4 } }, "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"]),
  Mail: L([{ t: "rect", a: { x: 2, y: 4, width: 20, height: 16, rx: 2 } }, "m22 7-10 6L2 7"]),
  Panel: L([{ t: "rect", a: { x: 3, y: 3, width: 18, height: 18, rx: 2 } }, "M15 3v18"]),
  Refresh: L(["M3 12a9 9 0 0 1 15-6.7L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15 6.7L3 16", "M3 21v-5h5"]),
  Bell: L(["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]),
  User: L([{ t: "circle", a: { cx: 12, cy: 8, r: 4 } }, "M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"]),
  Send: L(["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"]),
  Target: L([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, { t: "circle", a: { cx: 12, cy: 12, r: 5 } }, { t: "circle", a: { cx: 12, cy: 12, r: 1 } }]),
  Phone: L(["M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"]),
  Save: L(["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z", "M17 21v-8H7v8", "M7 3v5h8"]),
  Sparkle: L([{ t: "path", a: { d: "M12 3l1.6 4.3a3 3 0 0 0 1.78 1.78L19.7 10.7a.3.3 0 0 1 0 .56l-4.32 1.62a3 3 0 0 0-1.78 1.78L12 19l-1.62-4.32a3 3 0 0 0-1.78-1.78L4.3 11.28a.3.3 0 0 1 0-.56l4.3-1.62a3 3 0 0 0 1.78-1.78z" } }]),
  Copy: L([{ t: "rect", a: { x: 9, y: 9, width: 12, height: 12, rx: 2 } }, "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"]),
  Dollar: L(["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]),
  Building: L([{ t: "rect", a: { x: 4, y: 2, width: 16, height: 20, rx: 2 } }, "M9 22v-4h6v4", "M8 6h.01", "M16 6h.01", "M8 10h.01", "M16 10h.01", "M8 14h.01", "M16 14h.01"]),
  CheckSquare: L([{ t: "rect", a: { x: 3, y: 3, width: 18, height: 18, rx: 3 } }, "m8 12 3 3 5-6"]),
  ChevronRight: L(["m9 6 6 6-6 6"]),
  Filter: L(["M22 3H2l8 9.5V19l4 2v-8.5z"]),
  Layers: L(["m12 2 9 5-9 5-9-5z", "m3 12 9 5 9-5", "m3 17 9 5 9-5"]),
  Inbox: L(["M22 12h-6l-2 3h-4l-2-3H2", "M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z"]),
  Trend: L(["M16 7h6v6", "m22 7-8.5 8.5-5-5L2 17"]),
};

// AmpUp spark "A" mark — legs use currentColor, sparkle gold
export function LogoMark({ size = 24 }) {
  const h = size,
    w = size * (43 / 45);
  return React.createElement(
    "svg",
    { width: w, height: h, viewBox: "0 0 43 45", fill: "none" },
    React.createElement("path", { d: "M18.425 31.6608C20.8363 29.2496 20.331 23.825 21.1781 23.825C22.0253 23.825 21.52 29.1437 23.9313 31.5549C26.3425 33.9661 31.767 33.5668 31.767 34.4139C31.767 35.261 26.3425 34.7558 23.9313 37.167C21.52 39.5783 22.0253 45.0028 21.1781 45.0028C20.331 45.0028 20.8363 39.5783 18.425 37.167C16.0138 34.7558 10.5892 35.261 10.5892 34.4139C10.5892 33.5668 16.0138 34.072 18.425 31.6608Z", fill: "#FFB712" }),
    React.createElement("path", { d: "M42.0672 32.9749C42.334 33.6685 41.822 34.4139 41.0789 34.4139H36.1335C35.2572 34.4139 34.4714 33.8743 34.1568 33.0564L21.9963 1.43901C21.7296 0.745438 22.2415 0 22.9846 0L27.93 0C28.8063 0 29.5921 0.539672 29.9067 1.35754L42.0672 32.9749Z", fill: "currentColor" }),
    React.createElement("path", { d: "M0.55381 32.9749C0.28705 33.6685 0.799012 34.4139 1.54212 34.4139H6.48753C7.3638 34.4139 8.14958 33.8743 8.46415 33.0564L20.6247 1.43901C20.8914 0.745438 20.3795 0 19.6364 0L14.691 0C13.8147 0 13.0289 0.539672 12.7143 1.35754L0.55381 32.9749Z", fill: "currentColor" }),
  );
}

// ---- Connector brand logos (simplified, brand-colored) ----
const svg = (vb, kids, p = {}) =>
  React.createElement("svg", { viewBox: vb, width: "100%", height: "100%", ...p }, kids);
const e = React.createElement;
export const Logos = {
  Slack: () => svg("0 0 24 24", [
    e("path", { key: 1, fill: "#36C5F0", d: "M5.5 14.5A2.25 2.25 0 1 1 3.25 12.25H5.5zM6.75 14.5a2.25 2.25 0 0 1 4.5 0v5.6a2.25 2.25 0 1 1-4.5 0z" }),
    e("path", { key: 2, fill: "#2EB67D", d: "M9 5.5A2.25 2.25 0 1 1 11.25 3.25V5.5zM9 6.75a2.25 2.25 0 0 1 0 4.5H3.4a2.25 2.25 0 1 1 0-4.5z" }),
    e("path", { key: 3, fill: "#ECB22E", d: "M18.5 9A2.25 2.25 0 1 1 20.75 11.25H18.5zM17.25 9a2.25 2.25 0 0 1-4.5 0V3.4a2.25 2.25 0 1 1 4.5 0z" }),
    e("path", { key: 4, fill: "#E01E5A", d: "M15 18.5a2.25 2.25 0 1 1-2.25 2.25V18.5zM15 17.25a2.25 2.25 0 0 1 0-4.5h5.6a2.25 2.25 0 1 1 0 4.5z" }),
  ]),
  HubSpot: () => svg("0 0 24 24", [
    e("path", { key: 1, fill: "#FF7A59", d: "M17.5 8.6V6.2a1.9 1.9 0 1 0-1.6 0v2.4a5.6 5.6 0 0 0-2.5 1.1L7.2 5.2a2.1 2.1 0 1 0-1.3 1.6l6 4.4a5.5 5.5 0 0 0 .1 6.1l-1.8 1.8a1.8 1.8 0 1 0 1.2 1.2l1.8-1.8a5.6 5.6 0 1 0 4-9.9zm-1.2 8.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8z" }),
  ]),
  Salesforce: () => svg("0 0 24 24", [
    e("path", { key: 1, fill: "#00A1E0", d: "M10 6.4a3.3 3.3 0 0 1 5.6.9 3.8 3.8 0 0 1 1.5-.3 3.9 3.9 0 0 1 .7 7.7 3.4 3.4 0 0 1-4.5 3.4 3.1 3.1 0 0 1-5.7.2 3.6 3.6 0 0 1-.8.1A3.6 3.6 0 0 1 4 14.7a3.5 3.5 0 0 1 2-6.4 3.5 3.5 0 0 1 .8.1A3.3 3.3 0 0 1 10 6.4z" }),
  ]),
  Gong: () => svg("0 0 24 24", [
    e("rect", { key: 0, x: 0, y: 0, width: 24, height: 24, rx: 6, fill: "#8039DF" }),
    e("circle", { key: 1, cx: 12, cy: 12, r: 5.4, fill: "none", stroke: "#fff", strokeWidth: 1.8 }),
    e("circle", { key: 2, cx: 12, cy: 12, r: 1.8, fill: "#fff" }),
    e("path", { key: 3, d: "M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3", stroke: "#fff", strokeWidth: 1.6, strokeLinecap: "round" }),
  ]),
  Clari: () => svg("0 0 24 24", [
    e("path", { key: 1, fill: "#2A7DE1", d: "M3 8a3 3 0 0 1 3-3h2v14H6a3 3 0 0 1-3-3z" }),
    e("path", { key: 2, fill: "#16C79A", d: "M9 5h2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9z" }),
    e("path", { key: 3, fill: "#F4B740", d: "M15 8.5 21 5v14l-6-3.5z" }),
  ]),
  Fireflies: () => svg("0 0 24 24", [
    e("rect", { key: 0, x: 0, y: 0, width: 24, height: 24, rx: 6, fill: "#3B2A6B" }),
    e("rect", { key: 1, x: 6, y: 6, width: 5, height: 5, rx: 1, fill: "#F25C7A" }),
    e("rect", { key: 2, x: 13, y: 6, width: 5, height: 5, rx: 1, fill: "#7C6FE8" }),
    e("rect", { key: 3, x: 6, y: 13, width: 5, height: 5, rx: 1, fill: "#7C6FE8" }),
    e("rect", { key: 4, x: 13, y: 13, width: 5, height: 5, rx: 1, fill: "#F25C7A" }),
  ]),
  Fathom: () => svg("0 0 24 24", [
    e("rect", { key: 0, x: 0, y: 0, width: 24, height: 24, rx: 6, fill: "#0B0B0F" }),
    e("path", { key: 1, d: "M7 8.5c2.5-1.6 7.5-1.6 10 0-2.5 1.6-7.5 1.6-10 0z", fill: "#28C2FF" }),
    e("path", { key: 2, d: "M7 15.5c2.5-1.6 7.5-1.6 10 0-2.5 1.6-7.5 1.6-10 0z", fill: "#28C2FF", opacity: 0.6 }),
  ]),
  Granola: () => svg("0 0 24 24", [
    e("rect", { key: 0, x: 0, y: 0, width: 24, height: 24, rx: 6, fill: "#B7C44A" }),
    e("path", { key: 1, d: "M12 5a7 7 0 1 0 7 7 4.6 4.6 0 0 1-7-6 4.7 4.7 0 0 0 0 .01z", fill: "none", stroke: "#2C3312", strokeWidth: 1.8 }),
    e("circle", { key: 2, cx: 12, cy: 12, r: 1.7, fill: "#2C3312" }),
  ]),
  DevRev: () => svg("0 0 24 24", [
    e("rect", { key: 0, x: 0, y: 0, width: 24, height: 24, rx: 6, fill: "#0B0B0F" }),
    e("path", { key: 1, d: "M7 7h4.5a5 5 0 0 1 0 10H7z", fill: "none", stroke: "#fff", strokeWidth: 1.9 }),
    e("circle", { key: 2, cx: 16.5, cy: 8, r: 1.6, fill: "#3CE0C4" }),
  ]),
  Dynamics: () => svg("0 0 24 24", [
    e("path", { key: 1, fill: "#0B7DDA", d: "M4 4l10-1.5v8.5L4 12z" }),
    e("path", { key: 2, fill: "#1B9CF5", d: "M14 2.5 20 4v13l-6 1.5z" }),
    e("path", { key: 3, fill: "#155A9E", d: "M4 12l10-1v9L4 17z" }),
  ]),
};
