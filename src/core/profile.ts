import { prisma } from '../config/database';
import { SkillRank } from '@prisma/client';
import { syncProfileState } from './actionEngine';

/**
 * Fetch profile without creating a new record.
 */
export async function getProfileOnly(
  platform: 'discord' | 'revolt',
  platformUserId: string,
  serverId: string = '0'
) {
  const safeServerId = serverId || '0';

  const linkedAccount = await prisma.linkedAccount.findUnique({
    where: {
      platform_platformUserId_serverId: {
        platform,
        platformUserId,
        serverId: safeServerId,
      },
    },
  });

  if (!linkedAccount) return null;

  return await syncProfileState(linkedAccount.profileId);
}

/**
 * Fetch existing profile or create a new one with linked account setup.
 */
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

  const existingProfile = await getProfileOnly(platform, platformUserId, safeServerId);
  if (existingProfile) {
    return existingProfile;
  }

  const newProfile = await prisma.userProfile.create({
    data: {
      username,
      positionX: 0,
      positionY: 0,
      swordsman: { create: {} },
      mage: { create: {} },
      linkedAccounts: {
        create: {
          platform,
          platformUserId,
          serverId: safeServerId,
        },
      },
    },
  });

  return await syncProfileState(newProfile.id);
}

/**
 * Update character position coordinates.
 */
export async function updateProfilePosition(profileId: number, x: number, y: number) {
  return await prisma.userProfile.update({
    where: { id: profileId },
    data: {
      positionX: x,
      positionY: y,
    },
  });
}

/**
 * Update swordsman skill rank for a profile.
 */
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

/**
 * Update mage magic rank for a profile.
 */
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