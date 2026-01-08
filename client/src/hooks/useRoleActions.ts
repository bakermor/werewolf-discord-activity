import { useState } from "react";
import { Socket } from "socket.io-client";

export function useRoleActions(socket: Socket | null) {
  const [isReady, setIsReady] = useState(false);

  const setPlayerReady = () => {
    if (!socket) return;
    socket.emit("player_ready");
    setIsReady(true);
  };

  return {
    isReady,
    setPlayerReady,
  };
}
