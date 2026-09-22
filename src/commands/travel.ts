import { UnifiedContext } from '../core/types';
import { prisma, getServerPrefix } from '../config/database';
import { getProfileOnly } from '../core/profile';
import { syncProfileState } from '../core/actionEngine';
import { calculateManhattanDistance, calculateTravelTimeMinutes } from '../core/quest';
import { ActionType } from '@prisma/client';

export async function handleTravel(ctx: UnifiedContext, args: string[]) {
  try {
    const scope = args.some((a) => a.toLowerCase() === 'server') ? ctx.serverId : '0';
    let profile = await getProfileOnly(ctx.platform, ctx.authorId, scope);

    if (!profile) {
      return await ctx.reply('❌ You do not have a profile created yet!');
    }

    profile = await syncProfileState(profile.id);
    if (!profile) return;

    if (profile.currentAction) {
      return await ctx.reply('❌ You cannot start a travel while busy with another action!');
    }

    const searchInput = args.join(' ').trim();
    const prefix = await getServerPrefix(ctx.serverId);

    if (!searchInput) {
      return await showCitiesList(ctx, profile, prefix);
    }

    if (args[0]?.toLowerCase() === 'to') {
      const targetId = args[1];
      if (!targetId) {
        return await ctx.reply(`❌ Usage: \`${prefix}travel to <city_id>\``);
      }
      return await startTravelToCity(ctx, profile, targetId);
    }

    return await searchCities(ctx, profile, searchInput, prefix);
  } catch (error) {
    console.error('Error in travel command:', error);
    await ctx.reply('❌ An error occurred in the travel command.');
  }
}

async function showCitiesList(ctx: UnifiedContext, profile: any, prefix: string) {
  const cities = await prisma.city.findMany({ take: 10 });
  const userPos = { x: profile.positionX, y: profile.positionY };

  let message = `🗺️ **World Travel Navigation**\n`;
  message += `📍 **Your Location:** (${userPos.x},${userPos.y})\n\n`;
  message += `🏙️ **Known Cities:**\n`;

  for (const city of cities) {
    const distance = calculateManhattanDistance(userPos, { x: city.positionX, y: city.positionY });
    const travelTime = calculateTravelTimeMinutes(distance);

    message += `• **${city.name}** \`[ID: ${city.id}]\` | Kingdom: **${city.kingdom}**\n`;
    message += `  📍 Pos: (${city.positionX},${city.positionY}) | Distance: \`${distance} blocks\` (~${travelTime} min)\n`;
  }

  message += `\n💡 **Usage:**\n`;
  message += `• \`${prefix}travel <name_or_kingdom>\` - Search cities by name or kingdom.\n`;
  message += `• \`${prefix}travel to <city_id>\` - Start traveling to a destination.`;

  return await ctx.reply(message);
}

async function searchCities(ctx: UnifiedContext, profile: any, query: string, prefix: string) {
  const userPos = { x: profile.positionX, y: profile.positionY };

  const cities = await prisma.city.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { kingdom: { contains: query, mode: 'insensitive' } },
      ],
    },
  });

  if (cities.length === 0) {
    return await ctx.reply(`🔍 No cities or kingdoms matching **"${query}"** were found.`);
  }

  let message = `🔍 **Search Results for "${query}":**\n\n`;

  for (const city of cities) {
    const distance = calculateManhattanDistance(userPos, { x: city.positionX, y: city.positionY });
    const travelTime = calculateTravelTimeMinutes(distance);

    message += `🏙️ **${city.name}** \`[ID: ${city.id}]\`\n`;
    message += `• **Kingdom:** ${city.kingdom} | **Climate:** ${city.climate} \vert{} **Danger Level:**${city.dangerLevel}\n`;
    message += `• **Location:** (${city.positionX},${city.positionY}) | **Distance:** \`${distance} blocks\` (~${travelTime} min)\n`;
    message += `• **Description:** ${city.description}\n\n`;
  }

  message += `💡 *To set off, run:* \`${prefix}travel to <city_id>\``;

  return await ctx.reply(message);
}

async function startTravelToCity(ctx: UnifiedContext, profile: any, cityId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId } });

  if (!city) {
    return await ctx.reply(`❌ City with ID \`${cityId}\` does not exist.`);
  }

  const userPos = { x: profile.positionX, y: profile.positionY };
  const targetPos = { x: city.positionX, y: city.positionY };

  const distance = calculateManhattanDistance(userPos, targetPos);

  if (distance === 0) {
    return await ctx.reply(`📍 You are already at **${city.name}**!`);
  }

  const travelTimeMinutes = calculateTravelTimeMinutes(distance);
  const durationSeconds = travelTimeMinutes * 60;

  await prisma.userAction.create({
    data: {
      profileId: profile.id,
      type: ActionType.TRAVEL,
      duration: durationSeconds,
      startedAt: new Date(),
      data: {
        destinationCityId: city.id,
        destinationName: city.name,
        targetX: city.positionX,
        targetY: city.positionY,
        distance,
      },
    },
  });

  let message = `🧳 **Departure to ${city.name}!**\n`;
  message += `📍 **Route:** (${userPos.x},${userPos.y}) ➔ (${city.positionX},${city.positionY})\n`;
  message += `📏 **Distance:** \`${distance} blocks\` (Speed: 6 blocks/hr)\n`;
  message += `⏱️ **Estimated Arrival:** \`~${travelTimeMinutes} minutes\``;

  return await ctx.reply(message);
}