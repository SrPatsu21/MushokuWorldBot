import { UnifiedContext } from '../core/types';
import { getServerPrefix } from '../config/database';

export async function handleHelp(ctx: UnifiedContext) {
  const prefix = await getServerPrefix(ctx.serverId);

  const response = [
    `📜 **Help Center - Mushoku World Bot**`,
    ``,
    `• \`${prefix}help\` - Show command list.`,
    `• \`${prefix}profile [@user] [server]\` - Show your profile or another user's info.`,
    `• \`${prefix}setprefix <new prefix>\` - Change commands prefix for this server.`,
  ].join('\n');

  await ctx.reply(response);
}