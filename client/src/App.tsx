import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import styles from "./App.module.css";
import type { CurrentUser, LobbyState } from "./discordSetup";
import { setupDiscordSdk } from "./discordSetup";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localSelectedRoles, setLocalSelectedRoles] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLocalReady, setIsLocalReady] = useState(false);

  const getCurrentPlayer = (
    lobby: LobbyState | null,
    userId: string | undefined
  ) => {
    console.log("Current user ID:", userId);
    console.log("Players:", lobby?.players);
    if (!userId || !lobby) return null;
    return lobby.players.find((p) => p.userId === userId);
  };

  useEffect(() => {
    const sdkSetup = async () => {
      try {
        const { auth, lobby, socket, playerData } = await setupDiscordSdk();

        console.log("Discord SDK is ready");
        console.log("Auth:", auth);
        console.log("Lobby:", lobby);

        setLobby(lobby);
        setSocket(socket);

        setCurrentUser(playerData);

        // Set up socket event listeners
        socket.on("lobby_state", (state: LobbyState) => {
          setLobby(state);

          // Reset isLocalReady if the current player's isReady became false
          const player = getCurrentPlayer(state, playerData.userId);
          console.log("Player:", player);
          if (player && !player.isReady) {
            setIsLocalReady(false);
            console.log("Reset isLocalReady to false");
          }
        });
      } catch (error) {
        console.error("Discord SDK setup failed:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    sdkSetup();
    console.log("Socket:", socket);
  }, []);

  useEffect(() => {
    if (lobby?.selectedRoles) {
      setLocalSelectedRoles(lobby.selectedRoles);
    }
  }, [lobby?.selectedRoles]);

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.container}>Error: {error}</div>;
  }

  const playerCount = lobby?.players.length ?? 0;
  const minPlayers = 3;
  const maxPlayers = 5;

  const handleToggleRole = (roleId: string) => {
    setLocalSelectedRoles((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((id) => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });

    socket?.emit("toggle_role", { roleId });
  };

  const isButtonDisabled = () => {
    const currentPlayer = getCurrentPlayer(lobby, currentUser?.userId);

    if (isLocalReady || currentPlayer?.isReady) {
      return true;
    }

    if (playerCount < minPlayers || playerCount > maxPlayers) {
      return true;
    }

    if (!lobby?.isRoleConfigValid) {
      return true;
    }

    return false;
  };

  const getDisabledTooltip = () => {
    const currentPlayer = getCurrentPlayer(lobby, currentUser?.userId);

    if (isLocalReady || currentPlayer?.isReady) {
      return "";
    }

    if (playerCount < minPlayers || playerCount > maxPlayers) {
      return `Need ${minPlayers}-${maxPlayers} players to start the game`;
    }

    if (!lobby?.isRoleConfigValid) {
      return `Need exactly ${playerCount + 3} roles to start the game`;
    }

    return "";
  };

  const handleStartGame = () => {
    const currentPlayer = getCurrentPlayer(lobby, currentUser?.userId);

    if (isLocalReady || currentPlayer?.isReady) {
      return;
    }
    setIsLocalReady(true);

    socket?.emit("player_ready");
  };

  return (
    <div className={styles.container}>
      <div className={styles.playersPanel}>
        <h2 className={styles.playersHeader}>
          Players ({playerCount}/{maxPlayers})
        </h2>
        {lobby && lobby.players.length > 0 ? (
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
            {lobby?.availableRoles?.map((role) => (
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
          {isLocalReady ||
          getCurrentPlayer(lobby, currentUser?.userId)?.isReady ? (
            <div className={styles.waitingText}>Waiting for players...</div>
          ) : (
            <button
              className={styles.startButton}
              onClick={handleStartGame}
              disabled={isButtonDisabled()}
              title={getDisabledTooltip()}
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
