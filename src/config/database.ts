import { PrismaClient } from '@prisma/client';
import { ENV } from './env';
import { readFileSync } from 'fs';

function getDbPassword(): string {
  if (process.env.DB_PASSWORD_FILE) {
    try {
      return readFileSync(process.env.DB_PASSWORD_FILE, 'utf-8').trim();
    } catch {
      // fallback
    }
  }
  return ENV.DB_PASSWORD;
}

const dbPassword = getDbPassword();

process.env.DATABASE_URL = `postgresql://${ENV.DB_USER}:${dbPassword}@${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME}?schema=public`;

export const prisma = new PrismaClient();

export async function initDatabase() {
  await prisma.$connect();
  console.log('✅ Prisma connected to PostgreSQL!');
}

export async function getServerPrefix(serverId: string): Promise<string> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });
  return server?.prefix || '!';
}

export async function setServerPrefix(serverId: string, prefix: string): Promise<void> {
  await prisma.server.upsert({
    where: { id: serverId },
    update: { prefix },
    create: { id: serverId, prefix },
  });
}