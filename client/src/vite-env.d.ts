/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCORD_CLIENT_ID: string;
  // add env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
