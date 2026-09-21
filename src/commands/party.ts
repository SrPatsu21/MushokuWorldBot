import { UnifiedContext } from '../core/types';
import { getProfileOnly } from '../core/profile';
import { prisma, getServerPrefix } from '../config/database';
import { PartyRoleBit, addRole, removeRole, hasRole, getRoleNames } from '../core/partyRoles';
import { calculateTotalTravelDistance, calculateTravelTimeMinutes } from '../core/quest';
import { syncProfileState, triggerPlayerDeath } from '../core/actionEngine';
import { ActionType } from '@prisma/client';
import { ActionType, BoardQuestStatus } from '@prisma/client';

const RANK_ORDER: Record<string, number> = {
  F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7, SSS: 8
};

const pendingInvites = new Map<number, Array<{ partyId: number; partyName: string; invitedBy: string }>>();

function isRankCompatible(leaderRank: string, targetRank: string): boolean {
  const lRank = RANK_ORDER[leaderRank] || 1;
  const tRank = RANK_ORDER[targetRank] || 1;
  return Math.abs(lRank - tRank) <= 1;
}

function parseMentionId(arg: string): string | null {
  if (!arg) return null;
  const match = arg.trim().match(/^<@!?([A-Za-z0-9]+)>$/);
  return match ? match[1] : null;
}

async function resolveTargetProfile(ctx: UnifiedContext, input: string, scope: string) {
  if (!input) return null;

  const mentionedId = parseMentionId(input);

  if (mentionedId) {
    return await getProfileOnly(ctx.platform, mentionedId, scope);
  }

  return await prisma.userProfile.findFirst({
    where: {
      username: { equals: input.trim(), mode: 'insensitive' },
    },
  });
}

export async function handleParty(ctx: UnifiedContext, args: string[]) {
  try {
    const subCommand = args[0]?.toLowerCase();
    const scope = args.some((arg) => arg.toLowerCase() === 'server') ? ctx.serverId : '0';
    const cleanArgs = args.filter((arg) => arg.toLowerCase() !== 'server');

    const profile = await getProfileOnly(ctx.platform, ctx.authorId, scope);

    if (!profile) {
      return await ctx.reply('❌ You do not have a profile yet! Run `!profile` first.');
    }

    const prefix = await getServerPrefix(ctx.serverId);

    switch (subCommand) {
      case 'create':
        return await createParty(ctx, profile, cleanArgs.slice(1).join(' '));
      case 'invite':
        return await inviteMember(ctx, profile, cleanArgs[1], scope);
      case 'accept':
        return await acceptInvite(ctx, profile, cleanArgs.slice(1).join(' '));
      case 'decline':
        return await declineInvite(ctx, profile, cleanArgs.slice(1).join(' '));
      case 'kick':
        return await kickMember(ctx, profile, cleanArgs[1], scope);
      case 'leave':
        return await leaveParty(ctx, profile);
      case 'role':
        return await manageRole(ctx, profile, cleanArgs[1], cleanArgs[2], cleanArgs[3], scope);
      case 'transfer':
        return await transferLeadership(ctx, profile, cleanArgs[1], scope);
      case 'info':
        return await showPartyInfo(ctx, profile, cleanArgs.slice(1).join(' '));
      case 'acceptquest':
        return await acceptQuest(ctx, profile, cleanArgs[1]);
      default:
        return await ctx.reply(
          `**👥 Party System**\n` +
          `• \`${prefix}party create <name>\` - Create a new party.\n` +
          `• \`${prefix}party invite <@user>\` - Send a party invite (Leader only).\n` +
          `• \`${prefix}party accept [party_name]\` - Accept a pending party invite.\n` +
          `• \`${prefix}party decline [party_name]\` - Decline a pending party invite.\n` +
          `• \`${prefix}party acceptquest <quest_id>\` - Accept an available quest for your party (Leader only).\n` +
          `• \`${prefix}party kick <@user>\` - Kick a member (Leader only).\n` +
          `• \`${prefix}party leave\` - Leave your current party (Disbands if Leader).\n` +
          `• \`${prefix}party role <add/remove> <@user> <role>\` - Manage member roles (Leader only).\n` +
          `• \`${prefix}party transfer <@user>\` - Pass leader rights (Leader only).\n` +
          `• \`${prefix}party info [name]\` - Details of your party or search by name.`
        );
    }
  } catch (error) {
    console.error('Error in party command:', error);
    await ctx.reply('❌ An error occurred in the party command.');
  }
}

