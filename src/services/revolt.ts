import { Client } from 'revolt.js';
import { ENV } from '../config/env';
import { getServerPrefix } from '../config/database';
import { UnifiedContext } from '../core/types';
import { handleSetPrefix } from '../commands/setprefix';
import { handleProfile } from '../commands/profile';

export const revoltBot = new Client();

revoltBot.on('ready', () => {
  console.log(`🟢 Revolt WebSocket conectado! Logado como: ${revoltBot.user?.username}`);
});

revoltBot.on('messageCreate', async (message) => {
  if (message.author?.bot || !message.channel || !message.server) return;

  const serverId = `revolt:${message.server._id}`;
  const prefix = await getServerPrefix(serverId);

  if (!message.content || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const ctx: UnifiedContext = {
    platform: 'revolt',
    serverId,
    channelId: message.channel._id,
    authorId: message.author._id,
    authorName: message.author.username,
    reply: async (content: string) => {
      await message.channel?.sendMessage(content);
    },
    mentionAuthor: () => `<@${message.author._id}>`,
  };

  if (command === 'setprefix') await handleSetPrefix(ctx, args);
  if (command === 'perfil') await handleProfile(ctx, args);
});