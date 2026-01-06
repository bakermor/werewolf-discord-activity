import styles from "./StartButton.module.css";

interface StartGameButtonProps {
  isReady: boolean;
  isDisabled: boolean;
  tooltip: string;
  onStartGame: () => void;
}

export function StartGameButton({
  isReady,
  isDisabled,
  tooltip,
  onStartGame,
}: StartGameButtonProps) {
  return (
    <div className={styles.startButtonContainer}>
      {isReady ? (
        <div className={styles.waitingText}>Waiting for players...</div>
      ) : (
        <button
          className={styles.startButton}
          onClick={onStartGame}
          disabled={isDisabled}
          title={tooltip}
        >
          START GAME
        </button>
      )}
    </div>
  );
}