async function createParty(ctx: UnifiedContext, profile: any, name: string) {
  if (!name || name.trim().length === 0) {
    return await ctx.reply('❌ Please specify a party name! Example: `!party create Adventurers`');
  }

  if (profile.partyId) {
    return await ctx.reply('❌ You are already in a party! Leave it first to create a new one.');
  }

  const existingParty = await prisma.party.findUnique({ where: { name } });
  if (existingParty) {
    return await ctx.reply('❌ A party with this name already exists.');
  }

  const initialMask = PartyRoleBit.LEADER | PartyRoleBit.ATTACKER;

  const party = await prisma.party.create({
    data: {
      name,
      leaderId: profile.id,
      members: {
        connect: { id: profile.id },
      },
    },
  });

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { partyRoles: initialMask },
  });

  return await ctx.reply(`🎉 Party **${party.name}** successfully created! You are now the Leader.`);
}

async function inviteMember(ctx: UnifiedContext, profile: any, targetInput: string, scope: string) {
  if (!profile.partyId) return await ctx.reply('❌ You are not in a party.');

  const isLeader = hasRole(profile.partyRoles, PartyRoleBit.LEADER);
  if (!isLeader) return await ctx.reply('❌ Only the Party Leader can invite members.');

  const party = await prisma.party.findUnique({
    where: { id: profile.partyId },
    include: { members: true },
  });

  if (!party) return await ctx.reply('❌ Party not found.');
  if (party.members.length >= 7) return await ctx.reply('❌ Party is full (Maximum 7 members).');

  const targetProfile = await resolveTargetProfile(ctx, targetInput, scope);

  if (!targetProfile) return await ctx.reply('❌ Player profile not found!');
  if (targetProfile.partyId) return await ctx.reply(`❌ Player **${targetProfile.username}** is already in a party.`);

  if (!isRankCompatible(profile.adventurerRank, targetProfile.adventurerRank)) {
    return await ctx.reply(
      `❌ Rank incompatible! Leader Rank: **${profile.adventurerRank}**. ` +
      `Only players within 1 rank above or below can join.`
    );
  }

  const userInvites = pendingInvites.get(targetProfile.id) || [];

  if (userInvites.some((inv) => inv.partyId === party.id)) {
    return await ctx.reply(`❌ **${targetProfile.username}** already has a pending invite from your party.`);
  }

  userInvites.push({
    partyId: party.id,
    partyName: party.name,
    invitedBy: profile.username,
  });

  pendingInvites.set(targetProfile.id, userInvites);

  return await ctx.reply(
    `📩 Sent a party invite to **${targetProfile.username}**!\n` +
    `They can type \`!party accept ${party.name}\` or \`!party decline ${party.name}\`.`
  );
}

async function acceptInvite(ctx: UnifiedContext, profile: any, partyNameInput?: string) {
  if (profile.partyId) return await ctx.reply('❌ You are already in a party!');

  const userInvites = pendingInvites.get(profile.id);
  if (!userInvites || userInvites.length === 0) {
    return await ctx.reply('❌ You do not have any pending party invites.');
  }

  if (userInvites.length > 1 && (!partyNameInput || partyNameInput.trim().length === 0)) {
    const list = userInvites.map((i) => `• **${i.partyName}** (Invited by${i.invitedBy})`).join('\n');
    return await ctx.reply(
      `⚠️ You have multiple pending invites! Please specify the party name:\n${list}\n\n` +
      `Example: \`!party accept ${userInvites[0].partyName}\``
    );
  }

  const targetName = partyNameInput?.trim().toLowerCase();
  const invite = targetName
    ? userInvites.find((i) => i.partyName.toLowerCase() === targetName)
    : userInvites[0];

  if (!invite) {
    return await ctx.reply(`❌ No pending invite found from party **${partyNameInput}**.`);
  }

  const party = await prisma.party.findUnique({
    where: { id: invite.partyId },
    include: { members: true },
  });

  if (!party) {
    pendingInvites.set(profile.id, userInvites.filter((i) => i.partyId !== invite.partyId));
    return await ctx.reply('❌ The party no longer exists.');
  }

  if (party.members.length >= 7) {
    pendingInvites.set(profile.id, userInvites.filter((i) => i.partyId !== invite.partyId));
    return await ctx.reply('❌ The party is now full.');
  }

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      partyId: party.id,
      partyRoles: PartyRoleBit.ATTACKER,
    },
  });

  pendingInvites.delete(profile.id);

  return await ctx.reply(`🤝 You have joined **${party.name}**!`);
}

