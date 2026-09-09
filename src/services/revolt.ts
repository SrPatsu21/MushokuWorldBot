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
  try {
    const authorId = message.authorId || message.author?._id;

    if (!authorId || message.author?.bot || !message.channel || !message.server) return;

    const serverId = `revolt:${message.server._id}`;
    const prefix = await getServerPrefix(serverId);

    if (!message.content || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    const ctx: UnifiedContext = {
      platform: 'revolt',
      serverId: message.channel?.server_id || '0',
      channelId: message.channel._id,
      authorId: message.author.id,
      authorName: message.author?.username || 'Unknown',
      reply: async (content: string) => {
        await message.reply(content, true);
      },
      sendDM: async (content: string) => {
        const dmChannel = await message.author.openDM();
        await dmChannel.sendMessage(content);
      },
      mentionAuthor: () => `<@${authorId}>`,
      hasAdminPermission: async () => {
        if (message.server?.owner === authorId) return true;

        try {
          if (message.member) {
            return message.member.hasPermission(message.channel, 'ManageServer') || false;
          }
          const member = await message.server?.fetchMember(authorId);
          return member?.hasPermission(message.channel, 'ManageServer') || false;
        } catch (err) {
          console.error('⚠️ Error checking admin permissions in Revolt:', err);
          return false;
        }
      },
    };

    await dispatchCommand(ctx, command, args);
  } catch (err) {
    console.error('❌ Error handling Revolt message event:', err);
  }
});