export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  "werewolf-1": "Werewolf",
  "werewolf-2": "Werewolf",
  "seer-1": "Seer",
  "robber-1": "Robber",
  "troublemaker-1": "Troublemaker",
  "villager-1": "Villager",
  "villager-2": "Villager",
  "villager-3": "Villager",
} as const;

export const getRoleDisplayName = (roleId: string): string => {
  if (!roleId) return "";

  if (roleId in ROLE_DISPLAY_NAMES) {
    return ROLE_DISPLAY_NAMES[roleId];
  }

  // Fallback: extract base name and capitalize
  const baseName = roleId.split("-")[0];
  return baseName.charAt(0).toUpperCase() + baseName.slice(1);
};
