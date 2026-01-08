import { LobbyState, Player } from "../types/lobby.types";

export function setPlayerReady(
  lobby: LobbyState,
  userId: string
): Player | undefined {
  const player = lobby.players.find((p) => p.userId === userId);
  if (player) {
    player.isReady = true;
  }
  return player;
}

export function allPlayersReady(lobby: LobbyState): boolean {
  if (lobby.players.length === 0) return false;
  return lobby.players.every((p) => p.isReady === true);
}

export function resetPlayersReadiness(lobby: LobbyState): void {
  lobby.players.forEach((player) => {
    player.isReady = false;
  });
}
