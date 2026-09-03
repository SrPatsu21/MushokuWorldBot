import { UnifiedContext } from '../core/types';
import { setServerPrefix } from '../config/database';

export async function handleSetPrefix(ctx: UnifiedContext, args: string[]) {
  const isAdmin = await ctx.hasAdminPermission();
  if (!isAdmin) {
    await ctx.reply(`${ctx.mentionAuthor()} ❌ You need administrator permissions to use this command.`);
    return;
  }

  const newPrefix = args[0];

  if (!newPrefix) {
    await ctx.reply(`${ctx.mentionAuthor()} ⚠️ Please provide a new prefix. Example: \`setprefix ?\``);
    return;
  }

  if (newPrefix.length > 3) {
    await ctx.reply(`${ctx.mentionAuthor()} ⚠️ The prefix must be at most 3 characters long.`);
    return;
  }

  await setServerPrefix(ctx.serverId, newPrefix);
  await ctx.reply(`${ctx.mentionAuthor()} ✅ Server prefix successfully set to: \`${newPrefix}\``);
}