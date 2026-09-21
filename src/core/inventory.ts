import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';

export interface ItemStats {
  attack?: number;
  magicAttack?: number;
  defense?: number;
  magicDefense?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: 'WEAPON' | 'ARMOR' | 'TALISMAN' | 'CURRENCY' | 'MISC';
  slotType?: 'CLOTHING' | 'BOOTS' | 'GLOVES' | 'HAND' | 'TALISMAN';
  value: number;
  stats?: ItemStats;
}

const ITEMS_PATH = path.join(__dirname, '../data/items.json');
let itemsCache: Map<string, ItemDefinition> | null = null;

export function getItemDefinition(itemId: string): ItemDefinition | undefined {
  if (!itemsCache) {
    const fileData = fs.readFileSync(ITEMS_PATH, 'utf-8');
    const itemsList: ItemDefinition[] = JSON.parse(fileData);
    itemsCache = new Map(itemsList.map((item) => [item.id, item]));
  }
  return itemsCache.get(itemId);
}

export async function getPlayerCoins(profileId: number): Promise<number> {
  const coinRecord = await prisma.inventoryItem.findFirst({
    where: { profileId, itemId: 'millis_silver_coins' },
  });
  return coinRecord?.amount || 0;
}

export async function addCoins(profileId: number, amount: number) {
  const coinRecord = await prisma.inventoryItem.findFirst({
    where: { profileId, itemId: 'millis_silver_coins' },
  });

  if (coinRecord) {
    return await prisma.inventoryItem.update({
      where: { id: coinRecord.id },
      data: { amount: coinRecord.amount + amount },
    });
  } else {
    return await prisma.inventoryItem.create({
      data: {
        profileId,
        itemId: 'millis_silver_coins',
        amount,
        slotIndex: null,
      },
    });
  }
}

export function calculateEquipmentStats(profile: any): ItemStats {
  const total: Required<ItemStats> = { attack: 0, magicAttack: 0, defense: 0, magicDefense: 0 };
  const equippedIds = [
    profile.clothingItemId,
    profile.bootsItemId,
    profile.glovesItemId,
    profile.rightHandItemId,
    profile.leftHandItemId,
    profile.talisman1ItemId,
    profile.talisman2ItemId,
    profile.talisman3ItemId,
    profile.talisman4ItemId,
  ].filter(Boolean);

  for (const id of equippedIds) {
    const def = getItemDefinition(id);
    if (def?.stats) {
      total.attack += def.stats.attack || 0;
      total.magicAttack += def.stats.magicAttack || 0;
      total.defense += def.stats.defense || 0;
      total.magicDefense += def.stats.magicDefense || 0;
    }
  }

  return total;
}

export async function equipItem(profile: any, inventorySlotIndex: number, targetSlot: string) {
  if (profile.currentAction) {
    return { success: false, message: '❌ You can only equip/unequip items while **Idle**!' };
  }

  const invItem = await prisma.inventoryItem.findFirst({
    where: { profileId: profile.id, slotIndex: inventorySlotIndex },
  });

  if (!invItem) return { success: false, message: '❌ No item found in that inventory slot.' };

  const itemDef = getItemDefinition(invItem.itemId);
  if (!itemDef) return { success: false, message: '❌ Item data not found.' };

  // Mapeamento e validação de slots
  const slotMap: Record<string, { field: string; allowed: string }> = {
    clothing: { field: 'clothingItemId', allowed: 'CLOTHING' },
    boots: { field: 'bootsItemId', allowed: 'BOOTS' },
    gloves: { field: 'glovesItemId', allowed: 'GLOVES' },
    righthand: { field: 'rightHandItemId', allowed: 'HAND' },
    lefthand: { field: 'leftHandItemId', allowed: 'HAND' },
    talisman1: { field: 'talisman1ItemId', allowed: 'TALISMAN' },
    talisman2: { field: 'talisman2ItemId', allowed: 'TALISMAN' },
    talisman3: { field: 'talisman3ItemId', allowed: 'TALISMAN' },
    talisman4: { field: 'talisman4ItemId', allowed: 'TALISMAN' },
  };

  const target = slotMap[targetSlot.toLowerCase()];
  if (!target) return { success: false, message: '❌ Invalid target slot.' };

  if (itemDef.slotType !== target.allowed) {
    return { success: false, message: `❌ **${itemDef.name}** cannot be equipped in slot \`${targetSlot}\`.` };
  }

  const currentEquippedId = profile[target.field];

  // Troca o item equipado pelo do inventário
  await prisma.$transaction(async (tx) => {
    // Atualiza o perfil com o novo item
    await tx.userProfile.update({
      where: { id: profile.id },
      data: { [target.field]: itemDef.id },
    });

    if (currentEquippedId) {
      // Devolve o item que estava equipado para o slot de inventário
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { itemId: currentEquippedId, amount: 1 },
      });
    } else {
      // Se a quantidade for > 1, decrementa; se for 1, remove o slot
      if (invItem.amount > 1) {
        await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { amount: invItem.amount - 1 },
        });
      } else {
        await tx.inventoryItem.delete({ where: { id: invItem.id } });
      }
    }
  });

  return { success: true, message: `✅ Successfully equipped **${itemDef.name}** in \`${targetSlot}\`!` };
}

