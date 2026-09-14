import { UnifiedContext } from '../core/types';
import { getOrCreateProfile, getProfileOnly } from '../core/profile';

function parseMentionId(arg: string): string | null {
  if (!arg) return null;
  const match = arg.trim().match(/^<@!?([A-Za-z0-9]+)>$/);
  return match ? match[1] : null;
}

export async function handleProfile(ctx: UnifiedContext, args: string[]) {
  try {
    let targetUserId = ctx.authorId;
    let targetUsername = ctx.authorName;
    let scope = '0';
    let isMentioned = false;

    for (const arg of args) {
      const lowerArg = arg.toLowerCase();

      if (lowerArg === 'server') {
        scope = ctx.serverId;
        continue;
      }

      const mentionedId = parseMentionId(arg);
      if (mentionedId) {
        targetUserId = mentionedId;
        isMentioned = true;

        const mentionedUserInCtx = ctx.mentions?.find((m: any) => m.id === mentionedId);
        if (mentionedUserInCtx?.username) {
          targetUsername = mentionedUserInCtx.username;
        } else {
          targetUsername = `User (${mentionedId.slice(-4)})`;
        }
      }
    }

    const profileTypeLabel = scope === '0' ? 'Global' : 'Server';
    let profile;

    if (isMentioned) {
      profile = await getProfileOnly(ctx.platform, targetUserId, scope);

      if (!profile) {
        return await ctx.reply(
          `❌ The user <@${targetUserId}> does not have a profile created yet!`
        );
      }
    } else {
      profile = await getOrCreateProfile(
        ctx.platform,
        targetUserId,
        targetUsername,
        scope
      );
    }

    const sw = profile.swordsman;
    const mg = profile.mage;

    let response = `📜 **Profile of ${profile.username} (${profileTypeLabel})**\n\n`;

    // Status Vitais
    response += `❤️ **HP:** \`${profile.currentHp}/${profile.maxHp}\`\n`;
    response += `⚡ **Stamina:** \`${profile.currentStamina}/${profile.maxStamina}\` *(XP: ${profile.staminaXp})*\n`;
    response += `🧪 **Mana:** \`${profile.currentMana}/${profile.maxMana}\` *(XP: ${profile.manaXp})*\n\n`;

    // Aventureiro & Party
    const partyName = profile.party ? profile.party.name : 'None';
    response += `🛡️ **Adventurer Rank:** \`${profile.adventurerRank}\`\n`;
    response += `👥 **Party:** \`${partyName}\`\n\n`;

    if (profile.currentAction) {
      const action = profile.currentAction;
      const actionData = (action.data as any) || {};

      const endsAt = new Date(action.startedAt).getTime() + action.duration * 1000;
      const remainingMinutes = Math.max(1, Math.ceil((endsAt - Date.now()) / 60000));

      if (action.type === 'REST' && actionData.isDeathRecovery) {
        response += `💀 **Status:** **DEAD** (Revives in ${remainingMinutes} min)\n\n`;
      } else {
        response += `⏳ **Active Action:** \`${action.type}\` (${remainingMinutes} min remaining)\n\n`;
      }
    } else {
      response += `🟢 **Status:** Idle / Ready for action\n\n`;
    }

    // Classes & Ranks
    response += `⚔️ **Swordsmanship:**\n`;
    response += `• Sword God: \`${sw?.swordGod || 'NONE'}\`\n`;
    response += `• North God: \`${sw?.northGod || 'NONE'}\`\n`;
    response += `• Water God: \`${sw?.waterGod || 'NONE'}\`\n\n`;

    response += `🪄 **Magic:**\n`;
    response += `• Fire: \`${mg?.fire || 'NONE'}\` | Water: \`${mg?.water || 'NONE'}\`\n`;
    response += `• Wind: \`${mg?.wind || 'NONE'}\` | Earth: \`${mg?.earth || 'NONE'}\`\n`;
    response += `• Healing: \`${mg?.healing || 'NONE'}\` | Detox: \`${mg?.detoxification || 'NONE'}\`\n`;
    response += `• Protection: \`${mg?.protection || 'NONE'}\` | Summoning: \`${mg?.summoning || 'NONE'}\`\n`;

    await ctx.reply(response);
  } catch (error) {
    console.error('Error processing profile command:', error);
    await ctx.reply('❌ An error occurred while loading the profile.');
  }
}