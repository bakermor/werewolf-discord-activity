import { Role } from "../../types/lobby.types";
import { RoleCard } from "./RoleCard";
import styles from "./RoleGrid.module.css";

interface RoleGridProps {
  availableRoles: Role[];
  selectedRoles: string[];
  onToggleRole: (roleId: string) => void;
}

export function RoleGrid({
  availableRoles,
  selectedRoles,
  onToggleRole,
}: RoleGridProps) {
  return (
    <div className={styles.rolesPanel}>
      <h2 className={styles.rolesHeader}>Select Roles</h2>
      <div className={styles.rolesGrid}>
        {availableRoles?.map((role) => (
          <RoleCard
            key={role.id}
            roleId={role.id}
            roleName={role.name}
            isSelected={selectedRoles.includes(role.id)}
            onToggle={onToggleRole}
          />
        ))}
      </div>
    </div>
  );
}
