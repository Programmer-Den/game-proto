import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Your knight never stops running: jump and slide past traps and foes to get as far as you can. The run ends with the last heart.',
  controls: [
    {
      input: 'Tap the top half or the Jump button, or Space / Up / W',
      action: 'Jump (again in the air with Second Leap)',
    },
    {
      input: 'Tap the bottom half or the Slide button, or Down / S',
      action: 'Slide; in the air, drop fast and slide on landing',
    },
    { input: 'Tap a boon card', action: 'Take that boon at a checkpoint' },
    {
      input: 'Tap a road card',
      action: 'Choose the High Road or the Low Road for the next stage',
    },
    {
      input: 'Run again or Courses',
      action: "After a fall, start a new run, or pick the day's course, the week's road or a challenge course",
    },
    {
      input: 'Armoury',
      action: 'After a fall, spend banked coins on lasting upgrades, other knights and companions, and choose who runs',
    },
  ],
  loop: [
    'Jump the spikes, pits and goblins, and slide under the hanging spiked logs.',
    'Pick up coins along the way, and take them in a row to build a streak.',
    'Reach the checkpoint banner every 100 m and choose one of the boons on offer.',
    'Each stage after runs a little faster, on new ground with its own rule.',
    'When you fall, the coins you picked up are banked for the armoury and the next run.',
  ],
  tips: [
    'Every hit costs a heart and resets your coin streak; you blink and stay safe for a moment after.',
    'Landing on a goblin or bat from above knocks it out for a coin and bounces you back up.',
    'Fire vents only burn part of the time: jump them, or run over while they are out.',
    'From stage 2, slide into a wayside shrine to trade 15 coins for a heart.',
    "Meet the herald's dare on a stage for 20 coins and a third boon card.",
    'Every fifth stage a Gatekeeper bars the road: dodge its barrels and axes, then stomp its helm three times.',
    'Some boons cost you something, and two boons held together can unlock a hidden bonus.',
    "Beyond the Dragon's Keep the Sky Road crosses gaps on clouds: land on one and leap off before it falls. A gust at your back carries jumps further.",
    'The squire jumps again in the air but has a heart fewer; the heavy knight smashes goblins and bats but jumps lower.',
    'Your best run races beside you as a faint ghost.',
    'A companion runs along on ordinary runs: the owl grabs coins out of reach, the hound barks before a trap, the fox takes a hit once a stage.',
    'Each challenge course pays three stars: reach its banner, with no hit, with every coin. Every star wins the gold boots.',
    'The weekly road is the same all week and starts with two set boons: run it as often as you like for a best distance.',
  ],
};

/** US English only changes the spelling. */
const us = (text: string) => text.replace(/Armoury/g, 'Armory').replace(/armoury/g, 'armory');
const enUS: HowToPlay = {
  goal: us(en.goal),
  controls: en.controls.map((c) => ({ input: us(c.input), action: us(c.action) })),
  loop: en.loop.map(us),
  tips: en.tips.map(us),
};

const de: HowToPlay = {
  goal: 'Dein Ritter hört nie auf zu laufen: Spring und rutsch an Fallen und Feinden vorbei, so weit du kannst. Der Lauf endet mit dem letzten Herz.',
  controls: [
    {
      input: 'Obere Hälfte oder den Springen-Knopf antippen, oder Leertaste / Hoch / W',
      action: 'Springen (mit Zweiter Satz noch einmal in der Luft)',
    },
    {
      input: 'Untere Hälfte oder den Rutschen-Knopf antippen, oder Runter / S',
      action: 'Rutschen; in der Luft schnell fallen und bei der Landung rutschen',
    },
    { input: 'Eine Gabenkarte antippen', action: 'Diese Gabe an einem Rastplatz nehmen' },
    {
      input: 'Eine Wegkarte antippen',
      action: 'Den Höhenweg oder den Talweg für die nächste Etappe wählen',
    },
    {
      input: 'Neuer Lauf oder Strecken',
      action: 'Nach einem Sturz einen neuen Lauf beginnen, oder die Strecke des Tages, den Weg der Woche oder eine Prüfungsstrecke wählen',
    },
    {
      input: 'Rüstkammer',
      action: 'Nach einem Sturz gesparte Münzen für dauerhafte Verbesserungen, andere Ritter und Gefährten ausgeben, und wählen, wer läuft',
    },
  ],
  loop: [
    'Spring über Stacheln, Gruben und Kobolde, und rutsch unter den hängenden Stachelstämmen durch.',
    'Sammle unterwegs Münzen, und nimm sie in Folge, um eine Serie aufzubauen.',
    'Erreiche alle 100 m die Rastplatzfahne und wähle eine der angebotenen Gaben.',
    'Jede weitere Etappe läuft etwas schneller, auf neuem Boden mit eigener Regel.',
    'Wenn du fällst, werden die gesammelten Münzen für die Rüstkammer und den nächsten Lauf gespart.',
  ],
  tips: [
    'Jeder Treffer kostet ein Herz und setzt deine Münzserie zurück; danach blinkst du und bist kurz sicher.',
    'Wer von oben auf einem Kobold oder einer Fledermaus landet, schaltet ihn für eine Münze aus und federt wieder hoch.',
    'Feueröffnungen brennen nur zeitweise: spring darüber, oder lauf hinüber, wenn sie aus sind.',
    'Ab Etappe 2 rutsch in einen Wegschrein, um 15 Münzen gegen ein Herz zu tauschen.',
    'Erfülle die Mutprobe des Herolds auf einer Etappe für 20 Münzen und eine dritte Gabenkarte.',
    'Jede fünfte Etappe versperrt ein Torwächter den Weg: weiche seinen Fässern und Äxten aus und zertritt dann dreimal seinen Helm.',
    'Manche Gaben kosten dich etwas, und zwei Gaben zusammen können einen verborgenen Bonus freischalten.',
    'Jenseits der Drachenfeste führt die Himmelsstraße auf Wolken über Lücken: lande auf einer und spring ab, ehe sie fällt. Eine Böe im Rücken trägt Sprünge weiter.',
    'Der Knappe springt in der Luft erneut, hat aber ein Herz weniger; der schwere Ritter zermalmt Kobolde und Fledermäuse, springt aber niedriger.',
    'Dein bester Lauf läuft als blasser Geist neben dir mit.',
    'Ein Gefährte läuft bei gewöhnlichen Läufen mit: die Eule schnappt Münzen außer Reichweite, der Jagdhund bellt vor einer Falle, der Fuchs fängt einmal pro Etappe einen Treffer ab.',
    'Jede Prüfungsstrecke bringt drei Sterne: erreiche ihr Banner, ohne Treffer, mit jeder Münze. Alle Sterne gewinnen die goldenen Stiefel.',
    'Der Wochenweg bleibt die ganze Woche gleich und beginnt mit zwei festen Gaben: lauf ihn so oft du willst für einen Rekord.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
