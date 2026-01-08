import { useEffect, useState } from "react";

export type AnimationPhase = "idle" | "sliding" | "flipping" | "revealed";

interface RoleData {
  assignedRole: string;
  currentRole: string;
}

export function useRoleAnimation(playerRole: RoleData | null) {
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("idle");

  useEffect(() => {
    if (!playerRole) return;
    const slideTimer = setTimeout(() => {
      setAnimationPhase("sliding");

      const flipTimer = setTimeout(() => {
        setAnimationPhase("flipping");

          const revealTimer = setTimeout(() => {
            setAnimationPhase("revealed");
          }, 600);

          return () => clearTimeout(revealTimer);
      }, 800);

      return () => clearTimeout(flipTimer);
    }, 2500);

    return () => clearTimeout(slideTimer);
  }, [playerRole]);

  return {
    animationPhase,
  };
}
