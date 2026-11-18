import Phaser from 'phaser';
import { both, ellPts, hatch, ink, paint, rectPts, shadow, type Ctx, type Pt } from './paint';

// Customers and craftsmen: townsfolk seen from the front, 44x68 as shown with their feet at the
// bottom. Each look has its own tunic, hair and skin, and a hood or bare head.

export const CUSTOMER_LOOKS = 5;
export const customerTexture = (id: number) => `customer-${id % CUSTOMER_LOOKS}`;

interface Look {
  /** What sits on the head (AP21's night folk): a witch's pointed hat or a sailor's cap. */
  hat?: 'witch' | 'cap';
  /** A lamplighter's lit lantern on a pole, held at the right side. */
  lantern?: boolean;
  shirt: string;
  hair: string;
  skin: string;
  hood?: boolean;
  belt?: string;
  apron?: boolean;
}

const SKIN = ['#f0c49a', '#d9a070', '#9c6a48'];

const LOOKS: Look[] = [
  // A monk in a brown habit.
  { shirt: '#8a6a44', hair: '#6b4a2c', skin: SKIN[0], hood: true, belt: '#e8dcb8' },
  // A woman in a red dress with auburn hair.
  { shirt: '#b8323a', hair: '#8a4a22', skin: SKIN[1] },
  // A farmer in blue with straw-blond hair.
  { shirt: '#3f6fb0', hair: '#e8c45a', skin: SKIN[0] },
  // A woodsman in a green hood.
  { shirt: '#5e8f62', hair: '#3f6a3a', skin: SKIN[2], hood: true },
  // A merchant in violet with dark hair.
  { shirt: '#8f5a9e', hair: '#2a2020', skin: SKIN[1], belt: '#d4a84a' },
];

/** Craftsmen hired to work the stations: bare-headed, in work shirts under a leather apron. */
export const CRAFTSMAN_LOOKS = 2;
export const craftsmanTexture = (i: number) => `craftsman-${i % CRAFTSMAN_LOOKS}`;
const CRAFTSMEN: Look[] = [
  { shirt: '#e0d4b0', hair: '#5c3a21', skin: SKIN[0], apron: true },
  { shirt: '#8a8f9a', hair: '#1a1210', skin: SKIN[2], apron: true },
];

