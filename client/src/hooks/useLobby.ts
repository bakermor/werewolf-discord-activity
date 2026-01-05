import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { SocketService } from "../services/SocketService";
import { setupDiscordSdk } from "../setup";
import { CurrentUser, LobbyState } from "../types/lobby.types";

export function useLobby() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { auth, lobby, socket, playerData } = await setupDiscordSdk();

        console.log("Auth:", auth);
        console.log("Lobby:", lobby);

        setLobby(lobby);
        setSocket(socket);
        setCurrentUser(playerData);

        const socketService = new SocketService();
        socketService.onLobbyStateUpdate(socket, (state: LobbyState) => {
          console.log("Lobby state updated:", state);
          setLobby(state);
        });
      } catch (err) {
        console.error("Discord SDK setup failed:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();

    return () => {
      if (socket) {
        console.log("Disconnecting socket");
        socket.disconnect();
      }
    };
  }, []);

  return {
    isLoading,
    error,
    lobby,
    socket,
    currentUser,
  };
}
