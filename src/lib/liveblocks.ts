import { Liveblocks } from "@liveblocks/node";

let liveblocksClient: Liveblocks | null = null;

export function getLiveblocksClient() {
  if (!liveblocksClient) {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) {
      throw new Error("LIVEBLOCKS_SECRET_KEY is not configured");
    }
    liveblocksClient = new Liveblocks({ secret });
  }
  return liveblocksClient;
}

export function getLiveblocksPublicKey() {
  return process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY ?? "";
}
