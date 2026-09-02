import { WebSocketManager } from '@discordjs/ws';
import { REST } from '@discordjs/rest';
import { API, GatewayDispatchEvents, GatewayIntentBits } from '@discordjs/core';
import { ENV } from '../config/env';
import { getServerPrefix } from '../config/database';
import { UnifiedContext } from '../core/types';
import { handleSetPrefix } from '../commands/setprefix';
import { handleProfile } from '../commands/profile';

const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);
export const discordApi = new API(rest);

export const discordGateway = new WebSocketManager({
  token: ENV.DISCORD_TOKEN,
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
  rest,
});

discordGateway.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
  if (message.author.bot || !message.guild_id) return;

  const serverId = `discord:${message.guild_id}`;
  const prefix = await getServerPrefix(serverId);

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const ctx: UnifiedContext = {
    platform: 'discord',
    serverId,
    channelId: message.channel_id,
    authorId: message.author.id,
    authorName: message.author.username,
    reply: async (content: string) => {
      await discordApi.channels.createMessage(message.channel_id, {
        content,
        message_reference: { message_id: message.id },
      });
    },
    mentionAuthor: () => `<@${message.author.id}>`,
  };

  if (command === 'setprefix') await handleSetPrefix(ctx, args);
  if (command === 'perfil') await handleProfile(ctx, args);
});