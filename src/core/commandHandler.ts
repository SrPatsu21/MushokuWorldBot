import { UnifiedContext } from './types';
import { handleHelp } from '../commands/help';
import { handleSetPrefix } from '../commands/setprefix';
import { handleProfile } from '../commands/profile';
import { handleLink } from '../commands/link';
import { handleTrain } from '../commands/train';
import { handleParty } from '../commands/party';
import { handleQuest } from '../commands/quest';

type CommandFunction = (ctx: UnifiedContext, args: string[]) => Promise<unknown>;

const commandMap = new Map<string, CommandFunction>();

commandMap.set('help', (ctx) => handleHelp(ctx));
commandMap.set('profile', (ctx, args) => handleProfile(ctx, args));
commandMap.set('train', (ctx, args) => handleTrain(ctx, args));
commandMap.set('party', (ctx, args) => handleParty(ctx, args));
commandMap.set('link', (ctx, args) => handleLink(ctx, args));
commandMap.set('setprefix', (ctx, args) => handleSetPrefix(ctx, args));
commandMap.set('quest', (ctx, args) => handleQuest(ctx, args));

export async function dispatchCommand(ctx: UnifiedContext, command: string, args: string[]) {
  const handler = commandMap.get(command.toLowerCase());
  if (handler) {
    try {
      await handler(ctx, args);
    } catch (error) {
      console.error(`Error executing command ${command}:`, error);
      await ctx.reply('❌ An internal error occurred while executing this command.');
    }
  }
}