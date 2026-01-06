import type { CommandResponse } from "@discord/embedded-app-sdk";
import { Socket } from "socket.io-client";

export type Auth = CommandResponse<"authenticate">;

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

export interface CurrentUser {
  userId: string;
  username: string;
  avatar: string;
}

export type GamePhase = "lobby" | "role_assignment";

export interface LobbyState {
  instanceId: string;
  createdAt: string;
  players: Player[];
  availableRoles: Role[];
  selectedRoles: string[];
  isRoleConfigValid: boolean;
  gamePhase: GamePhase;
}

export interface SetupResult {
  auth: Auth;
  lobby: LobbyState;
  socket: Socket;
  playerData: CurrentUser;
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;
