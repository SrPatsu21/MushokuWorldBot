import { UnifiedContext } from '../core/types';
import { getOrCreateProfile } from '../core/profile';

export async function handleProfile(ctx: UnifiedContext, args: string[]) {
  try {
    const scope = args[0]?.toLowerCase() === 'server' ? ctx.serverId : '0';
    const profileTypeLabel = scope === '0' ? 'Global' : 'Servidor';

    const profile = await getOrCreateProfile(
      ctx.platform,
      ctx.authorId,
      ctx.authorName,
      scope
    );

    const sw = profile.swordsman;
    const mg = profile.mage;

    let response = `📜 **Perfil de ${profile.username} (${profileTypeLabel})**\n\n`;

    response += `⚔️ **Estilos de Esgrima:**\n`;
    response += `• Sword God: \`${sw?.swordGod || 'NONE'}\`\n`;
    response += `• North God: \`${sw?.northGod || 'NONE'}\`\n`;
    response += `• Water God: \`${sw?.waterGod || 'NONE'}\`\n\n`;

    response += `🪄 **Magias:**\n`;
    response += `• Fire: \`${mg?.fire || 'NONE'}\` | Water: \`${mg?.water || 'NONE'}\`\n`;
    response += `• Wind: \`${mg?.wind || 'NONE'}\` | Earth: \`${mg?.earth || 'NONE'}\`\n`;
    response += `• Healing: \`${mg?.healing || 'NONE'}\` | Detox: \`${mg?.detoxification || 'NONE'}\`\n`;
    response += `• Protection: \`${mg?.protection || 'NONE'}\` | Summoning: \`${mg?.summoning || 'NONE'}\`\n`;

    await ctx.reply(response);
  } catch (error) {
    console.error('Erro ao processar comando de perfil:', error);
    await ctx.reply('❌ Ocorreu um erro ao carregar o seu perfil.');
  }
}