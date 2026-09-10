import { prisma } from '../config/database';
import { getOrCreateProfile } from './profile';

interface OTPRequest {
  fromPlatform: 'discord' | 'revolt';
  fromUserId: string;
  fromUsername: string;
  otp: string;
  createdAt: number;
}

const pendingTokens = new Map<string, OTPRequest>();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createLinkToken(
  fromPlatform: 'discord' | 'revolt',
  fromUserId: string,
  fromUsername: string
): { otp: string; expiresInMinutes: number } {
  for (const [code, req] of pendingTokens.entries()) {
    if (req.fromPlatform === fromPlatform && req.fromUserId === fromUserId) {
      pendingTokens.delete(code);
    }
  }

  let otp = generateOTP();
  while (pendingTokens.has(otp)) {
    otp = generateOTP();
  }

  const expiresInMinutes = 5;

  pendingTokens.set(otp, {
    fromPlatform,
    fromUserId,
    fromUsername,
    otp,
    createdAt: Date.now(),
  });

  setTimeout(() => pendingTokens.delete(otp), expiresInMinutes * 60 * 1000);

  return { otp, expiresInMinutes };
}

export async function confirmLinkToken(
  confirmingPlatform: 'discord' | 'revolt',
  confirmingUserId: string,
  confirmingUsername: string,
  otp: string
): Promise<{ success: boolean; message: string }> {
  const request = pendingTokens.get(otp);

  if (!request) {
    return {
      success: false,
      message: '❌ Invalid or expired linking code. Please generate a new code on the source platform.',
    };
  }

  if (request.fromPlatform === confirmingPlatform) {
    return {
      success: false,
      message: '❌ You must run the confirm command on the **OTHER** platform to link accounts.',
    };
  }

  if (request.fromUserId === confirmingUserId) {
    return {
      success: false,
      message: '❌ You cannot link an account to itself.',
    };
  }

  // Ensure source profile exists
  const sourceProfile = await getOrCreateProfile(
    request.fromPlatform,
    request.fromUserId,
    request.fromUsername,
    '0'
  );

  // Check if confirming user already has a separate profile on serverId = '0'
  const confirmingLinkedAccount = await prisma.linkedAccount.findUnique({
    where: {
      platform_platformUserId_serverId: {
        platform: confirmingPlatform,
        platformUserId: confirmingUserId,
        serverId: '0',
      },
    },
  });

  if (confirmingLinkedAccount) {
    if (confirmingLinkedAccount.profileId === sourceProfile.id) {
      pendingTokens.delete(otp);
      return {
        success: false,
        message: '⚠️ These accounts are already linked to the same profile!',
      };
    }

    // Merge: Relink confirming account to sourceProfile and remove duplicate profile
    const oldProfileId = confirmingLinkedAccount.profileId;

    await prisma.linkedAccount.update({
      where: { id: confirmingLinkedAccount.id },
      data: { profileId: sourceProfile.id },
    });

    // Clean up empty old profile if no other accounts linked to it
    const remainingInOld = await prisma.linkedAccount.count({
      where: { profileId: oldProfileId },
    });

    if (remainingInOld === 0) {
      await prisma.userProfile.delete({
        where: { id: oldProfileId },
      });
    }
  } else {
    // Create new LinkedAccount attached directly to sourceProfile
    await prisma.linkedAccount.create({
      data: {
        platform: confirmingPlatform,
        platformUserId: confirmingUserId,
        serverId: '0',
        profileId: sourceProfile.id,
      },
    });
  }

  pendingTokens.delete(otp);

  return {
    success: true,
    message: `✅ Successfully linked your ${confirmingPlatform} account with **${request.fromUsername}** (${request.fromPlatform})!`,
  };
}

export async function unlinkAccount(
  platform: 'discord' | 'revolt',
  userId: string
): Promise<{ success: boolean; message: string }> {
  const linkedAccount = await prisma.linkedAccount.findUnique({
    where: {
      platform_platformUserId_serverId: {
        platform,
        platformUserId: userId,
        serverId: '0',
      },
    },
    include: {
      profile: {
        include: {
          linkedAccounts: true,
        },
      },
    },
  });

  if (!linkedAccount || linkedAccount.profile.linkedAccounts.length <= 1) {
    return {
      success: false,
      message: '❌ Your account is not currently linked to any other platform.',
    };
  }

  // Create a new independent UserProfile for the unlinked account
  const newProfile = await prisma.userProfile.create({
    data: {
      username: `${platform}_${userId.slice(-4)}`,
      swordsman: { create: {} },
      mage: { create: {} },
    },
  });

  // Re-assign this LinkedAccount to the newly created profile
  await prisma.linkedAccount.update({
    where: { id: linkedAccount.id },
    data: { profileId: newProfile.id },
  });

  return { success: true, message: '✅ Accounts successfully unlinked.' };
}