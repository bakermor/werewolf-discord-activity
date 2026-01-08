import styles from "./RoleRevealCard.module.css";

interface RoleRevealCardProps {
  roleName: string;
  animationPhase: "idle" | "sliding" | "flipping" | "revealed";
}

export function RoleRevealCard({
  roleName,
  animationPhase,
}: RoleRevealCardProps) {
  const getAnimationClass = () => {
    switch (animationPhase) {
      case "sliding":
        return styles.sliding;
      case "flipping":
        return styles.flipping;
      case "revealed":
        return styles.revealed;
      default:
        return "";
    }
  };

  return (
    <div className={`${styles.cardContainer} ${getAnimationClass()}`}>
      <div className={styles.cardInner}>
        <div className={styles.cardBack}>
          <div className={styles.cardBackPattern}>?</div>
        </div>
        <div className={styles.cardFront}>
          <div className={styles.roleName}>{roleName}</div>
          <div className={styles.roleImagePlaceholder}>
            <span className={styles.roleInitial}>
              {roleName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
