export interface Player {
  userId: string;
  username: string;
  avatar: string;
  isReady: boolean;
}

export interface Role {
  id: string;
  name: string;
}

export type GamePhase = "lobby" | "role_assignment" | "night" | "day" | "voting" | "game_over";

export interface LobbyState {
  instanceId: string;
  createdAt: Date;
  players: Player[];
  availableRoles: Role[];
  selectedRoles: string[];
  isRoleConfigValid: boolean;
  gamePhase: GamePhase;
}

export interface PlayerGameState {
  userId: string;
  assignedRole: string; // role ID from selectedRoles
  currentRole: string;
}

export interface GameState {
  instanceId: string;
  playerRoles: Map<string, PlayerGameState>;
  centerCards: string[]; // Array of 3 role IDs
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;
