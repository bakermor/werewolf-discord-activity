import { useEffect, useState } from "react";
import { LobbyState, Player } from "../types/lobby.types";
import { getCurrentPlayer } from "../utils/lobbyUtils";

export function usePlayerState(
  lobby: LobbyState | null,
  userId: string | undefined
) {
  const [isLocalReady, setIsLocalReady] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useEffect(() => {
    const player = getCurrentPlayer(lobby, userId);
    setCurrentPlayer(player);

    if (player && !player.isReady) {
      setIsLocalReady(false);
    }
  }, [lobby, userId]);

  return {
    currentPlayer,
    isLocalReady,
    setIsLocalReady,
  };
}
