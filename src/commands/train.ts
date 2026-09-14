import { UnifiedContext } from '../core/types';
import { getProfileOnly } from '../core/profile';
import { prisma } from '../config/database';
import { ActionType } from '@prisma/client';

export async function handleTrain(ctx: UnifiedContext, args: string[]) {
  try {
    if (args.length < 3) {
      return await ctx.reply(
        '⚠️ **Usage:** `!train <swordsmanship 0-100> <magic 0-100> <duration_minutes> [server]`\n*Example:* `!train 60 40 30`'
      );
    }

    const isServerScope = args.some((arg) => arg.toLowerCase() === 'server');
    const scope = isServerScope ? ctx.serverId : '0';

    const cleanArgs = args.filter((arg) => arg.toLowerCase() !== 'server');

    if (cleanArgs.length < 3) {
      return await ctx.reply(
        '⚠️ **Usage:** `!train <swordsmanship 0-100> <magic 0-100> <duration_minutes>`\n*Example:* `!train 60 40 30`'
      );
    }

    const swordRatio = parseInt(cleanArgs[0], 10);
    const magicRatio = parseInt(cleanArgs[1], 10);
    const durationMinutes = parseInt(cleanArgs[2], 10);

    if (isNaN(swordRatio) || isNaN(magicRatio) || isNaN(durationMinutes)) {
      return await ctx.reply('❌ All arguments must be valid numbers!');
    }

    if (swordRatio < 0 || magicRatio < 0 || swordRatio + magicRatio !== 100) {
      return await ctx.reply('❌ The sum of Swordsmanship and Magic distribution must equal **100**!');
    }

    if (durationMinutes < 1 || durationMinutes > 480) {
      return await ctx.reply('❌ Training duration must be between **1 minute and 8 hours (480 min)**.');
    }

    const profile = await getProfileOnly(
      ctx.platform,
      ctx.authorId,
      scope
    );

    if (!profile) {
      return await ctx.reply(
        '❌ You do not have a profile yet! Run `!profile` first to create one.'
      );
    }

    if (profile.currentAction) {
      const action = profile.currentAction;
      const actionData = (action.data as any) || {};

      if (action.type === ActionType.REST && actionData.isDeathRecovery) {
        const endsAt = new Date(action.startedAt).getTime() + action.duration * 1000;
        const remainingMinutes = Math.ceil(Math.max(0, endsAt - Date.now()) / 60000);

        return await ctx.reply(
          `💀 **You are DEAD/In Recovery!** You cannot train right now.\n` +
          `⏳ Revival in approximately **${remainingMinutes} minutes**.`
        );
      }

      return await ctx.reply(
        `❌ You are already performing an action (**${action.type}**)!`
      );
    }

    const requiredStamina = Math.floor(durationMinutes * 3 * (swordRatio / 100));
    const requiredMana = Math.floor(durationMinutes * 3 * (magicRatio / 100));

    if (profile.currentStamina < requiredStamina || profile.currentMana < requiredMana) {
      return await ctx.reply(
        `❌ You don't have enough resources to train for ${durationMinutes} minutes!\n` +
        `**Required:** ${requiredStamina} Stamina / ${requiredMana} Mana\n` +
        `**Current:** ${profile.currentStamina} Stamina / ${profile.currentMana} Mana`
      );
    }

    await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        currentStamina: profile.currentStamina - requiredStamina,
        currentMana: profile.currentMana - requiredMana,
      },
    });

    await prisma.userAction.create({
      data: {
        profileId: profile.id,
        type: ActionType.TRAINING,
        duration: durationMinutes * 60,
        startedAt: new Date(),
        data: {
          swordsmanshipRatio: swordRatio,
          magicRatio,
          processedSeconds: 0,
        },
      },
    });

    await ctx.reply(
      `🏋️ **Training Started!**\n` +
      `• **Distribution:** ${swordRatio}% Swordsmanship / ${magicRatio}% Magic\n` +
      `• **Duration:** ${durationMinutes} minutes`
    );
  } catch (error) {
    console.error('Error in train command:', error);
    await ctx.reply('❌ An error occurred while starting training.');
  }
}