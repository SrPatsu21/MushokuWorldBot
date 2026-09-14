export interface ProcessXPInput {
  maxHp: number;
  maxStamina: number;
  staminaXp: number;
  maxMana: number;
  manaXp: number;
}

const HP_BONUS_PER_1000_XP = 2;
const STAMINA_BONUS_PER_1000_XP = 5;
const MANA_BONUS_PER_1000_XP = 10;

export function processXPProgression(stats: ProcessXPInput) {
  let { maxHp, maxStamina, staminaXp, maxMana, manaXp } = stats;

  while (staminaXp >= 1000) {
    staminaXp -= 1000;
    maxHp += HP_BONUS_PER_1000_XP;
    maxStamina += STAMINA_BONUS_PER_1000_XP;
  }

  while (manaXp >= 1000) {
    manaXp -= 1000;
    maxMana += MANA_BONUS_PER_1000_XP;
  }

  return { maxHp, maxStamina, staminaXp, maxMana, manaXp };
}