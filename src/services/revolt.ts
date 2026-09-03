import { Client } from 'revolt.js';
import { ENV } from '../config/env';
import { getServerPrefix } from '../config/database';
import { UnifiedContext } from '../core/types';
import { dispatchCommand } from '../core/commandHandler';

export const revoltBot = new Client();

revoltBot.on('ready', () => {
  console.log(`🟢 Revolt WebSocket connected! Logged with: ${revoltBot.user?.username}`);
});

revoltBot.on('messageCreate', async (message) => {
  if (message.author?.bot || !message.channel || !message.server) return;

  const serverId = `revolt:${message.server._id}`;
  const prefix = await getServerPrefix(serverId);

  if (!message.content || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  const ctx: UnifiedContext = {
    platform: 'revolt',
    serverId,
    channelId: message.channel._id,
    authorId: message.author._id,
    authorName: message.author.username,
    reply: async (content: string) => {
      await message.reply(content, true);
    },
    mentionAuthor: () => `<@${message.author._id}>`,
  };

  try {
    await dispatchCommand(ctx, command, args);
  } catch (err) {
    console.error(`❌ Error dispatching command "${command}" in Revolt:`, err);
  }
});