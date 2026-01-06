import styles from "./RoleCard.module.css";

interface RoleCardProps {
  roleId: string;
  roleName: string;
  isSelected: boolean;
  onToggle: (roleId: string) => void;
}

export function RoleCard({
  roleId,
  roleName,
  isSelected,
  onToggle,
}: RoleCardProps) {
  return (
    <div
      className={`${styles.roleCard} ${
        isSelected ? styles.roleCardActive : styles.roleCardInactive
      }`}
      data-testid="role-card"
      onClick={() => onToggle(roleId)}
    >
      <div className={styles.rolePlaceholder} data-testid="role-placeholder">
        ?
      </div>
      <span className={styles.roleName}>{roleName}</span>
    </div>
  );
}
