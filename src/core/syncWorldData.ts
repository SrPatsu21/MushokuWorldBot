import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';

interface CityJSON {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  kingdom: string;
  race: string;
  climate: string;
  description: string;
  dangerLevel: string;
}

interface ShopJSON {
  slug: string;
  name: string;
  cityId: string;
  items: { itemId: string; price: number }[];
}

interface BoardJSON {
  slug: string;
  name: string;
  cityId: string;
  maxCapacity?: number;
  maxRank?: string;
  difficultyMultiplier?: number;
}

export async function syncWorldDataFromJSON() {
  console.log('🔄 Sincronizando dados de mundo a partir dos JSONs...');

  const citiesPath = path.join(__dirname, '../data/cities.json');
  if (fs.existsSync(citiesPath)) {
    const citiesJSON: CityJSON[] = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));
    const validCityIds = citiesJSON.map((c) => c.id);

    for (const city of citiesJSON) {
      await prisma.city.upsert({
        where: { id: city.id },
        update: {
          name: city.name,
          positionX: city.positionX,
          positionY: city.positionY,
          kingdom: city.kingdom,
          race: city.race,
          climate: city.climate,
          description: city.description,
          dangerLevel: city.dangerLevel,
        },
        create: city,
      });
    }

    await prisma.city.deleteMany({
      where: { id: { notIn: validCityIds } },
    });
  }

  const shopsPath = path.join(__dirname, '../data/shops.json');
  if (fs.existsSync(shopsPath)) {
    const shopsJSON: ShopJSON[] = JSON.parse(fs.readFileSync(shopsPath, 'utf-8'));
    const validShopSlugs = shopsJSON.map((s) => s.slug);

    for (const shopData of shopsJSON) {
      const shop = await prisma.shop.upsert({
        where: { slug: shopData.slug },
        update: {
          name: shopData.name,
          cityId: shopData.cityId,
        },
        create: {
          slug: shopData.slug,
          name: shopData.name,
          cityId: shopData.cityId,
        },
      });

      await prisma.shopItem.deleteMany({ where: { shopId: shop.id } });
      if (shopData.items && shopData.items.length > 0) {
        await prisma.shopItem.createMany({
          data: shopData.items.map((i) => ({
            shopId: shop.id,
            itemId: i.itemId,
            price: i.price,
          })),
        });
      }
    }

    await prisma.shop.deleteMany({
      where: { slug: { notIn: validShopSlugs } },
    });
  }

  // -------------------------------------------------------------
  // 3. Boards (source of truth: boards.json)
  // -------------------------------------------------------------
  const boardsPath = path.join(__dirname, '../data/boards.json');
  if (fs.existsSync(boardsPath)) {
    const boardsJSON: BoardJSON[] = JSON.parse(fs.readFileSync(boardsPath, 'utf-8'));
    const validBoardSlugs = boardsJSON.map((b) => b.slug);

    for (const boardData of boardsJSON) {
      await prisma.questBoard.upsert({
        where: { slug: boardData.slug },
        update: {
          name: boardData.name,
          cityId: boardData.cityId,
          maxCapacity: boardData.maxCapacity ?? 50,
          maxRank: boardData.maxRank ?? 'S',
          difficultyMultiplier: boardData.difficultyMultiplier ?? 1.0,
        },
        create: {
          slug: boardData.slug,
          name: boardData.name,
          cityId: boardData.cityId,
          maxCapacity: boardData.maxCapacity ?? 50,
          maxRank: boardData.maxRank ?? 'S',
          difficultyMultiplier: boardData.difficultyMultiplier ?? 1.0,
        },
      });
    }

    await prisma.questBoard.deleteMany({
      where: { slug: { notIn: validBoardSlugs } },
    });
  }

  console.log('✅ World data successfully synchronized with the JSON files!');
}