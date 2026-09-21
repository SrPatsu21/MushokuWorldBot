import { UnifiedContext } from '../core/types';
import { getProfileOnly } from '../core/profile';
import { prisma, getServerPrefix } from '../config/database';
import {
  getItemDefinition,
  getPlayerCoins,
  equipItem,
  unequipItem,
  sellItem,
} from '../core/inventory';

export async function handleInventory(ctx: UnifiedContext, args: string[]) {
  try {
    const scope = args.some((a) => a.toLowerCase() === 'server') ? ctx.serverId : '0';
    const profile = await getProfileOnly(ctx.platform, ctx.authorId, scope);

    if (!profile) {
      return await ctx.reply('❌ You do not have a profile yet!');
    }

    const subCommand = args[0]?.toLowerCase();
    const prefix = await getServerPrefix(ctx.serverId);

    switch (subCommand) {
      case 'equip':
        return await handleEquip(ctx, profile, args[1], args[2]);
      case 'unequip':
        return await handleUnequip(ctx, profile, args[1]);
      case 'sell':
        return await handleSell(ctx, profile, args[1]);
      default:
        return await showInventory(ctx, profile);
    }
  } catch (error) {
    console.error('Error in inventory command:', error);
    await ctx.reply('❌ An error occurred in the inventory system.');
  }
}

async function showInventory(ctx: UnifiedContext, profile: any) {
  const coins = await getPlayerCoins(profile.id);
  const items = await prisma.inventoryItem.findMany({
    where: { profileId: profile.id, slotIndex: { not: null } },
    orderBy: { slotIndex: 'asc' },
  });

  let message = `🎒 **Inventory of ${profile.username}**\n`;
  message += `🪙 **Coins:** \`${coins} Millis Silver Coins\`\n\n`;

  message += `📦 **Bag Slots (20 Max):**\n`;

  const itemMap = new Map(items.map((i) => [i.slotIndex, i]));

  for (let i = 0; i < 20; i++) {
    const item = itemMap.get(i);
    if (item) {
      const def = getItemDefinition(item.itemId);
      const name = def ? def.name : item.itemId;
      const qty = item.amount > 1 ? ` (x${item.amount})` : '';
      message += `\`[Slot ${i + 1}]\` **${name}**${qty} - Value:${def?.value || 0}c\n`;
    } else {
      message += `\`[Slot ${i + 1}]\` *Empty*\n`;
    }
  }

  const prefix = await getServerPrefix(ctx.serverId);
  message += `\n💡 **Usage:**\n`;
  message += `• \`${prefix}inv equip <slot_num> <target_slot>\` (e.g. \`${prefix}inv equip 1 righthand\`)\n`;
  message += `• \`${prefix}inv unequip <target_slot>\` (e.g. \`${prefix}inv unequip clothing\`)\n`;
  message += `• \`${prefix}inv sell <slot_num>\``;

  return await ctx.reply(message);
}

async function handleEquip(ctx: UnifiedContext, profile: any, slotArg: string, targetSlot: string) {
  const slotNum = parseInt(slotArg, 10);
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 20 || !targetSlot) {
    return await ctx.reply('❌ Usage: `!inv equip <1-20> <clothing|boots|gloves|righthand|lefthand|talisman1..4>`');
  }

  const res = await equipItem(profile, slotNum - 1, targetSlot);
  return await ctx.reply(res.message);
}

async function handleUnequip(ctx: UnifiedContext, profile: any, targetSlot: string) {
  if (!targetSlot) {
    return await ctx.reply('❌ Usage: `!inv unequip <clothing|boots|gloves|righthand|lefthand|talisman1..4>`');
  }

  const res = await unequipItem(profile, targetSlot);
  return await ctx.reply(res.message);
}

async function handleSell(ctx: UnifiedContext, profile: any, slotArg: string) {
  const slotNum = parseInt(slotArg, 10);
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 20) {
    return await ctx.reply('❌ Usage: `!inv sell <1-20>`');
  }

  const res = await sellItem(profile, slotNum - 1);
  return await ctx.reply(res.message);
}