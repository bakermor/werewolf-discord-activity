import {
  LobbyState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Player,
  Role,
} from "../types/lobby.types";

export class LobbyService {
  private lobbies: Map<string, LobbyState> = new Map();

  createDefaultRoles() {
    const availableRoles: Role[] = [
      { id: "werewolf-1", name: "Werewolf" },
      { id: "werewolf-2", name: "Werewolf" },
      { id: "seer-1", name: "Seer" },
      { id: "robber-1", name: "Robber" },
      { id: "troublemaker-1", name: "Troublemaker" },
      { id: "villager-1", name: "Villager" },
      { id: "villager-2", name: "Villager" },
      { id: "villager-3", name: "Villager" },
    ];

    const selectedRoles: string[] = [
      "werewolf-1",
      "werewolf-2",
      "seer-1",
      "robber-1",
      "troublemaker-1",
      "villager-1",
    ];

    return { availableRoles, selectedRoles };
  }

  getLobby(instanceId: string): LobbyState | undefined {
    return this.lobbies.get(instanceId);
  }

  createLobby(instanceId: string): LobbyState {
    const { availableRoles, selectedRoles } = this.createDefaultRoles();
    const lobby: LobbyState = {
      instanceId,
      createdAt: new Date(),
      players: [],
      availableRoles,
      selectedRoles,
      isRoleConfigValid: false,
      gamePhase: "lobby",
    };
    this.lobbies.set(instanceId, lobby);
    return lobby;
  }

  addPlayer(lobby: LobbyState, player: Player): void {
    const playerExists = lobby.players.some((p) => p.userId === player.userId);
    if (!playerExists) {
      lobby.players.push(player);
    }
  }

  removePlayer(lobby: LobbyState, userId: string): void {
    lobby.players = lobby.players.filter((p) => p.userId !== userId);
  }

  toggleRole(lobby: LobbyState, roleId: string): boolean {
    const roleExists = lobby.availableRoles.some((role) => role.id === roleId);
    if (!roleExists) return false;

    const roleIndex = lobby.selectedRoles.indexOf(roleId);
    if (roleIndex !== -1) {
      lobby.selectedRoles.splice(roleIndex, 1);
    } else {
      lobby.selectedRoles.push(roleId);
    }
    return true;
  }

  validateRoleConfig(lobby: LobbyState): boolean {
    return lobby.selectedRoles.length === lobby.players.length + 3;
  }

  resetPlayersReadiness(lobby: LobbyState): void {
    lobby.players.forEach((player) => {
      player.isReady = false;
    });
  }

  allPlayersReady(lobby: LobbyState): boolean {
    if (lobby.players.length === 0) return false;
    return lobby.players.every((p) => p.isReady === true);
  }

  isValidPlayerCount(lobby: LobbyState): boolean {
    return (
      lobby.players.length >= MIN_PLAYERS && lobby.players.length <= MAX_PLAYERS
    );
  }

  setPlayerReady(lobby: LobbyState, userId: string): Player | undefined {
    const player = lobby.players.find((p) => p.userId === userId);
    if (player) {
      player.isReady = true;
    }
    return player;
  }

  startGame(lobby: LobbyState): void {
    if (this.allPlayersReady(lobby) && lobby.gamePhase === "lobby") {
      lobby.gamePhase = "role_assignment";
    }
  }
}
