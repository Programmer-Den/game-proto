import type { Kind, Side } from "../game/chess";

// The Living Statues as sculpted figures: a hooded sentry with a shield, a tower with a lit gate, a
// seer with a lamp staff, a horse head with a carved mane, a veiled queen with a tiara and a bearded
// king in an ermine mantle. White is marble with gold inlay and amber gems, Black is obsidian with
// silver inlay and violet gems, and every statue has rune-lit eyes. Each is painted on a canvas in a
// 100-unit box, floor at y = 95, with plain canvas calls (no Phaser), so it can be drawn anywhere.

interface Stone {
  hi: string;
  mid: string;
  lo: string;
  line: string;
  /** A crease or a highlight with its alpha left as A. */
  crease: string;
  hl: string;
  /** The rune glow as r,g,b, and the hot middle of an eye. */
  glow: string;
  core: string;
  /** The inlay metal, light to dark, and the gem, light to dark. */
  metal: [string, string, string];
  gem: [string, string, string];
  /** The dark inside of a gate or a hood. */
  hollow: string;
}

const STONE: Record<Side, Stone> = {
  w: {
    hi: "#ffffff",
    mid: "#e3ded4",
    lo: "#a39c8f",
    line: "#5f5b54",
    crease: "rgba(95,88,78,A)",
    hl: "rgba(255,255,255,A)",
    glow: "255,184,77",
    core: "#fff0c8",
    metal: ["#fff1b0", "#e2b04a", "#8a5a14"],
    gem: ["#ffe2a8", "#ff9d2e", "#8a3d00"],
    hollow: "#3a342c",
  },
  b: {
    hi: "#6f6792",
    mid: "#2e2a41",
    lo: "#0c0a15",
    line: "#000000",
    crease: "rgba(0,0,0,A)",
    hl: "rgba(175,155,225,A)",
    glow: "185,140,255",
    core: "#efe4ff",
    metal: ["#f2f4fa", "#a9b2c6", "#4a5266"],
    gem: ["#f0e2ff", "#a76bff", "#3d1580"],
    hollow: "#05040a",
  },
};

/** Where each statue's neck is: the head topples off above it. */
export const NECK: Record<Kind, number> = {
  p: 55,
  r: 41,
  b: 52,
  n: 50,
  q: 46,
  k: 44,
};

type Ctx = CanvasRenderingContext2D;
type Box = [number, number, number, number];
const P = (d: string) => new Path2D(d);
const circle = (x: number, y: number, r: number) =>
  P(`M${x} ${y - r} A${r} ${r} 0 1 0 ${x + 0.01} ${y - r} Z`);
const alpha = (s: Side, key: "crease" | "hl", a: number) =>
  STONE[s][key].replace("A", String(a));

/** Fills a part with the stone, lit from the upper left, and outlines it. */
function solid(
  c: Ctx,
  path: Path2D,
  s: Side,
  [x0, y0, x1, y1]: Box,
  o: { dark?: boolean; lw?: number } = {},
) {
  const m = STONE[s];
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, o.dark ? m.mid : m.hi);
  g.addColorStop(0.5, o.dark ? m.lo : m.mid);
  g.addColorStop(1, m.lo);
  c.fillStyle = g;
  c.fill(path);
  c.save();
  c.clip(path);
  const h = c.createLinearGradient(x0, 0, x1, 0);
  h.addColorStop(0, "rgba(0,0,0,0.22)");
  h.addColorStop(0.24, "rgba(255,255,255,0.38)");
  h.addColorStop(0.46, "rgba(255,255,255,0)");
  h.addColorStop(0.8, "rgba(0,0,0,0.16)");
  h.addColorStop(1, "rgba(0,0,0,0.5)");
  c.fillStyle = h;
  c.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  c.restore();
  c.lineWidth = o.lw ?? 1.5;
  c.lineJoin = "round";
  c.strokeStyle = m.line;
  c.stroke(path);
}

function line(c: Ctx, d: string | Path2D, color: string, lw = 1) {
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.stroke(typeof d === "string" ? P(d) : d);
}
const crease = (c: Ctx, s: Side, d: string, a = 0.5, lw = 1) =>
  line(c, d, alpha(s, "crease", a), lw);
