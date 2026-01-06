import { MAX_PLAYERS, Player } from "../../types/lobby.types";
import { PlayerCard } from "./PlayerCard";
import styles from "./PlayerList.module.css";

interface PlayerListProps {
  players: Player[];
}

export function PlayerList({ players }: PlayerListProps) {
  const playerCount = players.length;

  return (
    <div className={styles.playersPanel}>
      <h2 className={styles.playersHeader}>
        Players ({playerCount}/{MAX_PLAYERS})
      </h2>
      {players.length > 0 ? (
        <div className={styles.playersList}>
          {players.map((player) => (
            <PlayerCard
              key={player.userId}
              username={player.username}
              avatar={player.avatar}
            />
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>Waiting for players to join...</p>
      )}
    </div>
  );
}
