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

export type GamePhase = "lobby" | "role_assignment";

export interface LobbyState {
  instanceId: string;
  createdAt: Date;
  players: Player[];
  availableRoles: Role[];
  selectedRoles: string[];
  isRoleConfigValid: boolean;
  gamePhase: GamePhase;
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;
