import { UnifiedContext } from '../core/types';
import { getOrCreateProfile, getProfileOnly } from '../core/profile';

/**
 * Clean and extract User ID from mention patterns:
 * - Discord: <@123456789>, <@!123456789>
 * - Revolt: <@01M08VFPC6ZQ0Z8NSVJK39RYRJ>
 */
function parseMentionId(arg: string): string | null {
  if (!arg) return null;
  // Matches any mention starting with <@ or <@! and ending with >
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

        // Try to retrieve the mentioned user's name from context mentions
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
      // ONLY fetch profile when mentioning another user, DO NOT create one
      profile = await getProfileOnly(ctx.platform, targetUserId, scope);

      if (!profile) {
        return await ctx.reply(
          `❌ The user <@${targetUserId}> does not have a profile created yet!`
        );
      }
    } else {
      // Fetch or create profile for the command author
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