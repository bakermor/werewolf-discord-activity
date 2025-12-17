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

  useEffect(() => {
    const sdkSetup = async () => {
      try {
        const { auth, lobby, socket } = await setupDiscordSdk();

        console.log("Discord SDK is ready");
        console.log("Auth:", auth);

        setLobby(lobby);
        setSocket(socket);

        // Set up socket event listeners
        socket.on("lobby_state", (state: LobbyState) => {
          setLobby(state);
        });
      } catch (err: any) {
        console.error("Discord SDK setup failed:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    sdkSetup();
  }, []);

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.container}>Error: {error}</div>;
  }

  const playerCount = lobby?.players.length ?? 0;
  const maxPlayers = 5;

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
    </div>
  );
}

export default App;
