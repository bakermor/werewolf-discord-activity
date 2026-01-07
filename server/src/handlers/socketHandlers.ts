import { Server, Socket } from "socket.io";
import { LobbyService } from "../services/LobbyService";
import { GameService } from "../services/GameService";
import { Player, LobbyState } from "../types/lobby.types";

export function registerSocketHandlers(
  io: Server,
  lobbyService: LobbyService,
  gameService: GameService
) {
  io.on("connection", (socket: Socket) => {
    console.log("New socket connection:", socket.id);

    socket.on("join_lobby", ({ instanceId, userId, username, avatar }) => {
      handleJoinLobby(socket, io, lobbyService, {
        instanceId,
        userId,
        username,
        avatar,
      });
    });

    socket.on("toggle_role", ({ roleId }: { roleId: string }) => {
      handleToggleRole(socket, io, lobbyService, roleId);
    });

    socket.on("player_ready", () => {
      handlePlayerReady(socket, io, lobbyService, gameService);
    });

    socket.on("fetch_role", () => {
      handleFetchRole(socket, gameService);
    });

    socket.on("disconnect", () => {
      handleDisconnect(socket, io, lobbyService);
    });
  });
}

function handleJoinLobby(
  socket: Socket,
  io: Server,
  lobbyService: LobbyService,
  data: { instanceId: string; userId: string; username: string; avatar: string }
) {
  const { instanceId, userId, username, avatar } = data;
  console.log(`User ${userId} joining lobby ${instanceId}`);

  socket.join(instanceId);

  // Store user data on the socket
  socket.data.userId = userId;
  socket.data.instanceId = instanceId;
  socket.data.username = username;
  socket.data.avatar = avatar;

  let lobby = lobbyService.getLobby(instanceId);
  if (!lobby) {
    lobby = lobbyService.createLobby(instanceId);
  }

  // Add player to lobby (deduped by userId)
  const player: Player = { userId, username, avatar, isReady: false };
  lobbyService.addPlayer(lobby, player);

  lobby.isRoleConfigValid = lobbyService.validateRoleConfig(lobby);
  lobbyService.resetPlayersReadiness(lobby);

  emitLobbyState(io, lobby);
}

function handleToggleRole(
  socket: Socket,
  io: Server,
  lobbyService: LobbyService,
  roleId: string
) {
  const instanceId = socket.data.instanceId;
  if (!instanceId) return;

  const lobby = lobbyService.getLobby(instanceId);
  if (!lobby) return;

  const result = lobbyService.toggleRole(lobby, roleId);
  if (!result) return;

  lobby.isRoleConfigValid = lobbyService.validateRoleConfig(lobby);
  lobbyService.resetPlayersReadiness(lobby);

  emitLobbyState(io, lobby);
}

function handlePlayerReady(
  socket: Socket,
  io: Server,
  lobbyService: LobbyService,
  gameService: GameService
) {
  const instanceId = socket.data.instanceId;
  if (!instanceId) return;

  const lobby = lobbyService.getLobby(instanceId);
  if (
    !lobby ||
    !lobby.isRoleConfigValid ||
    !lobbyService.isValidPlayerCount(lobby)
  )
    return;

  const player = lobbyService.setPlayerReady(lobby, socket.data.userId);
  if (!player) return;

  lobbyService.startGame(lobby);

  if (lobby.gamePhase === "role_assignment") {
    gameService.createGame(lobby);
  }

  emitLobbyState(io, lobby);
}

function handleFetchRole(socket: Socket, gameService: GameService) {
  const { instanceId, userId } = socket.data;
  if (!instanceId || !userId) return;

  const playerRole = gameService.getPlayerRole(instanceId, userId);
  if (!playerRole) return;

  // Send role ONLY to requesting player (private event)
  socket.emit("role_assigned", {
    assignedRole: playerRole.assignedRole,
    currentRole: playerRole.currentRole,
  });
}

function handleDisconnect(
  socket: Socket,
  io: Server,
  lobbyService: LobbyService
) {
  const instanceId = socket.data.instanceId;
  if (!instanceId) return;

  const lobby = lobbyService.getLobby(instanceId);
  if (!lobby) return;

  lobbyService.removePlayer(lobby, socket.data.userId);
  lobby.isRoleConfigValid = lobbyService.validateRoleConfig(lobby);
  lobbyService.resetPlayersReadiness(lobby);

  emitLobbyState(io, lobby);
}

function emitLobbyState(io: Server, lobby: LobbyState) {
  io.to(lobby.instanceId).emit("lobby_state", {
    instanceId: lobby.instanceId,
    createdAt: lobby.createdAt.toISOString(),
    players: lobby.players,
    availableRoles: lobby.availableRoles,
    selectedRoles: [...lobby.selectedRoles],
    isRoleConfigValid: lobby.isRoleConfigValid,
    gamePhase: lobby.gamePhase,
  });
}
