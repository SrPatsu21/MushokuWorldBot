import { prisma } from '../config/database';
import { SkillRank } from '@prisma/client';

export async function getOrCreateProfile(
  platform: 'discord' | 'revolt',
  platformUserId: string,
  username: string,
  serverId: string = '0'
) {
  return await prisma.userProfile.upsert({
    where: {
      platform_platformUserId_serverId: {
        platform,
        platformUserId,
        serverId,
      },
    },
    update: { username },
    create: {
      platform,
      platformUserId,
      serverId,
      username,
      // Cria automaticamente a entrada de Espadachim e Mago com os campos default (NONE)
      swordsman: {
        create: {},
      },
      mage: {
        create: {},
      },
    },
    include: {
      swordsman: true,
      mage: true,
    },
  });
}

// Exemplo de como atualizar o nível de um estilo de esgrima sem escrever SQL
export async function updateSwordsmanStyle(
  profileId: number,
  style: 'swordGod' | 'northGod' | 'waterGod',
  rank: SkillRank
) {
  return await prisma.swordsmanClass.update({
    where: { profileId },
    data: { [style]: rank },
  });
}

// Exemplo de como atualizar uma magia sem escrever SQL
export async function updateMageMagic(
  profileId: number,
  magic: 'fire' | 'water' | 'wind' | 'earth' | 'healing' | 'detoxification' | 'protection' | 'summoning',
  rank: SkillRank
) {
  return await prisma.mageClass.update({
    where: { profileId },
    data: { [magic]: rank },
  });
}