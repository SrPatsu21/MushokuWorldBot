import { UnifiedContext } from '../core/types';
import { getOrCreateProfile } from '../core/profile';

function parseMentionId(arg: string): string | null {
  if (!arg) return null;
  const match = arg.match(/^<@!?([A-Za-z0-9_-]+)>$/);
  return match ? match[1] : null;
}

export async function handleProfile(ctx: UnifiedContext, args: string[]) {
  try {
    let targetUserId = ctx.authorId;
    let targetUsername = ctx.authorName;
    let scope = '0';

    for (const arg of args) {
      const lowerArg = arg.toLowerCase();
      
      if (lowerArg === 'server') {
        scope = ctx.serverId;
      } else {
        const mentionedId = parseMentionId(arg);
        if (mentionedId) {
          targetUserId = mentionedId;
          targetUsername = arg;
        }
      }
    }

    const profileTypeLabel = scope === '0' ? 'Global' : 'Server';

    const profile = await getOrCreateProfile(
      ctx.platform,
      targetUserId,
      targetUsername,
      scope
    );

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
    console.error('Error to process profile command:', error);
    await ctx.reply('❌ An error occurred while loading the profile.');
  }
}