import { io, Socket } from "socket.io-client";
import { CurrentUser, LobbyState } from "../types/lobby.types";

export class SocketService {
  private socket: Socket | null = null;

  createConnection(): Socket {
    const socketUrl = window.location.origin;
    console.log("Connecting to Socket.io:", socketUrl);

    this.socket = io(socketUrl, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    return this.socket;
  }

  async joinLobby(
    socket: Socket,
    instanceId: string,
    playerData: CurrentUser
  ): Promise<LobbyState> {
    return new Promise<LobbyState>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Socket connection timeout"));
      }, 15000);

      socket.on("connect", () => {
        console.log("Socket.io connected:", socket.id);
        console.log("Transport:", socket.io.engine.transport.name);
        clearTimeout(timeout);

        // Join the lobby room
        socket.emit("join_lobby", {
          instanceId,
          ...playerData,
        });
      });

      socket.on("lobby_state", (state: LobbyState) => {
        console.log("Received lobby state:", state);
        clearTimeout(timeout);
        resolve(state);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        clearTimeout(timeout);
        reject(error);
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });
    });
  }

  toggleRole(socket: Socket, roleId: string): void {
    socket.emit("toggle_role", { roleId });
  }

  setPlayerReady(socket: Socket): void {
    socket.emit("player_ready");
  }

  onLobbyStateUpdate(
    socket: Socket,
    callback: (state: LobbyState) => void
  ): void {
    socket.on("lobby_state", callback);
  }

  disconnect(socket: Socket): void {
    socket.disconnect();
  }
}
