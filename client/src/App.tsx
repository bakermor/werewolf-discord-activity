import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import styles from "./App.module.css";
import type { LobbyState } from "./discordSetup";
import { setupDiscordSdk } from "./discordSetup";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localSelectedRoles, setLocalSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    const sdkSetup = async () => {
      try {
        const { auth, lobby, socket } = await setupDiscordSdk();

        console.log("Discord SDK is ready");
        console.log("Auth:", auth);
        console.log("Lobby:", lobby);

        setLobby(lobby);
        setSocket(socket);

        // Set up socket event listeners
        socket.on("lobby_state", (state: LobbyState) => {
          setLobby(state);
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
    </div>
  );
}

export default App;