async function declineInvite(ctx: UnifiedContext, profile: any, partyNameInput?: string) {
  const userInvites = pendingInvites.get(profile.id);
  if (!userInvites || userInvites.length === 0) {
    return await ctx.reply('❌ You do not have any pending party invites.');
  }

  const targetName = partyNameInput?.trim().toLowerCase();
  const invite = targetName
    ? userInvites.find((i) => i.partyName.toLowerCase() === targetName)
    : userInvites[0];

  if (!invite) {
    return await ctx.reply(`❌ No pending invite found from party **${partyNameInput}**.`);
  }

  const remaining = userInvites.filter((i) => i.partyId !== invite.partyId);
  if (remaining.length > 0) {
    pendingInvites.set(profile.id, remaining);
  } else {
    pendingInvites.delete(profile.id);
  }

  return await ctx.reply(`❌ You declined the invite to join **${invite.partyName}**.`);
}

async function kickMember(ctx: UnifiedContext, profile: any, targetInput: string, scope: string) {
  if (!profile.partyId) return await ctx.reply('❌ You are not in a party.');

  const isLeader = hasRole(profile.partyRoles, PartyRoleBit.LEADER);
  if (!isLeader) return await ctx.reply('❌ Only the Party Leader can kick members.');

  const targetProfile = await resolveTargetProfile(ctx, targetInput, scope);

  if (!targetProfile || targetProfile.partyId !== profile.partyId) {
    return await ctx.reply('❌ Player not found in your party.');
  }
  if (targetProfile.id === profile.id) {
    return await ctx.reply('❌ You cannot kick yourself. Use `!party leave`.');
  }

  await prisma.userProfile.update({
    where: { id: targetProfile.id },
    data: { partyId: null, partyRoles: 0 },
  });

  return await ctx.reply(`👢 **${targetProfile.username}** was forcefully removed from the party.`);
}

async function leaveParty(ctx: UnifiedContext, profile: any) {
  if (!profile.partyId) return await ctx.reply('❌ You are not in a party.');

  const isLeader = hasRole(profile.partyRoles, PartyRoleBit.LEADER);

  if (isLeader) {
    await prisma.userProfile.updateMany({
      where: { partyId: profile.partyId },
      data: { partyId: null, partyRoles: 0 },
    });

    await prisma.party.delete({ where: { id: profile.partyId } });
    return await ctx.reply('💥 The Leader left, and the party has been **disbanded**.');
  }

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { partyId: null, partyRoles: 0 },
  });

  return await ctx.reply('🚪 You left the party.');
}

async function manageRole(
  ctx: UnifiedContext,
  profile: any,
  action: string,
  targetInput: string,
  roleName: string,
  scope: string
) {
  if (!profile.partyId) return await ctx.reply('❌ You are not in a party.');

  const isLeader = hasRole(profile.partyRoles, PartyRoleBit.LEADER);
  if (!isLeader) return await ctx.reply('❌ Only the Leader can manage member roles.');

  if (!['add', 'remove'].includes(action?.toLowerCase())) {
    return await ctx.reply('❌ Usage: `!party role <add/remove> <@user> <role>`');
  }

  const normalizedRole = roleName?.toUpperCase() as keyof typeof PartyRoleBit;
  if (!normalizedRole || !(normalizedRole in PartyRoleBit)) {
    return await ctx.reply('❌ Invalid role! Available: LEADER, SCOUT, TANK, SUBTANK, ATTACKER, HEALER, THIEF, ARCHER.');
  }

  const targetProfile = await resolveTargetProfile(ctx, targetInput, scope);

  if (!targetProfile || targetProfile.partyId !== profile.partyId) {
    return await ctx.reply('❌ Member not found in your party.');
  }

  if (normalizedRole === 'LEADER' && action.toLowerCase() === 'remove') {
    return await ctx.reply('❌ You cannot remove the Leader role. Transfer it to another member instead.');
  }

  if (normalizedRole === 'LEADER' && action.toLowerCase() === 'add') {
    return await transferLeadership(ctx, profile, targetInput, scope);
  }

  const roleBit = PartyRoleBit[normalizedRole];
  let updatedMask = targetProfile.partyRoles;

  if (action.toLowerCase() === 'add') {
    updatedMask = addRole(updatedMask, roleBit);
  } else {
    updatedMask = removeRole(updatedMask, roleBit);
  }

  await prisma.userProfile.update({
    where: { id: targetProfile.id },
    data: { partyRoles: updatedMask },
  });

  return await ctx.reply(`🎭 Updated roles for **${targetProfile.username}**: [${getRoleNames(updatedMask).join(', ')}]`);
}

