import { UnifiedContext } from '../core/types';
import { getServerPrefix } from '../config/database';

export async function handleHelp(ctx: UnifiedContext) {
  const prefix = await getServerPrefix(ctx.serverId);

  const response = [
    `📜 **Central de Ajuda - Mushoku World Bot**`,
    ``,
    `• \`${prefix}help\` - Exibe esta lista de comandos.`,
    `• \`${prefix}perfil\` - Exibe as informações do seu perfil.`,
    `• \`${prefix}setprefix <símbolo>\` - Altera o prefixo de comandos no servidor.`,
  ].join('\n');

  await ctx.reply(response);
}