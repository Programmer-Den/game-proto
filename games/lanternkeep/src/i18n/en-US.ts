import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Lanternkeep's texts spelled differently in US English: the harbour's (LK15). */
const enUS: Partial<Translation<typeof en>> = {
  harbourName: 'The Harbor',
  spotHarbourMaster: "harbor master's lamp",
  harbourGoal: 'Harbor Festival: {kept} of {of} nights kept',
  harbourHeldGoal: 'The Harbor Festival was held: the nights go on.',
  harbourFestivalTitle: 'The Harbor Festival!',
  boonSub: '{n} nights kept by the sea. The harbor town gives the keep a boon,\nkept in this game and every game after, in both keeps.',
  bigCaskName: 'Harbor cask',
  festivalText: "{n} nights kept: the whole valley comes\nto see the keep's lanterns.\n\nKeep going here, set sail for the harbor town,\nor climb to the mountain monastery: ten nights each.",
};

export default enUS;
