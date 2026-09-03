import { prisma } from '../config/database';
import { SkillRank } from '@prisma/client';

export async function getOrCreateProfile(
  platform: 'discord' | 'revolt',
  platformUserId: string,
  username: string,
  serverId: string = '0'
) {
  if (!platformUserId) {
    throw new Error('platformUserId cannot be undefined or empty when fetching/creating a profile.');
  }

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

// Update swordsman style level via Prisma
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

// Update magic rank via Prisma
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