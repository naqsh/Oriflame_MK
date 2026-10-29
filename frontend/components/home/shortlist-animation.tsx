import type { CSSProperties } from "react";

/**
 * Homepage hero illustration: the store's job in one short scene. Three products on a
 * shelf are ticked one by one, each lands in "Your list" as the count goes up, then a
 * line leads to paying on Oriflame. CSS-only (app/globals.css, "Shortlist animation"):
 * it plays once when motion is allowed, and the static markup is the finished scene,
 * which is what reduced-motion visitors see. Decorative: the hero text says the same.
 */

const PRODUCTS = [
  { color: "var(--shortlist-rose)", tick: { x: 50, y: 98 }, from: { x: 50, y: 150 } },
  { color: "var(--shortlist-saffron)", tick: { x: 91, y: 118 }, from: { x: 91, y: 168 } },
  { color: "var(--shortlist-teal)", tick: { x: 130, y: 148 }, from: { x: 130, y: 184 } },
] as const;

const ROW_TOP = [92, 128, 164] as const;
const SWATCH_X = 214;

/** Step i starts at 0.4 s + i x 0.8 s; `offset` places a part within its step. */
const START = 0.4;
const STEP = 0.8;
export const OFFSETS = { hop: 0, tick: 0.2, dot: 0.25, land: 0.75 } as const;
export const LINE_DELAY = START + 3 * STEP;
export const END_DELAY = LINE_DELAY + 0.45;

export function delay(index: number, offset: number, extra: Record<string, string> = {}): CSSProperties {
  return { animationDelay: `${(START + index * STEP + offset).toFixed(2)}s`, ...extra } as CSSProperties;
}

export function ShortlistAnimation() {
  return (
    <svg
      viewBox="0 0 400 300"
      aria-hidden="true"
      focusable="false"
      className="shortlist h-auto w-full max-w-sm"
    >
      {/* Shelf */}
      <rect x="20" y="200" width="140" height="6" rx="3" className="fill-muted-foreground/30" />

      {/* Dropper bottle */}
      <g className="shortlist-hop" style={delay(0, OFFSETS.hop)}>
        <rect x="35" y="140" width="30" height="60" rx="8" fill="var(--shortlist-rose)" />
        <rect x="44" y="126" width="12" height="16" rx="2" className="fill-foreground/80" />
        <ellipse cx="50" cy="120" rx="9" ry="8" className="fill-foreground/80" />
      </g>
      {/* Lipstick */}
      <g className="shortlist-hop" style={delay(1, OFFSETS.hop)}>
        <rect x="80" y="160" width="22" height="40" rx="3" className="fill-foreground/85" />
        <path d="M84 160 V140 L98 132 V160 Z" fill="var(--shortlist-saffron)" />
      </g>
      {/* Jar */}
      <g className="shortlist-hop" style={delay(2, OFFSETS.hop)}>
        <rect x="112" y="170" width="36" height="30" rx="7" fill="var(--shortlist-teal)" />
        <rect x="114" y="162" width="32" height="10" rx="3" className="fill-foreground/80" />
      </g>

      {/* Ticks above each product once it is shortlisted */}
      {PRODUCTS.map((product, index) => (
        <g key={`tick-${index}`} className="shortlist-tick" style={delay(index, OFFSETS.tick)}>
          <circle cx={product.tick.x} cy={product.tick.y} r="8" className="fill-foreground" />
          <path
            d={`M${product.tick.x - 3.5} ${product.tick.y} l2.5 2.5 l5 -5`}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-background"
          />
        </g>
      ))}

      {/* The list card */}
      <rect x="190" y="40" width="180" height="170" rx="14" className="fill-background stroke-border" strokeWidth="2" />
      <text x="206" y="70" fontSize="14" fontWeight="600" className="fill-foreground">
        Your list
      </text>
      <circle cx="346" cy="65" r="12" className="fill-foreground" />
      {["1", "2", "3"].map((count, index) => (
        <text
          key={count}
          x="346"
          y="69.5"
          fontSize="12"
          fontWeight="600"
          textAnchor="middle"
          className={`fill-background ${index < 2 ? "shortlist-count" : "shortlist-appear"}`}
          style={delay(index, OFFSETS.land)}
        >
          {count}
        </text>
      ))}
      {ROW_TOP.map((top, index) => (
        <g key={`row-${top}`} className="shortlist-appear" style={delay(index, OFFSETS.land)}>
          <circle cx={SWATCH_X} cy={top + 10} r="8" fill={PRODUCTS[index]!.color} />
          <rect x="230" y={top + 3} width="90" height="6" rx="3" className="fill-muted-foreground/40" />
          <rect x="230" y={top + 13} width="55" height="5" rx="2.5" className="fill-muted-foreground/25" />
        </g>
      ))}

      {/* A dot travels from each product into its row */}
      {PRODUCTS.map((product, index) => (
        <circle
          key={`dot-${index}`}
          cx={product.from.x}
          cy={product.from.y}
          r="6"
          fill={product.color}
          className="shortlist-dot"
          style={delay(index, OFFSETS.dot, {
            "--dx": `${SWATCH_X - product.from.x}px`,
            "--dy": `${ROW_TOP[index]! + 10 - product.from.y}px`,
          })}
        />
      ))}

      {/* Then on to Oriflame */}
      <path
        d="M280 212 V244"
        pathLength={1}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="shortlist-line stroke-foreground"
        style={{ animationDelay: `${LINE_DELAY}s` }}
      />
      <path d="M274 238 L280 245 L286 238" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shortlist-end stroke-foreground" style={{ animationDelay: `${END_DELAY}s` }} />
      <g className="shortlist-end" style={{ animationDelay: `${END_DELAY}s` }}>
        <rect x="190" y="254" width="180" height="34" rx="17" className="fill-muted stroke-border" strokeWidth="1.5" />
        {/* Padlock */}
        <rect x="207" y="268" width="12" height="10" rx="2" className="fill-foreground" />
        <path d="M209.5 268 v-3 a3.5 3.5 0 0 1 7 0 v3" fill="none" strokeWidth="1.8" className="stroke-foreground" />
        <text x="226" y="276" fontSize="12" fontWeight="500" className="fill-foreground">
          Pay on Oriflame&apos;s website
        </text>
      </g>
    </svg>
  );
}