export async function unequipItem(profile: any, targetSlot: string) {
  if (profile.currentAction) {
    return { success: false, message: '❌ You can only unequip items while **Idle**!' };
  }

  const slotMap: Record<string, string> = {
    clothing: 'clothingItemId',
    boots: 'bootsItemId',
    gloves: 'glovesItemId',
    righthand: 'rightHandItemId',
    lefthand: 'leftHandItemId',
    talisman1: 'talisman1ItemId',
    talisman2: 'talisman2ItemId',
    talisman3: 'talisman3ItemId',
    talisman4: 'talisman4ItemId',
  };

  const field = slotMap[targetSlot.toLowerCase()];
  if (!field) return { success: false, message: '❌ Invalid slot name.' };

  const equippedId = profile[field];
  if (!equippedId) return { success: false, message: `❌ No item equipped in slot \`${targetSlot}\`.` };

  // Procura o primeiro slot de inventário livre (0-19)
  const existingItems = await prisma.inventoryItem.findMany({
    where: { profileId: profile.id, slotIndex: { not: null } },
  });

  const usedSlots = new Set(existingItems.map((i) => i.slotIndex!));
  let freeSlotIndex = -1;
  for (let i = 0; i < 20; i++) {
    if (!usedSlots.has(i)) {
      freeSlotIndex = i;
      break;
    }
  }

  if (freeSlotIndex === -1) {
    return { success: false, message: '❌ Inventory is full! (Max 20 slots).' };
  }

  const itemDef = getItemDefinition(equippedId);

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: profile.id },
      data: { [field]: null },
    }),
    prisma.inventoryItem.create({
      data: {
        profileId: profile.id,
        itemId: equippedId,
        amount: 1,
        slotIndex: freeSlotIndex,
      },
    }),
  ]);

  return { success: true, message: `📦 Unequipped **${itemDef?.name || equippedId}** to inventory slot #${freeSlotIndex + 1}.` };
}

export async function sellItem(profile: any, inventorySlotIndex: number) {
  if (profile.currentAction) {
    return { success: false, message: '❌ You can only sell items while **Idle**!' };
  }

  const invItem = await prisma.inventoryItem.findFirst({
    where: { profileId: profile.id, slotIndex: inventorySlotIndex },
  });

  if (!invItem) return { success: false, message: '❌ No item found in that inventory slot.' };

  const itemDef = getItemDefinition(invItem.itemId);
  if (!itemDef) return { success: false, message: '❌ Item definition error.' };

  const sellPrice = itemDef.value || 0;

  await prisma.$transaction(async (tx) => {
    if (invItem.amount > 1) {
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { amount: invItem.amount - 1 },
      });
    } else {
      await tx.inventoryItem.delete({ where: { id: invItem.id } });
    }

    // Adiciona moedas ao jogador
    const coin = await tx.inventoryItem.findFirst({
      where: { profileId: profile.id, itemId: 'millis_silver_coins' },
    });

    if (coin) {
      await tx.inventoryItem.update({
        where: { id: coin.id },
        data: { amount: coin.amount + sellPrice },
      });
    } else {
      await tx.inventoryItem.create({
        data: {
          profileId: profile.id,
          itemId: 'millis_silver_coins',
          amount: sellPrice,
          slotIndex: null,
        },
      });
    }
  });

  return {
    success: true,
    message: `💰 Sold 1x **${itemDef.name}** for **${sellPrice} Millis Silver Coins**!`,
  };
}