function drawPerson(c: Ctx, look: Look) {
  const x = 22, y = 66;
  shadow(c, x + 4, y + 0.5, 12, 3, 0.2);
  // Legs.
  for (const dx of [-6.5, 1.5]) both(c, rectPts(x + dx, y - 13, 5, 14, 1.5), '#4a3a32', { layers: 2 }, { w: 0.9 });
  // Tunic, with its shaded side hatched.
  const body: Pt[] = [[x - 10.5, y - 10], [x - 10.5, y - 25], [x - 6, y - 32], [x + 6, y - 32], [x + 10.5, y - 25], [x + 10.5, y - 10]];
  both(c, body, look.shirt, { layers: 3 }, { w: 1.1 });
  hatch(c, body.map(([a, b]) => [a + 8, b] as Pt), { gap: 2.4, alpha: 0.3, w: 0.5 });
  if (look.apron) {
    const apron: Pt[] = [[x - 5, y - 27], [x + 5, y - 27], [x + 6, y - 9], [x - 6, y - 9]];
    both(c, apron, '#9c6a3e', { layers: 2 }, { w: 0.9 });
    ink(c, [[x - 5, y - 27], [x - 4, y - 32]], { closed: false, w: 0.7 });
    ink(c, [[x + 5, y - 27], [x + 4, y - 32]], { closed: false, w: 0.7 });
  } else {
    ink(c, [[x - 10, y - 17], [x + 10, y - 17]], { closed: false, w: 1.6, col: look.belt ?? '#3b2416' });
  }
  // Arms at the sides.
  for (const side of [-1, 1]) {
    both(c, rectPts(x + side * 11 - 2.5, y - 30, 5, 15, 2.2), look.shirt, { layers: 2 }, { w: 0.9 });
    both(c, ellPts(x + side * 11, y - 14, 2.4, 2.4, 10), look.skin, { layers: 1 }, { w: 0.7 });
  }
  // Head, hair or hood.
  const hy = y - 40;
  if (look.hood) {
    both(c, ellPts(x, hy - 1, 10, 10, 20), look.hair, { layers: 3 }, { w: 1.1 });
    both(c, ellPts(x, hy + 1, 6.5, 7, 18), look.skin, { layers: 2 }, { w: 0.9 });
  } else {
    both(c, ellPts(x, hy, 8, 8.6, 20), look.skin, { layers: 2 }, { w: 1 });
    const hair: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      hair.push([x + Math.cos(a) * 8.8, hy - 1.5 + Math.sin(a) * 7.6]);
    }
    hair.push([x + 8.8, hy + 1], [x - 8.8, hy + 1]);
    both(c, hair, look.hair, { layers: 2 }, { w: 1 });
  }
  if (look.hat === 'witch') {
    both(c, ellPts(x, hy - 6, 13, 3, 20), '#2a2038', { layers: 2 }, { w: 1 });
    both(c, [[x - 7, hy - 7], [x + 2, hy - 26], [x + 7, hy - 7]], '#2a2038', { layers: 2 }, { w: 1 });
    ink(c, [[x - 6.5, hy - 9], [x + 6.5, hy - 9]], { closed: false, w: 1.4, col: '#7a5ab8' });
  } else if (look.hat === 'cap') {
    both(c, [[x - 9, hy - 4], [x - 7, hy - 10], [x + 7, hy - 10], [x + 9, hy - 4]], '#2a3a5a', { layers: 2 }, { w: 1 });
    ink(c, [[x - 10, hy - 4], [x + 10, hy - 4]], { closed: false, w: 1.6, col: '#e8e8f0' });
  }
  if (look.lantern) {
    ink(c, [[x + 15, y - 2], [x + 15, y - 54]], { closed: false, w: 1.4, col: '#5c3a21' });
    const g = c.createRadialGradient(x + 15, y - 52, 0, x + 15, y - 52, 9);
    g.addColorStop(0, 'rgba(255,214,110,0.9)');
    g.addColorStop(1, 'rgba(255,214,110,0)');
    c.fillStyle = g;
    c.fillRect(x + 6, y - 61, 18, 18);
    both(c, rectPts(x + 12, y - 56, 6, 7, 1), '#ffd88a', { layers: 1 }, { w: 0.8 });
  }
  // Dot eyes.
  c.fillStyle = '#2a1d14';
  for (const dx of [-3, 3]) {
    c.beginPath();
    c.arc(x + dx, hy + 2.5, 0.9, 0, Math.PI * 2);
    c.fill();
  }
}

/** The night folk (AP21): a witch, a lamplighter and a ghostly sailor, drawn pale (the scene shows him half see-through). */
export const NIGHT_FOLK: Record<'witch' | 'lamplighter' | 'sailor', Look> = {
  witch: { shirt: '#4a3060', hair: '#1a1210', skin: '#c8d8b0', hat: 'witch', belt: '#7a8f22' },
  lamplighter: { shirt: '#5a4a3a', hair: '#8a8a8a', skin: SKIN[1], hat: 'cap', lantern: true },
  sailor: { shirt: '#9ab8c8', hair: '#d8e8f0', skin: '#d8e8f0', hat: 'cap', belt: '#5a7a9a' },
};

export function bakeTownsfolk(scene: Phaser.Scene) {
  for (const [kind, look] of Object.entries(NIGHT_FOLK)) paint(scene, `night-${kind}`, 44, 68, (c) => drawPerson(c, look), 3);
  LOOKS.forEach((look, i) => paint(scene, `customer-${i}`, 44, 68, (c) => drawPerson(c, look), 3));
  CRAFTSMEN.forEach((look, i) => paint(scene, craftsmanTexture(i), 44, 68, (c) => drawPerson(c, look), 3));
}
