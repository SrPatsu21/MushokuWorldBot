import { UnifiedContext } from '../core/types';
import { setServerPrefix } from '../config/database';

export async function handleSetPrefix(ctx: UnifiedContext, args: string[]) {
  const newPrefix = args[0];

  if (!newPrefix) {
    await ctx.reply('⚠️ please, use the right command !setprefix <new prefix>. Example: `!setprefix ?`');
    return;
  }

  if (newPrefix.length > 3) {
    await ctx.reply('⚠️ The prefix must have at most 3 characters.');
    return;
  }

  await setServerPrefix(ctx.serverId, newPrefix);
  await ctx.reply(`✅ Server prefix set to: \`${newPrefix}\``);
}