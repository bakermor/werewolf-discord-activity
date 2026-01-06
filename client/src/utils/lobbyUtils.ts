import {
  LobbyState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Player,
} from "../types/lobby.types";

export function getCurrentPlayer(
  lobby: LobbyState | null,
  userId: string | undefined
): Player | null {
  if (!userId || !lobby) return null;
  return lobby.players.find((p) => p.userId === userId) ?? null;
}

export function isValidPlayerCount(playerCount: number): boolean {
  return playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS;
}

export function canStartGame(
  lobby: LobbyState | null,
  currentPlayer: Player | null,
  isLocalReady: boolean
): boolean {
  if (!lobby) return false;
  if (isLocalReady || currentPlayer?.isReady) return false;
  if (!isValidPlayerCount(lobby.players.length)) return false;
  if (!lobby.isRoleConfigValid) return false;
  return true;
}

export function getStartGameTooltip(
  lobby: LobbyState | null,
  currentPlayer: Player | null,
  isLocalReady: boolean
): string {
  if (!lobby) return "";
  if (isLocalReady || currentPlayer?.isReady) return "";

  const playerCount = lobby.players.length;

  if (!isValidPlayerCount(playerCount)) {
    return `Need ${MIN_PLAYERS}-${MAX_PLAYERS} players to start the game`;
  }

  if (!lobby.isRoleConfigValid) {
    return `Need exactly ${playerCount + 3} roles to start the game`;
  }

  return "";
}
