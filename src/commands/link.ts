import { UnifiedContext } from '../core/types';
import { createLinkToken, confirmLinkToken, unlinkAccount } from '../core/linkAccount';

export async function handleLink(ctx: UnifiedContext, args: string[]) {
  try {
    const subCommand = args[0]?.toLowerCase();
    const tokenInput = args[1]?.trim();

    // 1. Unlink (!link unlink)
    if (subCommand === 'unlink') {
      const result = await unlinkAccount(ctx.platform, ctx.authorId);
      await ctx.reply(`${ctx.mentionAuthor()} ${result.message}`);
      return;
    }

    // 2. Confirm (!link confirm 123456)
    if (subCommand === 'confirm') {
      if (!tokenInput || !/^\d{6}$/.test(tokenInput)) {
        await ctx.reply(
          `${ctx.mentionAuthor()} ⚠️ Please provide a valid 6-digit code.\n` +
          `Example: \`link confirm 849201\``
        );
        return;
      }

      const result = await confirmLinkToken(
        ctx.platform,
        ctx.authorId,
        ctx.authorName,
        tokenInput
      );
      await ctx.reply(`${ctx.mentionAuthor()} ${result.message}`);
      return;
    }

    // 3. Create Link Token (!link)
    const targetPlatform = ctx.platform === 'discord' ? 'Revolt/Stoat' : 'Discord';
    const { otp, expiresInMinutes } = createLinkToken(
      ctx.platform,
      ctx.authorId,
      ctx.authorName
    );

    const dmMessage = 
      `🔑 **Account Linking Request**\n\n` +
      `Your verification code is: **\`${otp}\`**\n` +
      `This code is valid for **${expiresInMinutes} minutes**.\n\n` +
      `To complete the linking, switch to **${targetPlatform}** and run:\n` +
      `\`link confirm ${otp}\``;

    let sentViaDM = false;

    if (typeof ctx.sendDM === 'function') {
      try {
        await ctx.sendDM(dmMessage);
        sentViaDM = true;
      } catch (err) {
        console.error('Failed to send Direct Message:', err);
        sentViaDM = false;
      }
    }

    if (sentViaDM) {
      await ctx.reply(
        `${ctx.mentionAuthor()} 📩 A 6-digit verification code has been sent to your **Direct Messages**!\n` +
        `Check your DMs and follow the instructions to complete linking on **${targetPlatform}**.`
      );
    } else {
      await ctx.reply(
        `${ctx.mentionAuthor()} ❌ Could not send a Direct Message to you.\n` +
        `Please make sure your DMs are enabled and try again.`
      );
    }
  } catch (error) {
    console.error('Error handling link command:', error);
    await ctx.reply('❌ An error occurred while processing the account link request.');
  }
}