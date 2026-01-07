import { GameState, LobbyState, PlayerGameState } from "../types/lobby.types";

export class GameService {
  private games: Map<string, GameState> = new Map();

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  createGame(lobby: LobbyState): GameState {
    const shuffledRoles = this.shuffleArray(lobby.selectedRoles);

    const playerRoles = new Map<string, PlayerGameState>();
    lobby.players.forEach((player, index) => {
      playerRoles.set(player.userId, {
        userId: player.userId,
        assignedRole: shuffledRoles[index],
        currentRole: shuffledRoles[index],
      });
    });

    const centerCards = shuffledRoles.slice(lobby.players.length);

    const gameState: GameState = {
      instanceId: lobby.instanceId,
      playerRoles,
      centerCards,
    };

    this.games.set(lobby.instanceId, gameState);
    return gameState;
  }

  getGame(instanceId: string): GameState | undefined {
    return this.games.get(instanceId);
  }

  getPlayerRole(
    instanceId: string,
    userId: string
  ): PlayerGameState | undefined {
    const game = this.games.get(instanceId);
    return game?.playerRoles.get(userId);
  }
}
