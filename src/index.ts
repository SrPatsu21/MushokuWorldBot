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
    console.log('⚡ Connected to DB...');
    await initDatabase();

    console.log('🚀 starting services...');

    // --- CONEXÃO DISCORD ---
    if (isTokenValid(ENV.DISCORD_TOKEN)) {
      try {
        await discordGateway.connect();
        console.log('✅ Discord Bot connected successfully!');
      } catch (err: any) {
        console.error('⚠️ Discord: Token configured, but fail to authenticate.', err?.message || err);
      }
    } else {
      console.warn('⚠️ Discord: No valid Token was provided at secrets/discord_token.txt connection ignore.');
    }

    // --- CONEXÃO REVOLT ---
    if (isTokenValid(ENV.REVOLT_TOKEN)) {
      try {
        await revoltBot.loginBot(ENV.REVOLT_TOKEN);
        console.log('✅ Revolt connected successfully!!');
      } catch (err: any) {
        console.error('⚠️ Revolt: Token configured, but fail to authenticate.', err?.message || err);
      }
    } else {
      console.warn('⚠️ Revolt: No valid Token was provided at secrets/revolt_token.txt connection ignore.');
    }

    console.log('🚀 process initialization concluded!');
  } catch (error) {
    console.error('❌ Fatal error on DB:', error);
    process.exit(1);
  }
}

bootstrap();