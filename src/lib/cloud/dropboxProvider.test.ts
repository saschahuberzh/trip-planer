import { describe, expect, it } from "vitest";
import type { CloudAuthTokens } from "@/lib/domain/types";
import { createDropboxProvider, type TokenStore } from "./dropboxProvider";
import { CloudAuthError, CloudRateLimitError } from "./types";

const NOW = Date.parse("2026-10-05T12:00:00.000Z");

function memoryTokens(initial?: CloudAuthTokens): TokenStore & { value?: CloudAuthTokens } {
  const store: TokenStore & { value?: CloudAuthTokens } = {
    value: initial,
    get: async () => store.value,
    set: async (tokens) => {
      store.value = tokens;
    },
    clear: async () => {
      store.value = undefined;
    },
  };
  return store;
}

type Call = { url: string; init: RequestInit };

/** A fake fetch answering by URL; records every call. */
function fakeFetch(routes: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    const route = Object.keys(routes).find((url) => call.url.startsWith(url));
    if (!route) throw new Error(`Unexpected request ${call.url}`);
    return routes[route](call);
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const valid = (expiresInMs = 3_600_000): CloudAuthTokens => ({
  accessToken: "access-1",
  accessTokenExpiresAt: new Date(NOW + expiresInMs).toISOString(),
  refreshToken: "refresh-1",
});

describe("dropbox provider", () => {
  it("builds a PKCE authorization URL for offline access", () => {
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "https://app.example/settings", tokens: memoryTokens() });
    const url = new URL(provider.authorizationUrl({ state: "s1", codeChallenge: "c1" }));
    expect(url.origin + url.pathname).toBe("https://www.dropbox.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "key",
      response_type: "code",
      redirect_uri: "https://app.example/settings",
      code_challenge: "c1",
      code_challenge_method: "S256",
      token_access_type: "offline",
      state: "s1",
    });
    expect(createDropboxProvider({ appKey: undefined, redirectUri: "x", tokens: memoryTokens() }).configured).toBe(false);
  });

  it("exchanges the code for tokens without a client secret", async () => {
    const tokens = memoryTokens();
    const { fetchImpl, calls } = fakeFetch({
      "https://api.dropboxapi.com/oauth2/token": () => jsonResponse({ access_token: "a", expires_in: 14400, refresh_token: "r" }),
    });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "https://app.example/settings", tokens, fetch: fetchImpl, now: () => NOW });
    await provider.completeAuthorization("code-1", "verifier-1");
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      code_verifier: "verifier-1",
      redirect_uri: "https://app.example/settings",
      client_id: "key",
    });
    expect(tokens.value).toEqual({ accessToken: "a", accessTokenExpiresAt: "2026-10-05T16:00:00.000Z", refreshToken: "r" });
  });

  it("refreshes an expired access token before a request and keeps the refresh token", async () => {
    const tokens = memoryTokens(valid(-1000));
    const { fetchImpl, calls } = fakeFetch({
      "https://api.dropboxapi.com/oauth2/token": () => jsonResponse({ access_token: "access-2", expires_in: 14400 }),
      "https://content.dropboxapi.com/2/files/upload": () => jsonResponse({ name: "b.json", path_lower: "/backups/b.json", size: 3 }),
    });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens, fetch: fetchImpl, now: () => NOW });
    const file = await provider.uploadBackup("b.json", "{}");
    expect(file).toEqual({ path: "/backups/b.json", name: "b.json", size: 3 });
    expect(calls.map((call) => call.url)).toEqual(["https://api.dropboxapi.com/oauth2/token", "https://content.dropboxapi.com/2/files/upload"]);
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer access-2");
    expect(JSON.parse((calls[1].init.headers as Record<string, string>)["Dropbox-API-Arg"])).toEqual({
      path: "/backups/b.json",
      mode: "add",
      autorename: true,
      mute: true,
    });
    expect(tokens.value?.refreshToken).toBe("refresh-1");
  });

  it("retries once with a fresh token after a 401", async () => {
    const tokens = memoryTokens(valid());
    let uploads = 0;
    const { fetchImpl } = fakeFetch({
      "https://api.dropboxapi.com/oauth2/token": () => jsonResponse({ access_token: "access-2", expires_in: 14400 }),
      "https://api.dropboxapi.com/2/users/get_current_account": () =>
        ++uploads === 1 ? new Response("expired", { status: 401 }) : jsonResponse({ name: { display_name: "Sascha" }, email: "s@example.com" }),
    });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens, fetch: fetchImpl, now: () => NOW });
    expect(await provider.account()).toEqual({ name: "Sascha", email: "s@example.com" });
  });

  it("reports a rejected refresh token as an auth error", async () => {
    const { fetchImpl } = fakeFetch({ "https://api.dropboxapi.com/oauth2/token": () => jsonResponse({ error: "invalid_grant" }, 400) });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens: memoryTokens(valid(-1000)), fetch: fetchImpl, now: () => NOW });
    await expect(provider.listBackups()).rejects.toBeInstanceOf(CloudAuthError);
  });

  it("turns a 429 into a rate limit with the Retry-After seconds", async () => {
    const { fetchImpl } = fakeFetch({
      "https://content.dropboxapi.com/2/files/upload": () => new Response("{}", { status: 429, headers: { "Retry-After": "300" } }),
    });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens: memoryTokens(valid()), fetch: fetchImpl, now: () => NOW });
    const error = await provider.uploadBackup("b.json", "{}").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CloudRateLimitError);
    expect((error as CloudRateLimitError).retryAfterSeconds).toBe(300);
  });

  it("lists backups across pages and treats a missing folder as empty", async () => {
    const tokens = memoryTokens(valid());
    const pages = fakeFetch({
      "https://api.dropboxapi.com/2/files/list_folder/continue": () =>
        jsonResponse({ entries: [{ ".tag": "file", name: "b.json", path_lower: "/backups/b.json", size: 2 }], has_more: false, cursor: "c2" }),
      "https://api.dropboxapi.com/2/files/list_folder": () =>
        jsonResponse({
          entries: [
            { ".tag": "file", name: "a.json", path_lower: "/backups/a.json", size: 1 },
            { ".tag": "folder", name: "x", path_lower: "/backups/x" },
          ],
          has_more: true,
          cursor: "c1",
        }),
    });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens, fetch: pages.fetchImpl, now: () => NOW });
    expect((await provider.listBackups()).map((file) => file.name)).toEqual(["a.json", "b.json"]);

    const missing = fakeFetch({ "https://api.dropboxapi.com/2/files/list_folder": () => jsonResponse({ error_summary: "path/not_found/" }, 409) });
    const empty = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens, fetch: missing.fetchImpl, now: () => NOW });
    expect(await empty.listBackups()).toEqual([]);
  });

  it("explains a full Dropbox and forgets tokens on disconnect even offline", async () => {
    const tokens = memoryTokens(valid());
    const { fetchImpl } = fakeFetch({
      "https://content.dropboxapi.com/2/files/upload": () => new Response('{"error_summary":"path/insufficient_space/"}', { status: 409 }),
      "https://api.dropboxapi.com/2/auth/token/revoke": () => {
        throw new TypeError("offline");
      },
    });
    const provider = createDropboxProvider({ appKey: "key", redirectUri: "x", tokens, fetch: fetchImpl, now: () => NOW });
    await expect(provider.uploadBackup("b.json", "{}")).rejects.toThrow("Your Dropbox is full.");
    await provider.disconnect();
    expect(tokens.value).toBeUndefined();
  });
});
