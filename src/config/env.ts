import { readFileSync } from 'fs';

function getSecret(envVar: string, secretPathEnv?: string): string {
  const secretPath = process.env[secretPathEnv || ''];
  if (secretPath) {
    try {
      return readFileSync(secretPath, 'utf-8').trim();
    } catch {
      // Fallback para env var padrão
    }
  }
  return process.env[envVar] || '';
}

export const ENV = {
  DISCORD_TOKEN: getSecret('DISCORD_TOKEN', 'DISCORD_TOKEN_FILE'),
  REVOLT_TOKEN: getSecret('REVOLT_TOKEN', 'REVOLT_TOKEN_FILE'),
  DB_HOST: process.env.DB_HOST || 'db',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.POSTGRES_USER || 'bot_user',
  DB_NAME: process.env.DB_NAME || 'mushoku_db',
  DB_PASSWORD: getSecret('POSTGRES_PASSWORD', 'DB_PASSWORD_FILE'),
};