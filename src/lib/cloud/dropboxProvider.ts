/**
 * Dropbox implementation of CloudBackupProvider: OAuth 2 with PKCE in the browser (no client
 * secret, no backend) and the HTTP API. The app gets an "App folder" only: it sees nothing
 * but Apps/<app name>/ in the user's Dropbox. Backups live in /backups there.
 */
import type { CloudAuthTokens } from "@/lib/domain/types";
import {
  CloudAuthError,
  CloudRateLimitError,
  CloudRequestError,
  type CloudAccount,
  type CloudBackupFile,
  type CloudBackupProvider,
} from "./types";

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API = "https://api.dropboxapi.com/2";
const CONTENT = "https://content.dropboxapi.com/2";
const FOLDER = "/backups";
/** Refresh a little before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export interface TokenStore {
  get(): Promise<CloudAuthTokens | undefined>;
  set(tokens: CloudAuthTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface DropboxOptions {
  appKey: string | undefined;
  redirectUri: string;
  tokens: TokenStore;
  fetch?: typeof fetch;
  now?: () => number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/** Dropbox-API-Arg must be ASCII: escape everything else as \uXXXX. */
function apiArg(value: object): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function createDropboxProvider({ appKey, redirectUri, tokens, fetch: fetchImpl = fetch, now = Date.now }: DropboxOptions): CloudBackupProvider {
  const http = (input: string, init: RequestInit) => fetchImpl(input, init);

  async function failure(response: Response, what: string): Promise<never> {
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      throw new CloudRateLimitError(Number.isFinite(seconds) && seconds > 0 ? seconds : 60);
    }
    const text = await response.text().catch(() => "");
    if (response.status === 401) throw new CloudAuthError();
    if (text.includes("insufficient_space")) throw new CloudRequestError("Your Dropbox is full.", response.status);
    throw new CloudRequestError(`${what} failed (${response.status}).`, response.status);
  }

  async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    if (!appKey) throw new CloudRequestError("Dropbox isn't set up for this installation.");
    const response = await http(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, client_id: appKey }),
    });
    // An invalid or revoked refresh token / code: the user has to sign in again.
    if (response.status === 400 || response.status === 401) throw new CloudAuthError();
    if (!response.ok) await failure(response, "Signing in to Dropbox");
    return (await response.json()) as TokenResponse;
  }

  async function storeTokens(response: TokenResponse, refreshToken: string): Promise<CloudAuthTokens> {
    const stored: CloudAuthTokens = {
      accessToken: response.access_token,
      accessTokenExpiresAt: new Date(now() + response.expires_in * 1000).toISOString(),
      refreshToken: response.refresh_token ?? refreshToken,
    };
    await tokens.set(stored);
    return stored;
  }

  async function accessToken(forceRefresh = false): Promise<string> {
    const current = await tokens.get();
    if (!current) throw new CloudAuthError();
    if (!forceRefresh && new Date(current.accessTokenExpiresAt).getTime() - EXPIRY_MARGIN_MS > now()) return current.accessToken;
    const refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: current.refreshToken });
    return (await storeTokens(refreshed, current.refreshToken)).accessToken;
  }

  /** An authorized request; an expired access token is refreshed and the request retried once. */
  async function call(url: string, init: RequestInit, what: string): Promise<Response> {
    for (const forceRefresh of [false, true]) {
      const token = await accessToken(forceRefresh);
      let response: Response;
      try {
        response = await http(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
      } catch {
        throw new CloudRequestError("Dropbox can't be reached. Check the internet connection.");
      }
      if (response.status === 401 && !forceRefresh) continue;
      if (!response.ok) return failure(response, what);
      return response;
    }
    throw new CloudAuthError();
  }

  const json = (body: object): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return {
    id: "dropbox",
    label: "Dropbox",
    configured: Boolean(appKey),

    authorizationUrl({ state, codeChallenge }) {
      const params = new URLSearchParams({
        client_id: appKey ?? "",
        response_type: "code",
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        // A refresh token: the app stays connected until the user disconnects.
        token_access_type: "offline",
        state,
      });
      return `${AUTHORIZE_URL}?${params.toString()}`;
    },

    async completeAuthorization(code, codeVerifier) {
      const response = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri });
      if (!response.refresh_token) throw new CloudRequestError("Dropbox didn't grant lasting access.");
      await storeTokens(response, response.refresh_token);
    },

    async isConnected() {
      return (await tokens.get()) !== undefined;
    },

    async account(): Promise<CloudAccount> {
      const response = await call(`${API}/users/get_current_account`, { method: "POST" }, "Reading the Dropbox account");
      const body = (await response.json()) as { name?: { display_name?: string }; email?: string };
      return { name: body.name?.display_name ?? "Dropbox", email: body.email };
    },

    async disconnect() {
      const current = await tokens.get();
      await tokens.clear();
      if (!current) return;
      try {
        await http(`${API}/auth/token/revoke`, { method: "POST", headers: { Authorization: `Bearer ${current.accessToken}` } });
      } catch {
        // Offline or already revoked: forgetting the tokens locally is what matters.
      }
    },

    async uploadBackup(name, content) {
      const response = await call(
        `${CONTENT}/files/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": apiArg({ path: `${FOLDER}/${name}`, mode: "add", autorename: true, mute: true }),
          },
          body: content,
        },
        "Uploading the backup",
      );
      const body = (await response.json()) as { name: string; path_lower: string; size: number };
      return { path: body.path_lower, name: body.name, size: body.size };
    },

    async listBackups() {
      const files: CloudBackupFile[] = [];
      let response: Response;
      try {
        response = await call(`${API}/files/list_folder`, json({ path: FOLDER }), "Listing backups");
      } catch (error) {
        // The folder doesn't exist before the first backup.
        if (error instanceof CloudRequestError && error.status === 409) return [];
        throw error;
      }
      for (;;) {
        const body = (await response.json()) as {
          entries: { ".tag": string; name: string; path_lower: string; size?: number }[];
          has_more: boolean;
          cursor: string;
        };
        for (const entry of body.entries) {
          if (entry[".tag"] === "file") files.push({ path: entry.path_lower, name: entry.name, size: entry.size ?? 0 });
        }
        if (!body.has_more) return files;
        response = await call(`${API}/files/list_folder/continue`, json({ cursor: body.cursor }), "Listing backups");
      }
    },

    async downloadBackup(file) {
      const response = await call(
        `${CONTENT}/files/download`,
        { method: "POST", headers: { "Dropbox-API-Arg": apiArg({ path: file.path }) } },
        "Downloading the backup",
      );
      return response.text();
    },

    async deleteBackup(file) {
      await call(`${API}/files/delete_v2`, json({ path: file.path }), "Deleting an old backup");
    },
  };
}
