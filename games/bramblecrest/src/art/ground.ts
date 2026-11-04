// Paints a map's ground in one texture: moss and grass, worn paths, still water, the shrine's and
// the belfry's flagstones, walls, cracked walls and pits. Trees, bushes and everything that stands up are sprites on top.

import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import { DUNGEONS, TILE, tileAt, underBoulder, type MapDef, type Tile } from '../game/maps';
import { paint, shade } from './paint';

/** The ground of each place; on the peaks the grass is snow and the path trodden snow. */
const GRASS: Record<string, string> = { village: '#4f7a46', woods: '#3f6a40', fen: '#3d6a5a', shrine: '#4a4a56', belfry: '#44505a', peaks: '#9aa8bc', caverns: '#48566a' };
const PATH: Record<string, string> = { village: '#b49a72', woods: '#8f7c5c', fen: '#8a7a5a', shrine: '#6a6a74', belfry: '#62707a', peaks: '#7c8698', caverns: '#5a6a80' };
/** Flagstones: the shrine's grey, the belfry's drowned blue, the caverns' ice, and the peaks' old lookout. */
const FLOOR: Record<string, string> = { shrine: '#55535e', belfry: '#4a5868', caverns: '#58708a', peaks: '#62666e' };

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

export function groundKey(map: MapDef) {
  return `ground-${map.id}`;
}

