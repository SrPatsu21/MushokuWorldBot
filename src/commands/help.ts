import { UnifiedContext } from '../core/types';
import { getServerPrefix } from '../config/database';

export async function handleHelp(ctx: UnifiedContext, args: string[]) {
  const prefix = await getServerPrefix(ctx.serverId);

  const page = parseInt(args[0], 10) || 1;

  if (page === 2) {
    const part2 = [
      `📜 **Help Center - Mushoku World Bot** (Page 2/2)`,
      ``,
      `**🏪 Marketplace & Shop**`,
      `• \`${prefix}shop\` - Access the nearest shop (NPC stock & Player listings, max 50 items).`,
      `• \`${prefix}shop buy <slot_1-50>\` - Buy an item from the shop showcase.`,
      `• \`${prefix}shop sell <inv_slot_1-20> <price>\` - Post an item for sale to other players for 5 days.`,
      ``,
      `**🏋️ Progression & Actions**`,
      `• \`${prefix}train <swordsmanship 0-100> <magic 0-100> <duration_min>\` - Train to earn Stamina/Mana XP. Every 1000 XP increases your Max Stats!`,
      ``,
      `**👥 Party System**`,
      `• \`${prefix}party create <name>\` - Create a new party.`,
      `• \`${prefix}party invite <@user>\` - Invite a player to your party (Leader only).`,
      `• \`${prefix}party kick <@user>\` - Kick a member (Leader only).`,
      `• \`${prefix}party leave\` - Leave current party (Disbands if Leader).`,
      `• \`${prefix}party role <add/remove> <@user> <role>\` - Manage member roles (Leader only).`,
      `• \`${prefix}party transfer <@user>\` - Transfer leadership (Leader only).`,
      `• \`${prefix}party info\` - Display detailed party status.`,
      ``,
      `**📜 Quests & Quest Boards**`,
      `• \`${prefix}quest board [page]\` - View available quests at the nearest board.`,
      `• \`${prefix}party acceptquest <quest_id>\` - Accept a board quest for your party (Leader only).`,
      ``,
      `💡 *Use \`${prefix}help 1\` to view the first page.*`,
    ].join('\n');

    return await ctx.reply(part2);
  }

  const part1 = [
    `📜 **Help Center - Mushoku World Bot** (Page 1/2)`,
    ``,
    `**👤 Profile & Configuration**`,
    `• \`${prefix}profile [@user] [server]\` - View profile, stats, equipped gear, and current status.`,
    `• \`${prefix}link [confirm | unlink]\` - Connect or disconnect Discord and Revolt accounts.`,
    `• \`${prefix}setprefix <new_prefix>\` - Change the bot command prefix for this server.`,
    ``,
    `**🎒 Inventory & Equipment**`,
    `• \`${prefix}inv\` - Open your 20-slot inventory and check your coins.`,
    `• \`${prefix}inv equip <inv_slot> <target_slot>\` - Equip an item (clothing, boots, gloves, righthand, lefthand, talisman1..4).`,
    `• \`${prefix}inv unequip <target_slot>\` - Unequip an item back to your inventory.`,
    `• \`${prefix}inv sell <inv_slot>\` - Instantly sell an item for its base coin value.`,
    ``,
    `**🗺️ Navigation & Travel**`,
    `• \`${prefix}travel\` - List nearby known cities and destinations.`,
    `• \`${prefix}travel <name_or_kingdom>\` - Search cities by name or kingdom.`,
    `• \`${prefix}travel to <city_id>\` - Travel to a city (Movement speed: 6 blocks/hour).`,
    ``,
    `💡 *Use \`${prefix}help 2\` to view the second page.*`,
  ].join('\n');

  return await ctx.reply(part1);
}