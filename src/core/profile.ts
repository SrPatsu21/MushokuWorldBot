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

  const safeServerId = serverId || '0';

  if (safeServerId === '0') {
    const existingLinkedProfile = await prisma.userProfile.findFirst({
      where: {
        serverId: "0",
        platform: platform, // "discord" ou "revolt"
        platformUserId: platformUserId
      },
      include: {
        swordsman: true,
        mage: true
      }
    });

    if (existingLinkedProfile) {
      return existingLinkedProfile;
    }
  }

  return await prisma.userProfile.upsert({
    where: {
      platform_platformUserId_serverId: {
        platform,
        platformUserId,
        serverId: safeServerId,
      },
    },
    update: { username },
    create: {
      platform,
      platformUserId,
      serverId: safeServerId,
      username,
      swordsman: { create: {} },
      mage: { create: {} },
    },
    include: {
      swordsman: true,
      mage: true,
    },
  });
}

export async function getProfileOnly(
  platform: 'discord' | 'revolt',
  platformUserId: string,
  serverId: string = '0'
) {
  if (!platformUserId) {
    throw new Error('platformUserId is required to fetch profile.');
  }

  const safeServerId = serverId || '0';

  return await prisma.userProfile.findFirst({
    where: {
      serverId: safeServerId,
      platform,
      platformUserId,
    },
    include: {
      swordsman: true,
      mage: true,
    },
  });
}

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