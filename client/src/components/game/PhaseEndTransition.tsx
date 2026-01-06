import styles from "./PhaseEndTransition.module.css";

export function PhaseEndTransition() {
  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label="Game is starting"
    >
      <div className={`${styles.overlay} ${styles.fadeFromTop}`} />
      
    </div>
  );
}
