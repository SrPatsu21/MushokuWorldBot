import { UnifiedContext } from '../core/types';
import { getServerPrefix } from '../config/database';

export async function handleHelp(ctx: UnifiedContext) {
  const prefix = await getServerPrefix(ctx.serverId);

  const response = [
    `📜 **Help Center - Mushoku World Bot**`,
    ``,
    `**👤 Profile & Utility**`,
    `• \`${prefix}profile [@user] [server]\` - Show your profile, vital stats, active actions, and status.`,
    `• \`${prefix}link [confirm | unlink]\` - Safely connect or disconnect your Discord and Stoat/Revolt accounts.`,
    `• \`${prefix}setprefix <new prefix>\` - Change commands prefix for this server.`,
    ``,
    `**🏋️ Progression & Actions**`,
    `• \`${prefix}train <swordsmanship 0-100> <magic 0-100> <duration_min>\` - Train to earn Stamina/Mana XP. Every 1000 XP automatically increases your Max Stats!`,
    ``,
    `**👥 Party System**`,
    `• \`${prefix}party create <name>\` - Create a new party.`,
    `• \`${prefix}party invite <@user>\` - Invite a player (Leader only).`,
    `• \`${prefix}party kick <@user>\` - Kick a member (Leader only).`,
    `• \`${prefix}party leave\` - Leave your current party (Disbands if Leader).`,
    `• \`${prefix}party role <add/remove> <@user> <role>\` - Manage member roles (Leader only).`,
    `• \`${prefix}party transfer <@user>\` - Pass leader rights (Leader only).`,
    `• \`${prefix}party info\` - Show details about your party.`,
    ``,
    `**📜 Quests & Quest Boards**`,
    `• \`${prefix}quest board [page]\` - View available quests on a Quest Board.`,
    `• \`${prefix}party acceptquest <quest_id>\` - Accept an available quest for your party (Leader only).`,
    ``,
    `💡 *Note: If a quest fails and your character dies, you will be locked in recovery for 12 hours before reviving with 1 HP.*`,
  ].join('\n');

  await ctx.reply(response);
}