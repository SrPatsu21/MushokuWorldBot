export enum PartyRoleBit {
  LEADER   = 1 << 0, // 1
  SCOUT    = 1 << 1, // 2
  TANK     = 1 << 2, // 4
  SUBTANK  = 1 << 3, // 8
  ATTACKER = 1 << 4, // 16
  HEALER   = 1 << 5, // 32
  THIEF    = 1 << 6, // 64
  ARCHER   = 1 << 7, // 128
}

export function hasRole(mask: number, role: PartyRoleBit): boolean {
  return (mask & role) === role;
}

export function addRole(mask: number, role: PartyRoleBit): number {
  return mask | role;
}

export function removeRole(mask: number, role: PartyRoleBit): number {
  return mask & ~role;
}

export function getRoleNames(mask: number): string[] {
  const roles: string[] = [];
  if (hasRole(mask, PartyRoleBit.LEADER)) roles.push('Leader');
  if (hasRole(mask, PartyRoleBit.SCOUT)) roles.push('Scout');
  if (hasRole(mask, PartyRoleBit.TANK)) roles.push('Tank');
  if (hasRole(mask, PartyRoleBit.SUBTANK)) roles.push('SubTank');
  if (hasRole(mask, PartyRoleBit.ATTACKER)) roles.push('Attacker');
  if (hasRole(mask, PartyRoleBit.HEALER)) roles.push('Healer');
  if (hasRole(mask, PartyRoleBit.THIEF)) roles.push('Thief');
  if (hasRole(mask, PartyRoleBit.ARCHER)) roles.push('Archer');
  return roles.length > 0 ? roles : ['None'];
}

export async function checkPartyAvailabilityForQuest(partyId: number): Promise<boolean> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { members: { include: { currentAction: true } } },
  });

  if (!party) return false;

  // Retorna verdadeiro somente se NENHUM membro possui ação ativa
  return party.members.every((member) => member.currentAction === null);
}