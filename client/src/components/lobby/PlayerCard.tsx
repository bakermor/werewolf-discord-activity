import styles from "./PlayerCard.module.css";

interface PlayerCardProps {
  username: string;
  avatar: string | null;
}

export function PlayerCard({ username, avatar }: PlayerCardProps) {
  return (
    <div className={styles.playerItem}>
      {avatar ? (
        <img
          src={avatar}
          alt={`${username}'s avatar`}
          className={styles.playerAvatar}
        />
      ) : (
        <div className={styles.playerAvatar} data-testid="avatar-placeholder">
          {username.charAt(0).toUpperCase()}
        </div>
      )}
      <span className={styles.playerName}>{username}</span>
    </div>
  );
}
