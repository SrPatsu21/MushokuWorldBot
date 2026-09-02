import { UnifiedContext } from '../core/types';
import { setServerPrefix } from '../config/database';

export async function handleSetPrefix(ctx: UnifiedContext, args: string[]) {
  const newPrefix = args[0];

  if (!newPrefix) {
    await ctx.reply('⚠️ Por favor, informe o novo símbolo do prefixo. Exemplo: `!setprefix ?`');
    return;
  }

  if (newPrefix.length > 3) {
    await ctx.reply('⚠️ O prefixo deve ter no máximo 3 caracteres.');
    return;
  }

  await setServerPrefix(ctx.serverId, newPrefix);
  await ctx.reply(`✅ Prefixo do servidor atualizado com sucesso para: \`${newPrefix}\``);
}