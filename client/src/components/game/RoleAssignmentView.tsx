import { PhaseEndTransition } from "./PhaseEndTransition";
import styles from "./RoleAssignmentView.module.css";

export function RoleAssignmentView() {
  return (
    <div>
      <PhaseEndTransition />
      <div className={styles.textContainer}>
        <h1 className={styles.gameStartText}>GAME START</h1>
      </div>
    </div>
  );
}
