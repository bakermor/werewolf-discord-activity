import { Socket } from "socket.io-client";
import styles from "./NightView.module.css";

interface NightViewProps {
  socket: Socket | null;
}

export function NightView({ socket }: NightViewProps) {
  console.log(socket);
  return (
    <div className={styles.container}>
      <h1>Night View</h1>
    </div>
  );
}
