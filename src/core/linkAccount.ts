import { prisma } from '../config/database';

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

  let sourceProfile = await prisma.userProfile.findFirst({
    where: {
      platform: request.fromPlatform,
      platformUserId: request.fromUserId,
      serverId: '0',
    },
  });

  if (!sourceProfile) {
    sourceProfile = await prisma.userProfile.create({
      data: {
        platform: request.fromPlatform,
        platformUserId: request.fromUserId,
        serverId: '0',
        username: request.fromUsername,
        swordsman: { create: {} },
        mage: { create: {} },
      },
    });
  }

  await prisma.userProfile.update({
    where: { id: sourceProfile.id },
    data: { linkedPlatformUserId: confirmingUserId },
  });

  await prisma.userProfile.upsert({
    where: {
      platform_platformUserId_serverId: {
        platform: confirmingPlatform,
        platformUserId: confirmingUserId,
        serverId: '0',
      },
    },
    update: { linkedPlatformUserId: request.fromUserId },
    create: {
      platform: confirmingPlatform,
      platformUserId: confirmingUserId,
      linkedPlatformUserId: request.fromUserId,
      serverId: '0',
      username: confirmingUsername,
      swordsman: { create: {} },
      mage: { create: {} },
    },
  });

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
  const profile = await prisma.userProfile.findFirst({
    where: {
      serverId: '0',
      OR: [
        { platform, platformUserId: userId },
        { linkedPlatformUserId: userId },
      ],
    },
  });

  if (!profile || !profile.linkedPlatformUserId) {
    return {
      success: false,
      message: '❌ Your account is not currently linked to any other platform.',
    };
  }

  const otherUserId = profile.linkedPlatformUserId;

  await prisma.userProfile.updateMany({
    where: {
      serverId: '0',
      OR: [
        { platformUserId: userId },
        { platformUserId: otherUserId },
        { linkedPlatformUserId: userId },
        { linkedPlatformUserId: otherUserId },
      ],
    },
    data: { linkedPlatformUserId: null },
  });

  return { success: true, message: '✅ Accounts successfully unlinked.' };
}