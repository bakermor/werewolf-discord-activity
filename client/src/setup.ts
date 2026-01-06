import { DiscordService } from "./services/DiscordService";
import { SocketService } from "./services/SocketService";
import { createPlayerData } from "./utils/userUtils";
import { SetupResult } from "./types/lobby.types";

export async function setupDiscordSdk(): Promise<SetupResult> {
  try {
    const discordService = new DiscordService();
    const socketService = new SocketService();

    await discordService.initialize();
    const code = await discordService.authorize();
    const accessToken = await discordService.getToken(code);
    const auth = await discordService.authenticate(accessToken);

    const instanceId = discordService.getInstanceId();
    const playerData = createPlayerData(auth);

    const socket = socketService.createConnection();
    const lobby = await socketService.joinLobby(socket, instanceId, playerData);

    return { auth, lobby, socket, playerData };
  } catch (error) {
    console.error("Discord SDK setup failed:", error);
    throw error;
  }
}
