import { prisma } from '../config/database';
import { ActionType } from '@prisma/client';
import { processXPProgression } from './stats';

const REGEN_HP_PER_MIN = 5;
const REGEN_STAMINA_PER_MIN = 20;
const REGEN_MANA_PER_MIN = 5;

export const DEATH_PENALTY_SECONDS = 12 * 60 * 60; // 12 horas

export async function triggerPlayerDeath(profileId: number, reason: string = 'Quest Failed') {
  await prisma.userAction.deleteMany({ where: { profileId } });

  return await prisma.userAction.create({
    data: {
      profileId,
      type: ActionType.REST,
      duration: DEATH_PENALTY_SECONDS,
      startedAt: new Date(),
      data: { isDeathRecovery: true, reason },
    },
  });
}

export async function syncProfileState(profileId: number) {
  let profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: {
      currentAction: true,
      swordsman: true,
      mage: true,
      party: true,
    },
  });

  if (!profile) return null;

  const now = new Date();
  let currentHp = profile.currentHp;
  let maxHp = profile.maxHp;

  let currentStamina = profile.currentStamina;
  let maxStamina = profile.maxStamina;
  let staminaXp = profile.staminaXp;

  let currentMana = profile.currentMana;
  let maxMana = profile.maxMana;
  let manaXp = profile.manaXp;

  let action = profile.currentAction;
  let lastRegenUpdate = new Date(profile.lastRegenUpdate);

  if (action) {
    const actionStartTime = new Date(action.startedAt).getTime();
    const actionEndTime = actionStartTime + action.duration * 1000;

    const isActionCompleted = now.getTime() >= actionEndTime - 2000;
    const actionData = (action.data as any) || {};

    if (action.type === ActionType.REST && actionData.isDeathRecovery) {
      if (!isActionCompleted) {
        return await prisma.userProfile.update({
          where: { id: profileId },
          data: { currentHp: 0, currentStamina: 0, currentMana: 0 },
          include: { swordsman: true, mage: true, currentAction: true, party: true },
        });
      }

      await prisma.userAction.delete({ where: { id: action.id } });
      currentHp = 1;
      currentStamina = 0;
      currentMana = 0;
      lastRegenUpdate = new Date(actionEndTime);
      action = null;
    }

    else if (action.type === ActionType.TRAINING) {
      const totalElapsedSeconds = Math.min(
        action.duration,
        Math.max(0, Math.floor((now.getTime() - actionStartTime) / 1000))
      );

      const previouslyProcessed = actionData.processedSeconds || 0;
      const unprocessedSeconds = totalElapsedSeconds - previouslyProcessed;

      if (unprocessedSeconds > 0) {
        const unprocessedMinutes = unprocessedSeconds / 60;
        const totalXpGained = Math.round(unprocessedMinutes * 5);

        const staminaXpGained = Math.floor(totalXpGained * (actionData.swordsmanshipRatio / 100));
        const manaXpGained = Math.floor(totalXpGained * (actionData.magicRatio / 100));

        staminaXp += staminaXpGained;
        manaXp += manaXpGained;
      }

      if (isActionCompleted) {
        await prisma.userAction.delete({ where: { id: action.id } });
        lastRegenUpdate = new Date(actionEndTime);
        action = null;
      } else {
        action = await prisma.userAction.update({
          where: { id: action.id },
          data: {
            data: {
              ...actionData,
              processedSeconds: totalElapsedSeconds,
            },
          },
        });
      }
    }
  }

  const updatedStats = processXPProgression({
    maxHp,
    maxStamina,
    staminaXp,
    maxMana,
    manaXp,
  });

  maxHp = updatedStats.maxHp;
  maxStamina = updatedStats.maxStamina;
  staminaXp = updatedStats.staminaXp;
  maxMana = updatedStats.maxMana;
  manaXp = updatedStats.manaXp;

  if (!action) {
    const elapsedSeconds = Math.floor((now.getTime() - lastRegenUpdate.getTime()) / 1000);

    if (elapsedSeconds > 0) {
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);

      if (elapsedMinutes > 0) {
        currentHp = Math.min(maxHp, currentHp + elapsedMinutes * REGEN_HP_PER_MIN);
        currentStamina = Math.min(maxStamina, currentStamina + elapsedMinutes * REGEN_STAMINA_PER_MIN);
        currentMana = Math.min(maxMana, currentMana + elapsedMinutes * REGEN_MANA_PER_MIN);
        lastRegenUpdate = now;
      }
    }
  }

  await prisma.userProfile.update({
    where: { id: profileId },
    data: {
      currentHp,
      maxHp,
      currentStamina,
      maxStamina,
      staminaXp,
      currentMana,
      maxMana,
      manaXp,
      lastRegenUpdate,
    },
  });

  return await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: {
      swordsman: true,
      mage: true,
      currentAction: true,
      party: true,
    },
  });
}