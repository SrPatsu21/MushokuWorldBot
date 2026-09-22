import { UnifiedContext } from '../core/types';
import { prisma, getServerPrefix } from '../config/database';
import { getProfileOnly } from '../core/profile';
import {
  getNearestBoard,
  refreshBoard,
  calculateTotalTravelDistance,
  calculateTravelTimeMinutes,
} from '../core/quest';

const ITEMS_PER_PAGE = 3;

export async function handleQuest(ctx: UnifiedContext, args: string[]) {
  try {
    const subCommand = args[0]?.toLowerCase();
    const prefix = await getServerPrefix(ctx.serverId);

    switch (subCommand) {
      case 'board': {
        const page = parseInt(args[1], 10) || 1;
        return await showNearestQuestBoard(ctx, page);
      }
      default: {
        if (!subCommand) {
          return await showNearestQuestBoard(ctx, 1);
        }

        return await ctx.reply(
          `**📜 Quest System**\n` +
          `• \`${prefix}quest board [page]\` - View available quests at your nearest Quest Board.\n` +
          `• \`${prefix}party acceptquest <id>\` - Accept a quest with your party.`
        );
      }
    }
  } catch (error) {
    console.error('Error in quest command:', error);
    await ctx.reply('❌ An error occurred in the quest command.');
  }
}

async function showNearestQuestBoard(ctx: UnifiedContext, page = 1) {
  // Try retrieving server profile first, then fallback to global scope ("0")
  let profile = await getProfileOnly(ctx.platform, ctx.authorId, ctx.serverId);
  if (!profile) {
    profile = await getProfileOnly(ctx.platform, ctx.authorId, '0');
  }

  if (!profile) {
    return await ctx.reply('❌ You do not have a profile yet! Run `!profile` first.');
  }

  const userPos = { x: profile.positionX, y: profile.positionY };
  const board = await getNearestBoard(userPos);

  if (!board) {
    return await ctx.reply('❌ No Quest Boards available in the world.');
  }

  const realCount = await prisma.boardQuest.count({
    where: {
      boardId: board.id,
      status: 'AVAILABLE',
      isNull: false,
    },
  });

  if (realCount === 0) {
    await refreshBoard(board.id);
  }

  const totalRealQuests = await prisma.boardQuest.count({
    where: {
      boardId: board.id,
      status: 'AVAILABLE',
      isNull: false,
    },
  });

  if (totalRealQuests === 0) {
    return await ctx.reply(`📜 **${board.name}** currently has no available quests.`);
  }

  const totalPages = Math.ceil(totalRealQuests / ITEMS_PER_PAGE);
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const quests = await prisma.boardQuest.findMany({
    where: {
      boardId: board.id,
      status: 'AVAILABLE',
      isNull: false,
    },
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
    orderBy: { createdAt: 'desc' },
  });

  const boardPos = { x: board.city.positionX, y: board.city.positionY };

  let message = `📜 **Nearest Board: ${board.name}** [Page ${currentPage}/${totalPages}]\n`;
  message += `📍 **Your Position:** (${userPos.x},${userPos.y}) | **Board Position:** (${boardPos.x},${boardPos.y})\n`;
  message += `⚔️ **Region Rating:** Max Rank \`${board.maxRank}\` | Difficulty Multiplier \`${board.difficultyMultiplier}x\`\n\n`;

  quests.forEach((q) => {
    const questGlobalPos = { x: q.globalPositionX, y: q.globalPositionY };

    const { travelToBoard, travelToQuest, totalDistance } = calculateTotalTravelDistance(
      userPos,
      boardPos,
      questGlobalPos
    );

    const travelTimeMinutes = calculateTravelTimeMinutes(totalDistance);
    const items = JSON.parse(q.itemRewardsJson);

    message += `🔹 **[ID ${q.id}] ${q.title}** (Rank${q.rank})\n`;
    message += `• **Difficulty:** \`${q.difficulty}/10\` | **Quest Time:** \`${q.durationMinutes}m\`\n`;
    message += `• **Distance:** \`${totalDistance} blocks\` (To Board: ${travelToBoard}b \vert{} To Target:${travelToQuest}b)\n`;
    message += `• **Estimated Travel Time:** \`~${travelTimeMinutes} minutes\` (Speed: 6 blocks/hr)\n`;
    message += `• **Target Location:** (${q.globalPositionX},${q.globalPositionY})\n`;
    message += `• **Description:** ${q.description}\n`;
    message += `• **Item Rewards:** ${items.length} item pool(s)\n\n`;
  });

  message += `💡 *To accept a quest with your party, use:* \`!party acceptquest <ID>\``;

  return await ctx.reply(message);
}