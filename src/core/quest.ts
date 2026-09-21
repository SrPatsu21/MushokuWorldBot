import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import { BoardQuestStatus } from '@prisma/client';
import { Point, QuestTemplate, BoardTemplate, TravelDistanceResult } from '../types/quest';

const QUESTS_PATH = path.join(__dirname, '../data/quests.json');
const BOARDS_PATH = path.join(__dirname, '../data/boards.json');

const RANK_ORDER: Record<string, number> = {
  F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7
};

export function loadQuestTemplates(): QuestTemplate[] {
  const fileData = fs.readFileSync(QUESTS_PATH, 'utf-8');
  return JSON.parse(fileData);
}

export function loadBoardTemplates(): BoardTemplate[] {
  const fileData = fs.readFileSync(BOARDS_PATH, 'utf-8');
  return JSON.parse(fileData);
}

export function calculateManhattanDistance(p1: Point, p2: Point): number {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

export function calculateTotalTravelDistance(
  userPos: Point,
  boardPos: Point,
  questGlobalPos: Point
): TravelDistanceResult {
  const travelToBoard = calculateManhattanDistance(userPos, boardPos);
  const travelToQuest = calculateManhattanDistance(boardPos, questGlobalPos);

  return {
    travelToBoard,
    travelToQuest,
    totalDistance: travelToBoard + travelToQuest,
  };
}

export function calculateTravelTimeMinutes(totalDistanceBlocks: number): number {
  const BLOCKS_PER_HOUR = 6;
  return Math.ceil((totalDistanceBlocks / BLOCKS_PER_HOUR) * 60);
}

export async function syncBoardsFromJson() {
  const boardTemplates = loadBoardTemplates();

  for (const template of boardTemplates) {
    const existing = await prisma.questBoard.findFirst({
      where: { name: template.name },
    });

    if (!existing) {
      await prisma.questBoard.create({
        data: {
          name: template.name,
          positionX: template.positionX,
          positionY: template.positionY,
          maxCapacity: template.maxCapacity,
          maxRank: template.maxRank,
          difficultyMultiplier: template.difficultyMultiplier,
        },
      });
    }
  }
}

export async function getNearestBoard(userPos: Point) {
  await syncBoardsFromJson();

  const boards = await prisma.questBoard.findMany();
  if (boards.length === 0) return null;

  let nearestBoard = boards[0];
  let minDistance = calculateManhattanDistance(userPos, {
    x: nearestBoard.positionX,
    y: nearestBoard.positionY,
  });

  for (let i = 1; i < boards.length; i++) {
    const distance = calculateManhattanDistance(userPos, {
      x: boards[i].positionX,
      y: boards[i].positionY,
    });

    if (distance < minDistance) {
      minDistance = distance;
      nearestBoard = boards[i];
    }
  }

  return nearestBoard;
}

export async function refreshBoard(boardId: number) {
  const board = await prisma.questBoard.findUnique({ where: { id: boardId } });
  if (!board) return;

  const now = new Date();

  await prisma.boardQuest.updateMany({
    where: {
      boardId: board.id,
      status: BoardQuestStatus.AVAILABLE,
      expiresAt: { lte: now },
    },
    data: { status: BoardQuestStatus.EXPIRED },
  });

  await prisma.boardQuest.deleteMany({
    where: {
      boardId: board.id,
      status: BoardQuestStatus.AVAILABLE,
      isNull: true,
    },
  });

  const activeQuestsCount = await prisma.boardQuest.count({
    where: {
      boardId: board.id,
      status: BoardQuestStatus.AVAILABLE,
      isNull: false,
    },
  });

  const boardMaxRankLevel = RANK_ORDER[board.maxRank] || 7;

  // Filter quest templates to match the board rank ceiling
  const validTemplates = loadQuestTemplates().filter(
    (t) => (RANK_ORDER[t.rank] || 1) <= boardMaxRankLevel
  );

  if (validTemplates.length === 0) return;

  const availableSlots = board.maxCapacity - activeQuestsCount;
  const realQuestsToGenerate = Math.min(
    Math.floor(Math.random() * 10) + 5,
    availableSlots
  );

  const newQuestsData = [];

  for (let i = 0; i < realQuestsToGenerate; i++) {
    const template = validTemplates[Math.floor(Math.random() * validTemplates.length)];
    const randomHours = Math.floor(Math.random() * 48) + 1;
    const expiresAt = new Date(now.getTime() + randomHours * 60 * 60 * 1000);

    // Apply region difficulty scaling to difficulty and XP
    const scaledDifficulty = Number((template.difficulty * board.difficultyMultiplier).toFixed(1));
    const scaledXp = Math.round(template.rewards.xp * board.difficultyMultiplier);

    newQuestsData.push({
      boardId: board.id,
      questTemplateId: template.id,
      title: template.title,
      rank: template.rank,
      description: template.description,
      durationMinutes: template.durationMinutes,
      globalPositionX: board.positionX + template.positionX,
      globalPositionY: board.positionY + template.positionY,
      difficulty: scaledDifficulty,
      xpReward: scaledXp,
      itemRewardsJson: JSON.stringify(template.rewards.items),
      isNull: false,
      expiresAt,
    });
  }

  const nullSlotsCount = availableSlots - realQuestsToGenerate;
  for (let i = 0; i < nullSlotsCount; i++) {
    newQuestsData.push({
      boardId: board.id,
      questTemplateId: null,
      title: 'Empty Slot',
      rank: '-',
      description: 'No notice posted in this section of the board.',
      durationMinutes: 0,
      globalPositionX: board.positionX,
      globalPositionY: board.positionY,
      difficulty: 0,
      xpReward: 0,
      itemRewardsJson: '[]',
      isNull: true,
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    });
  }

  if (newQuestsData.length > 0) {
    await prisma.boardQuest.createMany({ data: newQuestsData });
  }
}