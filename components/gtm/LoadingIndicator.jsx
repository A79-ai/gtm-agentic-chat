// AmpUp loading indicator — animated A-mark rocket + cycling shimmer word.
// Ported from the product (LoadingIndicator/LogoSpinner), trimmed to the chip.
import { useEffect, useState } from "react";
import "./loading.css";

const SPARK_COLOR = "#FFB712";
const SPARK_CX = 21.18;
const SPARK_CY = 34.41;
const LEFT_LEG =
  "M0.55381 32.9749C0.28705 33.6685 0.799012 34.4139 1.54212 34.4139H6.48753C7.3638 34.4139 8.14958 33.8743 8.46415 33.0564L20.6247 1.43901C20.8914 0.745438 20.3795 -6.49645e-08 19.6364 0L14.691 4.32341e-07C13.8147 5.08948e-07 13.0289 0.539672 12.7143 1.35754L0.55381 32.9749Z";
const RIGHT_LEG =
  "M42.0672 32.9749C42.334 33.6685 41.822 34.4139 41.0789 34.4139H36.1335C35.2572 34.4139 34.4714 33.8743 34.1568 33.0564L21.9963 1.43901C21.7296 0.745438 22.2415 -6.49645e-08 22.9846 0L27.93 4.32341e-07C28.8063 5.08948e-07 29.5921 0.539672 29.9067 1.35754L42.0672 32.9749Z";
const SPARK_PATH =
  "M18.425 31.6608C20.8363 29.2496 20.331 23.825 21.1781 23.825C22.0253 23.825 21.52 29.1437 23.9313 31.5549C26.3425 33.9661 31.767 33.5668 31.767 34.4139C31.767 35.261 26.3425 34.7558 23.9313 37.167C21.52 39.5783 22.0253 45.0028 21.1781 45.0028C20.331 45.0028 20.8363 39.5783 18.425 37.167C16.0138 34.7558 10.5892 35.261 10.5892 34.4139C10.5892 33.5668 16.0138 34.072 18.425 31.6608Z";

function AmpMark({ size = 20 }) {
  return (
    <span
      className="amark amark--launch amark--run"
      style={{
        width: size,
        height: size,
        display: "inline-block",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg
        fill="none"
        height={size}
        style={{ overflow: "hidden" }}
        viewBox="0 0 43 45"
        width={size}
      >
        <defs>
          <radialGradient cx="0.5" cy="0.5" id="sparkGlow-rocket" r="0.5">
            <stop offset="0%" stopColor={SPARK_COLOR} stopOpacity="0.5" />
            <stop offset="100%" stopColor={SPARK_COLOR} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="amp-rocket-body">
          <path
            className="amp-flame"
            d={`M ${SPARK_CX - 3.5} ${SPARK_CY + 6} Q ${SPARK_CX} ${SPARK_CY + 14} ${SPARK_CX + 3.5} ${SPARK_CY + 6} Q ${SPARK_CX} ${SPARK_CY + 9} ${SPARK_CX - 3.5} ${SPARK_CY + 6} Z`}
            fill={SPARK_COLOR}
            opacity="0.9"
          />
          <path
            className="amp-flame-inner"
            d={`M ${SPARK_CX - 1.8} ${SPARK_CY + 6} Q ${SPARK_CX} ${SPARK_CY + 11} ${SPARK_CX + 1.8} ${SPARK_CY + 6} Q ${SPARK_CX} ${SPARK_CY + 8} ${SPARK_CX - 1.8} ${SPARK_CY + 6} Z`}
            fill="#FFE9A8"
            opacity="0.95"
          />
          <circle
            className="amp-glow-rocket"
            cx={SPARK_CX}
            cy={SPARK_CY}
            fill="url(#sparkGlow-rocket)"
            r="14"
          />
          <path className="amark__leg amark__leg--left" d={LEFT_LEG} fill="currentColor" />
          <path className="amark__leg amark__leg--right" d={RIGHT_LEG} fill="currentColor" />
          <path
            className="amp-spark-rocket is-running"
            d={SPARK_PATH}
            fill={SPARK_COLOR}
            style={{ transformOrigin: `${SPARK_CX}px ${SPARK_CY}px` }}
          />
        </g>
      </svg>
    </span>
  );
}

const WORDS = [
  "Reading deals",
  "Skimming meetings",
  "Surfacing signals",
  "Stitching context",
  "Mapping accounts",
  "Tracing handoffs",
  "Scoring leads",
  "Lining up prospects",
];

function useCyclingWord(words, intervalMs = 1800) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("in");
  useEffect(() => {
    const id = setInterval(() => {
      setPhase("out");
      setTimeout(() => {
        setIndex((i) => {
          if (words.length <= 1) {
            return 0;
          }
          let next = Math.floor(Math.random() * words.length);
          if (next === i) {
            next = (next + 1) % words.length;
          }
          return next;
        });
        setPhase("in");
      }, 200);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words, intervalMs]);
  return { word: words[index % words.length], phase };
}

export function LoadingIndicator({ size = 20 }) {
  const { word, phase } = useCyclingWord(WORDS);
  return (
    <div
      aria-label="Loading"
      className="loading-chip"
      role="status"
      style={{ color: "var(--fg-primary)" }}
    >
      <AmpMark size={size} />
      <span className={`shimmer-word ${phase === "out" ? "is-out" : "is-in"}`}>
        {word}
        <span aria-hidden="true" className="shimmer-overlay">
          {word}
        </span>
      </span>
      <span className="loading-ellipsis">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
