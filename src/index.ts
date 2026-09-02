import { initDatabase } from './config/database';
import { discordGateway } from './services/discord';
import { revoltBot } from './services/revolt';
import { ENV } from './config/env';

function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const cleaned = token.trim();
  return cleaned.length > 10 && cleaned !== 'seu_token_aqui';
}

async function bootstrap() {
  try {
    console.log('⚡ Conectando ao Banco de Dados...');
    await initDatabase();

    console.log('🚀 Iniciando Serviços...');

    // --- CONEXÃO DISCORD ---
    if (isTokenValid(ENV.DISCORD_TOKEN)) {
      try {
        await discordGateway.connect();
        console.log('✅ Bot do Discord conectado com sucesso!');
      } catch (err: any) {
        console.error('⚠️ Discord: Token configurado, mas falhou ao autenticar.', err?.message || err);
      }
    } else {
      console.warn('⚠️ Discord: Token não fornecido ou inválido em secrets/discord_token.txt. Ignorando conexão.');
    }

    // --- CONEXÃO REVOLT ---
    if (isTokenValid(ENV.REVOLT_TOKEN)) {
      try {
        await revoltBot.loginBot(ENV.REVOLT_TOKEN);
        console.log('✅ Autenticação do Revolt iniciada!');
      } catch (err: any) {
        console.error('⚠️ Revolt: Token configurado, mas falhou ao autenticar.', err?.message || err);
      }
    } else {
      console.warn('⚠️ Revolt: Token não fornecido ou inválido em secrets/revolt_token.txt. Ignorando conexão.');
    }

    console.log('🚀 Processo de inicialização concluído!');
  } catch (error) {
    console.error('❌ Falha crítica no banco de dados:', error);
    process.exit(1);
  }
}

bootstrap();