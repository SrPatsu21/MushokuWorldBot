import { UnifiedContext } from './types';
import { handleHelp } from '../commands/help';
import { handleSetPrefix } from '../commands/setprefix';
import { handleProfile } from '../commands/profile';

type CommandFunction = (ctx: UnifiedContext, args: string[]) => Promise<void>;

// Mapeamento dos comandos e seus aliases
const commandMap = new Map<string, CommandFunction>();

commandMap.set('help', (ctx) => handleHelp(ctx));
commandMap.set('ajuda', (ctx) => handleHelp(ctx));
commandMap.set('setprefix', (ctx, args) => handleSetPrefix(ctx, args));
commandMap.set('perfil', (ctx, args) => handleProfile(ctx, args));
commandMap.set('profile', (ctx, args) => handleProfile(ctx, args));

export async function dispatchCommand(ctx: UnifiedContext, command: string, args: string[]) {
  const handler = commandMap.get(command.toLowerCase());
  if (handler) {
    try {
      await handler(ctx, args);
    } catch (error) {
      console.error(`Erro ao executar o comando ${command}:`, error);
      await ctx.reply('❌ Ocorreu um erro interno ao executar este comando.');
    }
  }
}