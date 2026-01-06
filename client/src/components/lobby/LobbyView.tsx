import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useLobbyActions } from "../../hooks/useLobbyActions";
import { usePlayerState } from "../../hooks/usePlayerState";
import { CurrentUser, LobbyState } from "../../types/lobby.types";
import { canStartGame, getStartGameTooltip } from "../../utils/lobbyUtils";
import styles from "./LobbyView.module.css";
import { PlayerList } from "./PlayerList";
import { RoleGrid } from "./RoleGrid";
import { StartGameButton } from "./StartButton";

interface LobbyViewProps {
  lobby: LobbyState;
  socket: Socket | null;
  currentUser: CurrentUser | null;
}

export function LobbyView({ lobby, socket, currentUser }: LobbyViewProps) {
  const { toggleRole, setPlayerReady } = useLobbyActions(socket);
  const { currentPlayer, isLocalReady, setIsLocalReady } = usePlayerState(
    lobby,
    currentUser?.userId
  );

  const [localSelectedRoles, setLocalSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (lobby.selectedRoles) {
      setLocalSelectedRoles(lobby.selectedRoles);
    }
  }, [lobby.selectedRoles]);

  const handleToggleRole = (roleId: string) => {
    setLocalSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );

    toggleRole(roleId);
  };

  const handleStartGame = () => {
    if (!canStartGame(lobby, currentPlayer, isLocalReady)) return;

    setIsLocalReady(true);
    setPlayerReady();
  };

  const isStartDisabled = !canStartGame(lobby, currentPlayer, isLocalReady);
  const startTooltip = getStartGameTooltip(lobby, currentPlayer, isLocalReady);

  return (
    <div className={styles.container}>
      <PlayerList players={lobby.players} />

      <div className={styles.rolesContainer}>
        <RoleGrid
          availableRoles={lobby.availableRoles}
          selectedRoles={localSelectedRoles}
          onToggleRole={handleToggleRole}
        />

        <StartGameButton
          isReady={isLocalReady}
          isDisabled={isStartDisabled}
          tooltip={startTooltip}
          onStartGame={handleStartGame}
        />
      </div>
    </div>
  );
}