const hilite = (c: Ctx, s: Side, d: string, a = 0.6, lw = 0.9) =>
  line(c, d, alpha(s, "hl", a), lw);

/** A strip of inlaid metal along a line: a dark edge, the metal and a glint. */
function inlay(c: Ctx, s: Side, d: string, lw = 1.4) {
  const [hi, mid, lo] = STONE[s].metal;
  line(c, d, lo, lw + 0.7);
  line(c, d, mid, lw);
  line(c, d, hi, lw * 0.35);
}

/** A part cast in the inlay metal. */
function metal(c: Ctx, s: Side, path: Path2D, [x0, , x1]: Box, lw = 0.8) {
  const [hi, mid, lo] = STONE[s].metal;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, lo);
  g.addColorStop(0.3, hi);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, lo);
  c.fillStyle = g;
  c.fill(path);
  c.lineWidth = lw;
  c.lineJoin = "round";
  c.strokeStyle = lo;
  c.stroke(path);
}

/** A glowing gem, round or a diamond. */
function gem(
  c: Ctx,
  s: Side,
  x: number,
  y: number,
  r: number,
  diamond = false,
) {
  const [hi, mid, lo] = STONE[s].gem;
  const p = diamond
    ? P(
        `M${x} ${y - r} L${x + r * 0.9} ${y} L${x} ${y + r} L${x - r * 0.9} ${y} Z`,
      )
    : circle(x, y, r);
  const g = c.createRadialGradient(
    x - r * 0.35,
    y - r * 0.35,
    0,
    x,
    y,
    r * 1.2,
  );
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  c.save();
  c.shadowColor = `rgba(${STONE[s].glow},0.9)`;
  c.shadowBlur = r * 2.2;
  c.fillStyle = g;
  c.fill(p);
  c.restore();
  c.lineWidth = 0.6;
  c.strokeStyle = STONE[s].metal[2];
  c.stroke(p);
  if (diamond)
    line(
      c,
      `M${x - r * 0.9} ${y} L${x + r * 0.9} ${y}`,
      "rgba(255,255,255,0.45)",
      0.5,
    );
}

function glowDot(c: Ctx, s: Side, x: number, y: number, r: number) {
  const m = STONE[s];
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2);
  g.addColorStop(0, `rgba(${m.glow},0.95)`);
  g.addColorStop(1, `rgba(${m.glow},0)`);
  c.fillStyle = g;
  c.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  c.fillStyle = m.core;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function eyes(c: Ctx, s: Side, x: number, y: number, gap: number, r: number) {
  glowDot(c, s, x - gap, y, r);
  glowDot(c, s, x + gap, y, r);
}

/** A glowing slit, for the rook's windows. */
function slit(c: Ctx, s: Side, x: number, y0: number, y1: number) {
  const m = STONE[s];
  c.fillStyle = "rgba(0,0,0,0.7)";
  c.fillRect(x - 1.4, y0 - 2, 2.8, y1 - y0 + 4);
  c.save();
  c.shadowColor = `rgba(${m.glow},1)`;
  c.shadowBlur = 5;
  line(c, `M${x} ${y0} L${x} ${y1}`, `rgba(${m.glow},0.95)`, 1.4);
  c.restore();
  line(c, `M${x} ${y0} L${x} ${y1}`, m.core, 0.6);
}

function shadow(c: Ctx, rx: number) {
  c.fillStyle = "rgba(0,0,0,0.3)";
  c.beginPath();
  c.ellipse(52, 95, rx, 4.5, 0, 0, Math.PI * 2);
  c.fill();
}

/** The stepped plinth every statue stands on, with an inlaid rim and studs. */
function plinth(c: Ctx, s: Side) {
  solid(c, P("M23 88 L77 88 L78 95 L22 95 Z"), s, [22, 88, 78, 95], {
    dark: true,
  });
  solid(c, P("M25 84 L75 84 L77 88 L23 88 Z"), s, [23, 84, 77, 88]);
  inlay(c, s, "M24 87.6 L76 87.6", 0.9);
  c.fillStyle = STONE[s].metal[1];
  for (let x = 30; x <= 70; x += 8) {
    c.beginPath();
    c.arc(x, 91.6, 0.75, 0, Math.PI * 2);
    c.fill();
  }
}

