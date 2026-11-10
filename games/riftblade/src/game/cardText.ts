/**
 * The text of a level-up card: its name and what its next tier gives. Upgrades have their own tier
 * lines; specialisations and fusions list their gains, each naming its stat.
 */
import { t, type TextKey } from '../i18n';
import { BRANCHES, FILLER, FUSION_BY_ID, STATS, UPGRADES, gainsOf, parseCard, type Gains, type Kit, type Stat } from './upgrades';

/** Each stat's line; shares are shown as whole percents. */
const STAT_TEXT: Record<Stat, TextKey> = {
  damage: 'gainDamage', fireRate: 'gainFireRate', hp: 'gainHealth', armour: 'gainArmour', speed: 'gainSpeed', crit: 'gainCrit',
  regen: 'gainRegen', sig: 'gainSig', cooldown: 'gainCooldown', dodge: 'gainDodge', reach: 'gainReach', pickup: 'gainPickup',
  xp: 'gainXp', credits: 'gainCredits', boss: 'gainBoss', harvest: 'gainHarvest', pierce: 'gainPierce', bounces: 'gainBounces',
  execute: 'gainExecute', slow: 'gainSlow',
};
/** The stats given as plain numbers rather than shares. */
const PLAIN = new Set<Stat>(['hp', 'regen', 'harvest', 'pierce', 'bounces']);

/** A tier's gains as one line: "+10% damage, +5% crit chance". */
export function gainsText(g: Gains): string {
  return STATS.filter((k) => g[k])
    .map((k) => t(STAT_TEXT[k], { n: PLAIN.has(k) ? g[k]! : Math.round(g[k]! * 100) }))
    .join(', ');
}

/** A card's name: the upgrade's, "<upgrade>: <specialisation>", or the fusion's. */
export function cardName(card: string): string {
  const c = parseCard(card);
  if (!c) return card;
  if (c.kind === 'filler') return t(FILLER.name);
  if (c.kind === 'fusion') return t(FUSION_BY_ID[c.id].name);
  if (c.kind === 'branch') return t('branchName', { name: t(UPGRADES[c.id].name), branch: t(BRANCHES[c.branch].name) });
  return t(UPGRADES[c.id].name);
}

/** What the card's next tier gives. */
export function tierText(kit: Kit, card: string): string {
  const c = parseCard(card);
  if (!c) return '';
  if (c.kind === 'filler') return t(FILLER.text);
  const g = gainsOf(kit, c);
  if (g) return gainsText(g);
  return t(UPGRADES[c.id].tiers[Math.min(kit.ranks[c.id] ?? 0, 4)]);
}
