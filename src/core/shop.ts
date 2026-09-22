import { prisma } from '../config/database';
import { getItemDefinition, addCoins, getPlayerCoins } from './inventory';
import { calculateManhattanDistance } from './quest';

export interface ShopSlot {
  slotNumber: number;
  type: 'NPC' | 'PLAYER';
  listingId?: number;
  itemId: string;
  itemName: string;
  price: number;
  amount: number;
  sellerName?: string;
  expiresAt?: Date;
}

export async function getNearestShop(userPosX: number, userPosY: number) {
  const shops = await prisma.shop.findMany({
    include: { city: true },
  });
  if (shops.length === 0) return null;

  let nearestShop = shops[0];
  let minDistance = calculateManhattanDistance(
    { x: userPosX, y: userPosY },
    { x: nearestShop.city.positionX, y: nearestShop.city.positionY }
  );

  for (let i = 1; i < shops.length; i++) {
    const dist = calculateManhattanDistance(
      { x: userPosX, y: userPosY },
      { x: shops[i].city.positionX, y: shops[i].city.positionY }
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearestShop = shops[i];
    }
  }

  return { shop: nearestShop, city: nearestShop.city, distance: minDistance };
}

export async function processExpiredListings() {
  const now = new Date();
  const expiredListings = await prisma.marketplaceListing.findMany({
    where: { expiresAt: { lte: now } },
  });

  for (const listing of expiredListings) {
    const itemDef = getItemDefinition(listing.itemId);

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { profileId: listing.sellerProfileId, slotIndex: { not: null } },
    });

    const usedSlots = new Set(inventoryItems.map((i) => i.slotIndex!));
    let freeSlot = -1;

    for (let i = 0; i < 20; i++) {
      if (!usedSlots.has(i)) {
        freeSlot = i;
        break;
      }
    }

    if (freeSlot !== -1) {
      await prisma.inventoryItem.create({
        data: {
          profileId: listing.sellerProfileId,
          itemId: listing.itemId,
          amount: listing.amount,
          slotIndex: freeSlot,
        },
      });
    } else {
      const fallbackValue = (itemDef?.value || 1) * listing.amount;
      await addCoins(listing.sellerProfileId, fallbackValue);
    }

    await prisma.marketplaceListing.delete({ where: { id: listing.id } });
  }
}

export async function getShopSlots(shopId: number): Promise<ShopSlot[]> {
  await processExpiredListings();

  const npcItems = await prisma.shopItem.findMany({ where: { shopId } });
  const playerListings = await prisma.marketplaceListing.findMany({
    where: { shopId },
    include: { sellerProfile: true },
    orderBy: { createdAt: 'asc' },
  });

  const slots: ShopSlot[] = [];
  let slotIndex = 1;

  for (const item of npcItems) {
    if (slotIndex > 50) break;
    const def = getItemDefinition(item.itemId);
    slots.push({
      slotNumber: slotIndex++,
      type: 'NPC',
      itemId: item.itemId,
      itemName: def?.name || item.itemId,
      price: item.price,
      amount: 1,
    });
  }

  for (const listing of playerListings) {
    if (slotIndex > 50) break;
    const def = getItemDefinition(listing.itemId);
    slots.push({
      slotNumber: slotIndex++,
      type: 'PLAYER',
      listingId: listing.id,
      itemId: listing.itemId,
      itemName: def?.name || listing.itemId,
      price: listing.price,
      amount: listing.amount,
      sellerName: listing.sellerProfile.username,
      expiresAt: listing.expiresAt,
    });
  }

  return slots;
}