async function transferLeadership(ctx: UnifiedContext, profile: any, targetInput: string, scope: string) {
  if (!profile.partyId) return await ctx.reply('❌ You are not in a party.');

  const isLeader = hasRole(profile.partyRoles, PartyRoleBit.LEADER);
  if (!isLeader) return await ctx.reply('❌ Only the Leader can transfer ownership.');

  const targetProfile = await resolveTargetProfile(ctx, targetInput, scope);

  if (!targetProfile || targetProfile.partyId !== profile.partyId) {
    return await ctx.reply('❌ Member not found in your party.');
  }
  if (targetProfile.id === profile.id) return await ctx.reply('❌ You are already the Leader.');

  const oldLeaderMask = removeRole(profile.partyRoles, PartyRoleBit.LEADER);
  const newLeaderMask = addRole(targetProfile.partyRoles, PartyRoleBit.LEADER);

  await prisma.$transaction([
    prisma.party.update({
      where: { id: profile.partyId },
      data: { leaderId: targetProfile.id },
    }),
    prisma.userProfile.update({
      where: { id: profile.id },
      data: { partyRoles: oldLeaderMask },
    }),
    prisma.userProfile.update({
      where: { id: targetProfile.id },
      data: { partyRoles: newLeaderMask },
    }),
  ]);

  return await ctx.reply(`👑 Leadership transferred to **${targetProfile.username}**!`);
}

async function showPartyInfo(ctx: UnifiedContext, profile: any, searchQuery?: string) {
  let party;

  if (searchQuery && searchQuery.trim().length > 0) {
    party = await prisma.party.findFirst({
      where: { name: { equals: searchQuery.trim(), mode: 'insensitive' } },
      include: {
        members: { include: { currentAction: true } },
      },
    });

    if (!party) return await ctx.reply(`❌ Party **${searchQuery}** not found.`);
  } else {
    if (!profile.partyId) return await ctx.reply('❌ You are not in a party! Specify a name: `!party info <name>`.');

    party = await prisma.party.findUnique({
      where: { id: profile.partyId },
      include: {
        members: { include: { currentAction: true } },
      },
    });

    if (!party) return await ctx.reply('❌ Your party was not found.');
  }

  const memberList = party.members.map((m) => {
    const roles = getRoleNames(m.partyRoles).join(', ');
    const status = m.currentAction ? `Busy (${m.currentAction.type})` : 'Idle / Ready';
    return `• **${m.username}** [Rank ${m.adventurerRank}] - Roles: *${roles}* | Status: \`${status}\``;
  }).join('\n');

  return await ctx.reply(
    `👥 **Party: ${party.name}** (${party.members.length}/7)\n` +
    `${memberList}`
  );
}

