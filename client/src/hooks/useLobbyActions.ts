import { Socket } from "socket.io-client";
import { SocketService } from "../services/SocketService";

export function useLobbyActions(socket: Socket | null) {
  const socketService = new SocketService();

  const toggleRole = (roleId: string) => {
    if (!socket) return;
    socketService.toggleRole(socket, roleId);
  };

  const setPlayerReady = () => {
    if (!socket) return;
    socketService.setPlayerReady(socket);
  };

  return {
    toggleRole,
    setPlayerReady,
  };
}
