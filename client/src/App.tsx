import { useState, useEffect } from "react";
import styles from "./App.module.css";
import { useLobby } from "./hooks/useLobby";
import { useLobbyActions } from "./hooks/useLobbyActions";
import { usePlayerState } from "./hooks/usePlayerState";
import { canStartGame, getStartGameTooltip } from "./utils/lobbyUtils";
import { MAX_PLAYERS } from "./types/lobby.types";

function App() {
  const { isLoading, error, lobby, socket, currentUser } = useLobby();
  const { toggleRole, setPlayerReady } = useLobbyActions(socket);
  const { currentPlayer, isLocalReady, setIsLocalReady } = usePlayerState(
    lobby,
    currentUser?.userId
  );

  const [localSelectedRoles, setLocalSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (lobby?.selectedRoles) {
      setLocalSelectedRoles(lobby.selectedRoles);
    }
  }, [lobby?.selectedRoles]);

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

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.container}>Error: {error}</div>;
  }

  if (!lobby) {
    return <div className={styles.container}>No lobby data available</div>;
  }

  const playerCount = lobby.players.length;
  const isStartDisabled = !canStartGame(lobby, currentPlayer, isLocalReady);
  const startTooltip = getStartGameTooltip(lobby, currentPlayer, isLocalReady);

  return (
    <div className={styles.container}>
      <div className={styles.playersPanel}>
        <h2 className={styles.playersHeader}>
          Players ({playerCount}/{MAX_PLAYERS})
        </h2>
        {lobby.players.length > 0 ? (
          <div className={styles.playersList}>
            {lobby.players.map((player) => (
              <div key={player.userId} className={styles.playerItem}>
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={`${player.username}'s avatar`}
                    className={styles.playerAvatar}
                  />
                ) : (
                  <div
                    className={styles.playerAvatar}
                    data-testid="avatar-placeholder"
                  >
                    {player.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className={styles.playerName}>{player.username}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>Waiting for players to join...</p>
        )}
      </div>

      <div className={styles.rolesContainer}>
        <div className={styles.rolesPanel}>
          <h2 className={styles.rolesHeader}>Select Roles</h2>
          <div className={styles.rolesGrid}>
            {lobby.availableRoles?.map((role) => (
              <div
                key={role.id}
                className={`${styles.roleCard} ${
                  localSelectedRoles.includes(role.id)
                    ? styles.roleCardActive
                    : styles.roleCardInactive
                }`}
                data-testid="role-card"
                onClick={() => handleToggleRole(role.id)}
              >
                <div
                  className={styles.rolePlaceholder}
                  data-testid="role-placeholder"
                >
                  ?
                </div>
                <span className={styles.roleName}>{role.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.startButtonContainer}>
          {isLocalReady || currentPlayer?.isReady ? (
            <div className={styles.waitingText}>Waiting for players...</div>
          ) : (
            <button
              className={styles.startButton}
              onClick={handleStartGame}
              disabled={isStartDisabled}
              title={startTooltip}
            >
              START GAME
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