export function paintGround(scene: Phaser.Scene, map: MapDef) {
  const W = map.w * TILE;
  const H = map.h * TILE;
  const r = rng(map.w * 131 + map.h);
  const grass = GRASS[map.theme];
  const path = PATH[map.theme];
  const is = (x: number, y: number, ...t: Tile[]) => t.includes(tileAt(map, x, y));
  paint(
    scene,
    groundKey(map),
    W,
    H,
    (c) => {
      c.fillStyle = DUNGEONS.has(map.id) ? '#15141c' : grass;
      c.fillRect(0, 0, W, H);
      for (let y = 0; y < map.h; y++)
        for (let x = 0; x < map.w; x++) {
          let t = tileAt(map, x, y);
          // A boulder stands on the path or grass it blocks; its sprite goes on top.
          if (t === 'boulder') t = underBoulder(map, x, y);
          const px = x * TILE;
          const py = y * TILE;
          switch (t) {
            case 'grass':
            case 'flowers':
            case 'reeds':
            case 'tree':
            case 'faketree':
            case 'bush':
              c.fillStyle = shade(grass, (r() - 0.5) * 0.12);
              c.fillRect(px, py, TILE, TILE);
              for (let i = 0; i < 5; i++) {
                c.fillStyle = shade(grass, 0.12 + r() * 0.15);
                c.fillRect(px + r() * 30, py + r() * 28, 1.5, 3 + r() * 3);
              }
              if (t === 'flowers')
                for (let i = 0; i < 4; i++) {
                  c.fillStyle = ['#f0e8f8', '#f0d070', '#e8a0c8', '#a8c0f0'][Math.floor(r() * 4)];
                  c.beginPath();
                  c.arc(px + 5 + r() * 22, py + 5 + r() * 22, 2.2, 0, Math.PI * 2);
                  c.fill();
                }
              if (t === 'reeds') {
                c.strokeStyle = shade(grass, 0.35);
                c.lineWidth = 1.5;
                for (let i = 0; i < 6; i++) {
                  const bx = px + 4 + r() * 24;
                  c.beginPath();
                  c.moveTo(bx, py + 28);
                  c.quadraticCurveTo(bx + 2, py + 16, bx + (r() - 0.5) * 8, py + 4 + r() * 6);
                  c.stroke();
                }
              }
              break;
            case 'path':
            case 'thorns': {
              c.fillStyle = shade(grass, -0.05);
              c.fillRect(px, py, TILE, TILE);
              c.fillStyle = shade(path, (r() - 0.5) * 0.1);
              c.beginPath();
              c.roundRect(px - 2, py - 2, TILE + 4, TILE + 4, 10);
              c.fill();
              for (let i = 0; i < 3; i++) {
                c.fillStyle = shade(path, -0.15 + r() * 0.3);
                c.beginPath();
                c.ellipse(px + 4 + r() * 24, py + 4 + r() * 24, 3 + r() * 3, 2 + r() * 2, 0, 0, Math.PI * 2);
                c.fill();
              }
              break;
            }
            case 'water': {
              const g = c.createLinearGradient(0, py, 0, py + TILE);
              g.addColorStop(0, '#2a5a7a');
              g.addColorStop(1, '#1d4462');
              c.fillStyle = g;
              c.fillRect(px, py, TILE, TILE);
              if (!is(x, y - 1, 'water')) {
                c.fillStyle = 'rgba(10,20,30,0.45)';
                c.fillRect(px, py, TILE, 6);
              }
              if (r() < 0.35) {
                c.strokeStyle = 'rgba(200,230,255,0.35)';
                c.lineWidth = 1.5;
                c.beginPath();
                c.ellipse(px + 8 + r() * 16, py + 10 + r() * 14, 6, 1.8, 0, 0, Math.PI * 2);
                c.stroke();
              }
              break;
            }
            case 'floor': {
              c.fillStyle = shade(FLOOR[map.theme] ?? FLOOR.shrine, (r() - 0.5) * 0.12);
              c.fillRect(px, py, TILE, TILE);
              c.strokeStyle = 'rgba(15,14,20,0.55)';
              c.lineWidth = 1.5;
              c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
              if (r() < 0.2) {
                c.fillStyle = 'rgba(80,120,70,0.5)';
                c.beginPath();
                c.ellipse(px + r() * 32, py + r() * 32, 5, 3, 0, 0, Math.PI * 2);
                c.fill();
              }
              break;
            }
            case 'ring':
              c.fillStyle = '#2a2230';
              c.fillRect(px, py, TILE, TILE);
              break;
            case 'pit':
            case 'veil': {
              // A hidden bridge is a pit like the rest of the chasm; its stones are sprites the Moonlantern shows.
              c.fillStyle = '#05050a';
              c.fillRect(px, py, TILE, TILE);
              if (!is(x, y - 1, 'pit', 'veil')) {
                const g = c.createLinearGradient(0, py, 0, py + 14);
                g.addColorStop(0, '#3a3842');
                g.addColorStop(1, 'rgba(5,5,10,0)');
                c.fillStyle = g;
                c.fillRect(px, py, TILE, 14);
              }
              break;
            }
            case 'wall':
            case 'crack': {
              // A wall over open floor shows its lit face; deeper wall is the dark top of the masonry.
              // A cracked wall always shows its face, split by dark cracks.
              const below = tileAt(map, x, y + 1);
              const open = t === 'crack' || (below !== 'wall' && below !== 'crack');
              c.fillStyle = shade('#2c2a36', (r() - 0.5) * 0.15);
              c.fillRect(px, py, TILE, TILE);
              if (open) {
                const g = c.createLinearGradient(0, py + 6, 0, py + TILE);
                g.addColorStop(0, '#6a6676');
                g.addColorStop(1, '#3a3844');
                c.fillStyle = g;
                c.fillRect(px, py + 8, TILE, TILE - 8);
                c.strokeStyle = 'rgba(20,18,26,0.6)';
                c.lineWidth = 1.5;
                c.beginPath();
                c.moveTo(px, py + 20);
                c.lineTo(px + TILE, py + 20);
                c.moveTo(px + (x % 2 ? 10 : 22), py + 8);
                c.lineTo(px + (x % 2 ? 10 : 22), py + 20);
                c.stroke();
              }
              if (t === 'crack') {
                c.strokeStyle = '#0a0a10';
                c.lineWidth = 2;
                c.beginPath();
                c.moveTo(px + 8, py + 9);
                c.lineTo(px + 14, py + 17);
                c.lineTo(px + 11, py + 24);
                c.lineTo(px + 18, py + 31);
                c.moveTo(px + 14, py + 17);
                c.lineTo(px + 24, py + 14);
                c.moveTo(px + 11, py + 24);
                c.lineTo(px + 4, py + 28);
                c.stroke();
              }
              break;
            }
          }
        }
    },
    sharpRes(W, H, 1),
  );
}
