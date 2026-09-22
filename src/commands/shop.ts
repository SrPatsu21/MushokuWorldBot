import { UnifiedContext } from '../core/types';
import { getProfileOnly } from '../core/profile';
import { getNearestShop, getShopSlots, buyShopItem, listPlayerItem } from '../core/shop';
import { getServerPrefix } from '../config/database';

export async function handleShop(ctx: UnifiedContext, args: string[]) {
  try {
    const scope = args.some((a) => a.toLowerCase() === 'server') ? ctx.serverId : '0';
    const profile = await getProfileOnly(ctx.platform, ctx.authorId, scope);

    if (!profile) {
      return await ctx.reply('❌ You do not have a profile created yet!');
    }

    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'buy':
        return await handleBuy(ctx, profile, args[1]);
      case 'sell':
        return await handleSell(ctx, profile, args[1], args[2]);
      default:
        return await showShop(ctx, profile);
    }
  } catch (error) {
    console.error('Error in shop command:', error);
    await ctx.reply('❌ An error occurred in the shop system.');
  }
}

async function showShop(ctx: UnifiedContext, profile: any) {
  const nearest = await getNearestShop(profile.positionX, profile.positionY);

  if (!nearest) {
    return await ctx.reply('🛖 No shops found in the world.');
  }

  const slots = await getShopSlots(nearest.shop.id);
  const prefix = await getServerPrefix(ctx.serverId);

  // Acessa as posições X e Y diretamente da cidade (nearest.city)
  let message = `🏪 **${nearest.shop.name}** \`(X: ${nearest.city.positionX}, Y:${nearest.city.positionY})\`\n`;
  message += `📍 Distance from you: \`${nearest.distance} blocks\`\n\n`;
  message += `📦 **Showcase (Max 50 slots):**\n`;

  for (let i = 1; i <= 50; i++) {
    const slot = slots.find((s) => s.slotNumber === i);
    if (slot) {
      const tag = slot.type === 'NPC' ? '🏛️ [NPC]' : `👤 [${slot.sellerName}]`;
      message += `\`[Slot ${i}]\` ${tag} **${slot.itemName}** - 🪙 \`${slot.price} Coins\`\n`;
    } else {
      message += `\`[Slot ${i}]\` *Empty Slot*\n`;
    }
  }

  message += `\n💡 **Usage:**\n`;
  message += `• \`${prefix}shop buy <slot_num>\` - Buy an item from the shop.\n`;
  message += `• \`${prefix}shop sell <inv_slot_num> <price>\` - List an item from your inventory to sell to players.`;

  return await ctx.reply(message);
}

async function handleBuy(ctx: UnifiedContext, profile: any, slotArg: string) {
  const slotNum = parseInt(slotArg, 10);
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 50) {
    return await ctx.reply('❌ Usage: `!shop buy <1-50>`');
  }

  const res = await buyShopItem(profile, slotNum);
  return await ctx.reply(res.message);
}

async function handleSell(ctx: UnifiedContext, profile: any, invSlotArg: string, priceArg: string) {
  const invSlot = parseInt(invSlotArg, 10);
  const price = parseInt(priceArg, 10);

  if (isNaN(invSlot) || isNaN(price) || invSlot < 1 || invSlot > 20 || price <= 0) {
    return await ctx.reply('❌ Usage: `!shop sell <inv_slot_1-20> <price_in_coins>`');
  }

  const res = await listPlayerItem(profile, invSlot - 1, price);
  return await ctx.reply(res.message);
}