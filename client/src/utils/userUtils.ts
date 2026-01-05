import { Auth, CurrentUser } from "../types/lobby.types";

export function createPlayerData(auth: Auth): CurrentUser {
  const { user } = auth;

  return {
    userId: user.id,
    username: user.global_name ?? `${user.username}#${user.discriminator}`,
    avatar: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${
          (BigInt(user.id) >> 22n) % 6n
        }.png`,
  };
}

export function getUserDisplayName(user: Auth["user"]): string {
  return user.global_name ?? `${user.username}#${user.discriminator}`;
}

export function getUserAvatarUrl(user: Auth["user"]): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
  }

  const defaultAvatarIndex = (BigInt(user.id) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
}
