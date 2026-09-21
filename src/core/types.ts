export interface UnifiedContext {
  platform: 'discord' | 'revolt';
  serverId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  reply: (content: string) => Promise<void>;
  sendDM?: (content: string) => Promise<void>;
  mentionAuthor: () => string;
  hasAdminPermission: () => Promise<boolean>;
  mentions?: Array<{ id: string; username: string }>;
  rawMessage?: any;
}

export type CommandHandler = (ctx: UnifiedContext, args: string[]) => Promise<void>;

export interface Point {
  x: number;
  y: number;
}

export interface QuestItemReward {
  id: string;
  amount: number;
  extraProbability: number;
  extraTests: number;
}

export interface QuestTemplate {
  id: string;
  title: string;
  rank: string;
  description: string;
  durationMinutes: number;
  positionX: number;
  positionY: number;
  rewards: {
    xp: number;
    items: QuestItemReward[];
  };
  difficulty: number;
}

export interface BoardTemplate {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  maxCapacity: number;
  maxRank: string;
  difficultyMultiplier: number;
}

export interface TravelDistanceResult {
  travelToBoard: number;
  travelToQuest: number;
  totalDistance: number;
}