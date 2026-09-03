import { WebSocketManager } from '@discordjs/ws';
import { REST } from '@discordjs/rest';
import { API, Client, GatewayDispatchEvents, GatewayIntentBits } from '@discordjs/core';
import { ENV } from '../config/env';
import { getServerPrefix } from '../config/database';
import { UnifiedContext } from '../core/types';
import { dispatchCommand } from '../core/commandHandler';
import { Permissions } from '@discordjs/core';

const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);
export const discordApi = new API(rest);

export const discordGateway = new WebSocketManager({
  token: ENV.DISCORD_TOKEN,
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
  rest,
});

const client = new Client({ rest, gateway: discordGateway });

discordGateway.on('error', (error) => {
  console.error('⚠️ Discord Gateway Error:', error);
});

client.on(GatewayDispatchEvents.Ready, ({ data }) => {
  console.log(`🟢 Discord WebSocket connected! Logged in as: ${data.user.username} (ID: ${data.user.id})`);
});

client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
  if (message.author.bot || !message.guild_id) return;

  const serverId = `discord:${message.guild_id}`;
  const prefix = await getServerPrefix(serverId);

  if (!message.content || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

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
    hasAdminPermission: async () => {
      if (message.member?.permissions) {
        const permissions = BigInt(message.member.permissions);
        const ADMINISTRATOR = BigInt(1 << 3); // 0x8 or bit 3 (Administrator)
        const MANAGE_GUILD = BigInt(1 << 5);  // 0x20 or bit 5 (Manage Server)

        return (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
               (permissions & MANAGE_GUILD) === MANAGE_GUILD;
      }
      return false;
    },
  };

  try {
    await dispatchCommand(ctx, command, args);
  } catch (err) {
    console.error(`❌ Error dispatching command "${command}" on Discord:`, err);
  }
});

discordGateway.connect();