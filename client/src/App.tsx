import { useState, useEffect } from "react";
import { setupDiscordSdk } from "./discordSetup";
import styles from "./App.module.css";
import rocketLogo from "/logo.png";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setupDiscordSdk()
      .then(() => {
        console.log("Discord SDK is ready");
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Discord SDK setup failed:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.container}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <img src={rocketLogo} className={styles.logo} alt="Discord" />
      <h1>Hello, World!</h1>
    </div>
  );
}

export default App;
