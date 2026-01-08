import styles from "./App.module.css";
import { NightView } from "./components/game/NightView";
import { RoleAssignmentView } from "./components/game/RoleAssignmentView";
import { LobbyView } from "./components/lobby/LobbyView";
import { useLobby } from "./hooks/useLobby";

function App() {
  const { isLoading, error, lobby, socket, currentUser } = useLobby();

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.container}>Error: {error}</div>;
  }

  if (!lobby) {
    return <div className={styles.container}>No lobby data available</div>;
  }

  if (lobby.gamePhase === "lobby") {
    return (
      <LobbyView lobby={lobby} socket={socket} currentUser={currentUser} />
    );
  }

  if (lobby.gamePhase === "role_assignment") {
    return <RoleAssignmentView socket={socket} />;
  }

  if (lobby.gamePhase === "night") {
    return <NightView socket={socket} />;
  }

  return null;
}

export default App;
