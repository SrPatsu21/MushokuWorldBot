import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import { BoardQuestStatus } from '@prisma/client';
import { Point, QuestTemplate, TravelDistanceResult } from '../types/quest';

const QUESTS_PATH = path.join(__dirname, '../data/quests.json');

function loadQuestTemplates(): QuestTemplate[] {
  const fileData = fs.readFileSync(QUESTS_PATH, 'utf-8');
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

  const templates = loadQuestTemplates();
  const availableSlots = board.maxCapacity - activeQuestsCount;

  const realQuestsToGenerate = Math.min(
    Math.floor(Math.random() * 10) + 5,
    availableSlots
  );

  const newQuestsData = [];

  for (let i = 0; i < realQuestsToGenerate; i++) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const randomHours = Math.floor(Math.random() * 48) + 1;
    const expiresAt = new Date(now.getTime() + randomHours * 60 * 60 * 1000);

    newQuestsData.push({
      boardId: board.id,
      questTemplateId: template.id,
      title: template.title,
      rank: template.rank,
      description: template.description,
      durationMinutes: template.durationMinutes,
      globalPositionX: board.positionX + template.positionX,
      globalPositionY: board.positionY + template.positionY,
      difficulty: template.difficulty,
      xpReward: template.rewards.xp,
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

  await prisma.boardQuest.createMany({ data: newQuestsData });
}