export async function listPlayerItem(profile: any, inventorySlotIndex: number, price: number) {
  if (profile.currentAction) {
    return { success: false, message: '❌ You can only sell items while **Idle**!' };
  }

  if (price <= 0) {
    return { success: false, message: '❌ Price must be greater than 0!' };
  }

  const nearest = await getNearestShop(profile.positionX, profile.positionY);
  if (!nearest) return { success: false, message: '❌ No shop available in the world.' };

  const activeListingsCount = await prisma.marketplaceListing.count({
    where: { shopId: nearest.shop.id },
  });

  const npcItemsCount = await prisma.shopItem.count({
    where: { shopId: nearest.shop.id },
  });

  if (npcItemsCount + activeListingsCount >= 50) {
    return { success: false, message: '❌ This shop showcase is full! (Max 50 items displayed).' };
  }

  const invItem = await prisma.inventoryItem.findFirst({
    where: { profileId: profile.id, slotIndex: inventorySlotIndex },
  });

  if (!invItem) return { success: false, message: '❌ No item found in that inventory slot.' };

  const itemDef = getItemDefinition(invItem.itemId);
  if (!itemDef) return { success: false, message: '❌ Item data error.' };

  const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    if (invItem.amount > 1) {
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { amount: invItem.amount - 1 },
      });
    } else {
      await tx.inventoryItem.delete({ where: { id: invItem.id } });
    }

    await tx.marketplaceListing.create({
      data: {
        shopId: nearest.shop.id,
        sellerProfileId: profile.id,
        itemId: invItem.itemId,
        price,
        amount: 1,
        expiresAt,
      },
    });
  });

  return {
    success: true,
    message: `🏪 Listed **1x ${itemDef.name}** for **${price} Millis Silver Coins** at **${nearest.shop.name}**! (Expires in 5 days)`,
  };
}

export async function buyShopItem(profile: any, slotNumber: number) {
  if (profile.currentAction) {
    return { success: false, message: '❌ You can only buy items while **Idle**!' };
  }

  const nearest = await getNearestShop(profile.positionX, profile.positionY);
  if (!nearest) return { success: false, message: '❌ No shop available in the world.' };

  const slots = await getShopSlots(nearest.shop.id);
  const targetSlot = slots.find((s) => s.slotNumber === slotNumber);

  if (!targetSlot) return { success: false, message: '❌ Invalid slot number.' };

  const userCoins = await getPlayerCoins(profile.id);
  if (userCoins < targetSlot.price) {
    return { success: false, message: `❌ You need **${targetSlot.price} Millis Silver Coins** (You have ${userCoins}).` };
  }

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { profileId: profile.id, slotIndex: { not: null } },
  });

  const usedSlots = new Set(inventoryItems.map((i) => i.slotIndex!));
  let freeSlot = -1;
  for (let i = 0; i < 20; i++) {
    if (!usedSlots.has(i)) {
      freeSlot = i;
      break;
    }
  }

  if (freeSlot === -1) {
    return { success: false, message: '❌ Your inventory is full! Make space before buying.' };
  }

  await prisma.$transaction(async (tx) => {
    const coin = await tx.inventoryItem.findFirst({
      where: { profileId: profile.id, itemId: 'millis_silver_coins' },
    });

    await tx.inventoryItem.update({
      where: { id: coin!.id },
      data: { amount: coin!.amount - targetSlot.price },
    });

    if (targetSlot.type === 'PLAYER' && targetSlot.listingId) {
      const listing = await tx.marketplaceListing.findUnique({
        where: { id: targetSlot.listingId },
      });

      if (listing) {
        const sellerCoin = await tx.inventoryItem.findFirst({
          where: { profileId: listing.sellerProfileId, itemId: 'millis_silver_coins' },
        });

        if (sellerCoin) {
          await tx.inventoryItem.update({
            where: { id: sellerCoin.id },
            data: { amount: sellerCoin.amount + targetSlot.price },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              profileId: listing.sellerProfileId,
              itemId: 'millis_silver_coins',
              amount: targetSlot.price,
              slotIndex: null,
            },
          });
        }

        await tx.marketplaceListing.delete({ where: { id: targetSlot.listingId } });
      }
    }

    await tx.inventoryItem.create({
      data: {
        profileId: profile.id,
        itemId: targetSlot.itemId,
        amount: 1,
        slotIndex: freeSlot,
      },
    });
  });

  return {
    success: true,
    message: `🛍️ Purchased **${targetSlot.itemName}** for **${targetSlot.price} Millis Silver Coins**!`,
  };
}