export interface UnifiedContext {
  platform: 'discord' | 'revolt';
  serverId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  reply: (content: string) => Promise<void>;
  mentionAuthor: () => string;
}

export type CommandHandler = (ctx: UnifiedContext, args: string[]) => Promise<void>;