async function acceptQuest(ctx: UnifiedContext, profile: any, questIdInput: string) {
  if (!profile.partyId) {
    return await ctx.reply('❌ You are not in a party.');
  }

  const isLeader = hasRole(profile.partyRoles, PartyRoleBit.LEADER);
  if (!isLeader) {
    return await ctx.reply('❌ Only the Party Leader can accept quests for the party.');
  }

  const questId = parseInt(questIdInput, 10);
  if (isNaN(questId)) {
    return await ctx.reply('❌ Please provide a valid quest ID! Example: `!party acceptquest 1`');
  }

  const quest = await prisma.boardQuest.findUnique({
    where: { id: questId },
    include: { board: true },
  });

  if (!quest || quest.status !== 'AVAILABLE' || quest.isNull) {
    return await ctx.reply('❌ Quest not found or no longer available.');
  }

  const party = await prisma.party.findUnique({
    where: { id: profile.partyId },
    include: { members: { include: { currentAction: true } } },
  });

  if (!party) {
    return await ctx.reply('❌ Party not found.');
  }

  const busyMembers: string[] = [];
  const updatedMembers = [];

  for (const member of party.members) {
    const synced = await syncProfileState(member.id);
    if (synced?.currentAction) {
      busyMembers.push(synced.username);
    }
    if (synced) {
      updatedMembers.push(synced);
    }
  }

  if (busyMembers.length > 0) {
    return await ctx.reply(
      `❌ Cannot start quest! The following member(s) are currently busy:\n` +
      `• ${busyMembers.join(', ')}`
    );
  }

  const boardPos = { x: quest.board.positionX, y: quest.board.positionY };
  const questGlobalPos = { x: quest.globalPositionX, y: quest.globalPositionY };

  let maxTotalDistance = 0;
  let maxTravelToBoard = 0;
  let maxTravelToQuest = 0;

  for (const member of updatedMembers) {
    const userPos = { x: member.positionX, y: member.positionY };
    const { travelToBoard, travelToQuest, totalDistance } = calculateTotalTravelDistance(
      userPos,
      boardPos,
      questGlobalPos
    );

    if (totalDistance > maxTotalDistance) {
      maxTotalDistance = totalDistance;
      maxTravelToBoard = travelToBoard;
      maxTravelToQuest = travelToQuest;
    }
  }

  const roundTripDistance = maxTotalDistance + maxTravelToQuest;
  const roundTripTravelTimeMinutes = calculateTravelTimeMinutes(roundTripDistance);

  const totalDurationMinutes = roundTripTravelTimeMinutes + quest.durationMinutes;
  const totalDurationSeconds = totalDurationMinutes * 60;

  const travelToQuestMinutes = calculateTravelTimeMinutes(maxTotalDistance);
  const timeToReachQuestLocationSeconds = travelToQuestMinutes * 60;

  await prisma.boardQuest.update({
    where: { id: quest.id },
    data: { status: BoardQuestStatus.IN_PROGRESS },
  });

  const startTime = new Date();
  for (const member of updatedMembers) {
    await prisma.userAction.create({
      data: {
        profileId: member.id,
        type: ActionType.QUEST,
        duration: totalDurationSeconds,
        startedAt: startTime,
        data: {
          questId: quest.id,
          partyId: party.id,
          targetPositionX: quest.globalPositionX,
          targetPositionY: quest.globalPositionY,
          returnBoardPositionX: quest.board.positionX,
          returnBoardPositionY: quest.board.positionY,
          timeToReachQuestLocationSeconds,
          questDurationMinutes: quest.durationMinutes,
        },
      },
    });
  }

  return await ctx.reply(
    `⚔️ **Quest Accepted by ${party.name}!**\n` +
    `📜 **Quest:** ${quest.title} (Rank${quest.rank})\n` +
    `📍 **Target Location:** (${quest.globalPositionX},${quest.globalPositionY})\n` +
    `🏃 **Max Distance:** \`${maxTotalDistance} blocks\` (Based on furthest member)\n` +
    `⏱️ **Estimated Travel Time:** \`~${roundTripTravelTimeMinutes}m\` (Round Trip)\n` +
    `⏳ **Quest Duration:** \`${quest.durationMinutes}m\`\n` +
    `🕒 **Total Execution Time:** \`${totalDurationMinutes} minutes\``
  );
}

export function calculateQuestXpDistribution(partyRolesMask: number, totalXp: number): { staminaXp: number; manaXp: number } {
  const isAny = hasRole(partyRolesMask, PartyRoleBit.SCOUT) || hasRole(partyRolesMask, PartyRoleBit.TANK) || hasRole(partyRolesMask, PartyRoleBit.SUBTANK) || hasRole(partyRolesMask, PartyRoleBit.ATTACKER);
  if (isAny) {
    return { staminaXp: totalXp, manaXp: totalXp };
  }

  const isHealer = hasRole(partyRolesMask, PartyRoleBit.HEALER);
  const isStaminaClass = hasRole(partyRolesMask, PartyRoleBit.ARCHER) || hasRole(partyRolesMask, PartyRoleBit.THIEF);

  if (isHealer && isStaminaClass) {
    return { staminaXp: totalXp, manaXp: totalXp };
  }

  if (isHealer) {
    return { staminaXp: 0, manaXp: totalXp };
  }

  if (isStaminaClass) {
    return { staminaXp: totalXp, manaXp: 0 };
  }

  return { staminaXp: 0, manaXp: 0 };
}

export async function checkPartyAvailabilityForQuest(partyId: number): Promise<boolean> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { members: { include: { currentAction: true } } },
  });

  if (!party) return false;

  return party.members.every((member) => member.currentAction === null);
}