const STATUES: Record<Kind, (c: Ctx, s: Side) => void> = {
  p(c, s) {
    shadow(c, 30);
    plinth(c, s);
    solid(
      c,
      P("M36 85 C37 72 39 62 41 58 C43 54 57 54 59 58 C61 62 63 72 64 85 Z"),
      s,
      [36, 54, 64, 85],
    );
    crease(c, s, "M56 61 Q58 72 59 84 M52 72 Q53 79 53 84", 0.45);
    hilite(c, s, "M40 66 Q39 75 39 83", 0.5);
    solid(
      c,
      P(
        "M50 30 C58 31 62 38 61 46 C61 52 57 56 50 56 C43 56 39 52 39 46 C38 38 42 31 50 30 Z",
      ),
      s,
      [39, 30, 61, 56],
    );
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.beginPath();
    c.ellipse(50, 47, 6.2, 6.6, 0, 0, Math.PI * 2);
    c.fill();
    inlay(c, s, "M43.6 42 Q50 37.6 56.4 42", 0.9);
    hilite(c, s, "M43 35 Q46 32 51 32", 0.7);
    eyes(c, s, 50, 46.5, 2.6, 1.3);
    // The shield: an inlaid rim round a gem boss.
    solid(c, circle(43, 71, 10), s, [33, 61, 53, 81]);
    inlay(c, s, "M43 62.3 A8.7 8.7 0 1 0 43.01 62.3 Z", 1.1);
    gem(c, s, 43, 71, 2.5);
  },
  r(c, s) {
    shadow(c, 32);
    plinth(c, s);
    const body = P("M31 84 L34 40 L66 40 L69 84 Z");
    solid(c, body, s, [31, 40, 69, 84]);
    c.save();
    c.clip(body);
    for (let i = 0; i < 6; i++) {
      const y = 46 + i * 7;
      crease(c, s, `M28 ${y} L72 ${y}`, 0.35, 0.8);
      hilite(c, s, `M28 ${y + 0.9} L72 ${y + 0.9}`, 0.25, 0.6);
      for (let x = 36 + (i % 2) * 6; x < 68; x += 12)
        crease(c, s, `M${x} ${y} L${x} ${y + 7}`, 0.3, 0.7);
    }
    c.restore();
    solid(
      c,
      P(
        "M27 41 L27 18 L35.5 18 L35.5 24 L44.5 24 L44.5 18 L55.5 18 L55.5 24 L64.5 24 L64.5 18 L73 18 L73 41 Z",
      ),
      s,
      [27, 18, 73, 41],
    );
    inlay(c, s, "M27.8 34.5 L72.2 34.5", 1.3);
    hilite(c, s, "M28 18.8 L35 18.8 M45 18.8 L55 18.8 M65 18.8 L72 18.8", 0.7);
    for (const x of [33, 41, 50, 59, 67])
      crease(c, s, `M${x - 3} 41 Q${x} 45 ${x + 3} 41`, 0.45, 0.8);
    // The gate glows from inside, framed in metal with a gem keystone.
    const gate = P("M43 84 L43 72 Q50 62 57 72 L57 84 Z");
    c.fillStyle = STONE[s].hollow;
    c.fill(gate);
    const g = c.createRadialGradient(50, 80, 0, 50, 80, 10);
    g.addColorStop(0, `rgba(${STONE[s].glow},0.55)`);
    g.addColorStop(1, `rgba(${STONE[s].glow},0)`);
    c.save();
    c.clip(gate);
    c.fillStyle = g;
    c.fillRect(40, 62, 20, 22);
    c.restore();
    inlay(c, s, "M42.6 84 L42.6 72 Q50 61.4 57.4 72 L57.4 84", 1.1);
    gem(c, s, 50, 66.4, 1.7, true);
    slit(c, s, 43.5, 49, 54);
    slit(c, s, 56.5, 49, 54);
  },
  b(c, s) {
    shadow(c, 30);
    plinth(c, s);
    // The lamp staff, cast in metal.
    metal(c, s, P("M63 84 L63 30 L65.6 30 L65.6 84 Z"), [63, 30, 65.6, 84]);
    solid(
      c,
      P("M35 85 C38 72 42 62 44 50 L56 50 C58 62 62 72 65 85 Z"),
      s,
      [35, 50, 65, 85],
    );
    inlay(c, s, "M47 69 L45.5 84.5 M53 69 L54.5 84.5", 1);
    hilite(c, s, "M39 76 Q41 66 43 58", 0.5);
    solid(
      c,
      P("M42 62 Q50 67 58 62 L59 67 Q50 73 41 67 Z"),
      s,
      [41, 62, 59, 73],
      { lw: 1 },
    );
    solid(
      c,
      P(
        "M50 13 C58 21 62 31 61 41 C60 50 56 53 50 53 C44 53 40 50 39 41 C38 31 42 21 50 13 Z",
      ),
      s,
      [38, 13, 62, 53],
    );
    inlay(c, s, "M54 18 Q51 25 56 32", 1.1);
    hilite(c, s, "M44 24 Q42 30 42 36", 0.6);
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.beginPath();
    c.ellipse(50, 42, 5.8, 7.2, 0, 0, Math.PI * 2);
    c.fill();
    eyes(c, s, 50, 41.5, 2.4, 1.25);
    metal(
      c,
      s,
      P("M60.5 30.5 L68.1 30.5 L66.5 27.5 L62.1 27.5 Z"),
      [60.5, 27.5, 68.1, 30.5],
      0.6,
    );
    gem(c, s, 64.3, 23.4, 4);
  },
  n(c, s) {
    shadow(c, 31);
    plinth(c, s);
    solid(
      c,
      P(
        "M33 85 C34 76 38 68 42 60 C38 57 33 56 29 56 C25 56 22 53 22 49 C22 46 24 44 26 41 L35 29 C38 25 43 22 48 21 L52 10 L56 20 C64 23 70 32 72 44 C73 56 71 70 70 85 Z",
      ),
      s,
      [22, 10, 73, 85],
    );
    solid(
      c,
      P(
        "M56 20 C64 23 70.5 32 72.5 44 C73.5 56 71.5 70 70.5 85 L65 85 C66 72 68 58 66 46 C64 35 60 28 54 23 Z",
      ),
      s,
      [54, 20, 73.5, 85],
      { dark: true, lw: 1 },
    );
    for (let i = 0; i < 7; i++)
      crease(
        c,
        s,
        `M${62 + i * 0.6} ${28 + i * 8} q5 3 ${7 - i * 0.3} 9`,
        0.55,
        0.9,
      );
    crease(c, s, "M42 60 C45 52 43 44 36 42", 0.55, 1.1);
    hilite(c, s, "M30 38 L37 30 M27 46 Q30 44 33 44", 0.7);
    crease(c, s, "M23 52 Q27 53.5 31 52.5 M48 22 L49.5 13.5", 0.55, 0.9);
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.beginPath();
    c.ellipse(26.5, 47, 1.6, 1.1, 0.4, 0, Math.PI * 2);
    c.fill();
    // The bridle and the chest strap, inlaid, with a gem where the straps meet.
    inlay(c, s, "M29 40 L44 49 L41 58", 1.3);
    inlay(c, s, "M37 71 Q50 75.5 64 71", 1.3);
    gem(c, s, 44, 49, 1.9);
    glowDot(c, s, 42, 33, 1.6);
  },
  q(c, s) {
    shadow(c, 31);
    plinth(c, s);
    solid(
      c,
      P("M50 23 C61 25 64 40 63 60 L37 60 C36 40 39 25 50 23 Z"),
      s,
      [36, 23, 64, 60],
      { dark: true, lw: 1 },
    );
    solid(
      c,
      P("M33 85 C38 74 42 64 45 52 L55 52 C58 64 62 74 67 85 Z"),
      s,
      [33, 52, 67, 85],
    );
    crease(c, s, "M48 58 Q44 72 41 84 M52 58 Q56 72 59 84", 0.4, 0.9);
    inlay(c, s, "M50 60 L50 84", 1);
    inlay(c, s, "M35.5 81 Q50 84.5 64.5 81", 1);
    hilite(c, s, "M38 80 Q41 70 44 60", 0.5);
    solid(
      c,
      P("M40 55 C41 48 45 46 50 46 C55 46 59 48 60 55 C57 59 43 59 40 55 Z"),
      s,
      [40, 46, 60, 59],
      { lw: 1 },
    );
    inlay(c, s, "M45 50.5 Q50 54 55 50.5", 0.9);
    gem(c, s, 50, 53, 1.5);
    solid(c, circle(50, 38, 8), s, [42, 30, 58, 46], { lw: 1.1 });
    eyes(c, s, 50, 38.5, 3, 1.2);
    metal(
      c,
      s,
      P(
        "M41.5 33 L40 22 L44.5 28 L47 17 L50 27 L53 17 L55.5 28 L60 22 L58.5 33 Q50 30 41.5 33 Z",
      ),
      [40, 17, 60, 33],
    );
    for (const [x, y] of [
      [40, 21],
      [47, 16],
      [53, 16],
      [60, 21],
    ])
      gem(c, s, x, y, 1.5);
  },
  k(c, s) {
    shadow(c, 33);
    plinth(c, s);
    solid(
      c,
      P("M29 85 C33 70 37 58 39 48 L61 48 C63 58 67 70 71 85 Z"),
      s,
      [29, 48, 71, 85],
    );
    crease(
      c,
      s,
      "M50 56 L50 84 M44 60 Q41 72 37 84 M56 60 Q59 72 63 84",
      0.4,
      0.9,
    );
    inlay(c, s, "M31.2 81 Q50 85 68.8 81", 1.1);
    metal(
      c,
      s,
      P("M41 63 Q50 66 59 63 L59.5 67 Q50 70 40.5 67 Z"),
      [40.5, 63, 59.5, 70],
    );
    gem(c, s, 50, 66.5, 1.8);
    solid(
      c,
      P("M36 53 C37 46 43 43 50 43 C57 43 63 46 64 53 C59 57 41 57 36 53 Z"),
      s,
      [36, 43, 64, 57],
      { lw: 1.1 },
    );
    c.fillStyle = alpha(s, "crease", 0.55);
    for (const [x, y] of [
      [40, 51],
      [45, 53],
      [50, 54],
      [55, 53],
      [60, 51],
      [43, 48],
      [57, 48],
    ])
      c.fillRect(x - 0.6, y - 1, 1.2, 2);
    inlay(c, s, "M36.6 53.6 C41 57.3 59 57.3 63.4 53.6", 0.9);
    solid(c, circle(50, 36, 8.5), s, [41.5, 27.5, 58.5, 44.5], { lw: 1.1 });
    solid(
      c,
      P(
        "M42.5 37 C42.5 45 46 50 50 51 C54 50 57.5 45 57.5 37 C54 40.5 46 40.5 42.5 37 Z",
      ),
      s,
      [42.5, 37, 57.5, 51],
      { dark: true, lw: 0.9 },
    );
    crease(c, s, "M47 42 L47.5 48 M50 42 L50 50 M53 42 L52.5 48", 0.45, 0.7);
    eyes(c, s, 50, 34.5, 3.1, 1.15);
    metal(
      c,
      s,
      P(
        "M40.5 31 L59.5 31 L61 22 L56.5 26 L53.5 18.5 L50 24 L46.5 18.5 L43.5 26 L39 22 Z",
      ),
      [39, 18.5, 61, 31],
    );
    gem(c, s, 50, 28, 1.3);
    // The crown ends in a diamond, never a cross.
    gem(c, s, 50, 12.5, 5.2, true);
  },
};

/** Paints one statue into a 100-unit box. */
export function paintStatue(c: Ctx, kind: Kind, side: Side) {
  STATUES[kind](c, side);
}
