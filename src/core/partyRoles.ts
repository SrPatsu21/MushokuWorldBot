export enum PartyRoleBit {
  SCOUT    = 1 << 0, // 1
  TANK     = 1 << 1, // 2
  SUBTANK  = 1 << 2, // 4
  ATTACKER = 1 << 3, // 8
  HEALER   = 1 << 4, // 16
  THIEF    = 1 << 5, // 32
  ARCHER   = 1 << 6, // 64
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
  if (hasRole(mask, PartyRoleBit.SCOUT)) roles.push('Scout');
  if (hasRole(mask, PartyRoleBit.TANK)) roles.push('Tank');
  if (hasRole(mask, PartyRoleBit.SUBTANK)) roles.push('SubTank');
  if (hasRole(mask, PartyRoleBit.ATTACKER)) roles.push('Attacker');
  if (hasRole(mask, PartyRoleBit.HEALER)) roles.push('Healer');
  if (hasRole(mask, PartyRoleBit.THIEF)) roles.push('Thief');
  if (hasRole(mask, PartyRoleBit.ARCHER)) roles.push('Archer');
  return roles.length > 0 ? roles : ['None'];
}