import { Socket } from "socket.io-client";
import { useRoleActions } from "../../hooks/useRoleActions";
import { useRoleAnimation } from "../../hooks/useRoleAnimation";
import { useRoleAssignment } from "../../hooks/useRoleAssignment";
import { getRoleDisplayName } from "../../utils/roleUtils";
import { PhaseEndTransition } from "./PhaseEndTransition";
import styles from "./RoleAssignmentView.module.css";
import { RoleRevealCard } from "./RoleRevealCard";

interface RoleAssignmentViewProps {
  socket: Socket | null;
}

export function RoleAssignmentView({ socket }: RoleAssignmentViewProps) {
  const { playerRole } = useRoleAssignment(socket);
  const { animationPhase } = useRoleAnimation(playerRole);
  const { isReady, setPlayerReady } = useRoleActions(socket);

  const handleReadyClick = () => {
    setPlayerReady();
  };

  return (
    <div className={styles.container}>
      <PhaseEndTransition />
      
      {playerRole && animationPhase !== "idle" && (
        <div className={styles.cardContainer}>
          <RoleRevealCard
            roleName={getRoleDisplayName(playerRole.assignedRole)}
            animationPhase={animationPhase}
          />
        </div>
      )}

      {animationPhase === "revealed" && !isReady && (
        <div className={styles.buttonContainer}>
          <button className={styles.readyButton} onClick={handleReadyClick}>
            READY
          </button>
        </div>
      )}

      {isReady && (
        <div className={styles.waitingContainer}>
          <p className={styles.waitingText}>Waiting for other players...</p>
        </div>
      )}
    </div>
  );
}
