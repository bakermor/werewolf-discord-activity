import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface RoleData {
  assignedRole: string;
  currentRole: string;
}

export function useRoleAssignment(socket: Socket | null) {
  const [playerRole, setPlayerRole] = useState<RoleData | null>(null);

  useEffect(() => {
    if (socket) {
      socket.emit("fetch_role");
    }
  }, [socket]);

  // Listen for role_assigned event
  useEffect(() => {
    if (!socket) return;

    const handleRoleAssigned = (data: RoleData) => {
      console.log("Role assigned:", data);
      setPlayerRole(data);
    };

    socket.on("role_assigned", handleRoleAssigned);

    return () => {
      socket.off("role_assigned", handleRoleAssigned);
    };
  }, [socket]);

  return {
    playerRole,
  };
}
