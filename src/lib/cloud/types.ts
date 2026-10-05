/**
 * Cloud backup abstraction (TECH_STACK.md "Cloud"). The app only talks to this interface;
 * a provider (currently Dropbox) is an implementation detail. Cloud backup is optional:
 * the app works the same without it, and local IndexedDB stays the source of truth.
 */

export interface CloudAccount {
  name: string;
  email?: string;
}

/** One backup file in the cloud. */
export interface CloudBackupFile {
  /** Provider path or ID used to download/delete it. */
  path: string;
  name: string;
  size: number;
}

/** Thrown when the provider no longer accepts the stored sign-in (e.g. access revoked). */
export class CloudAuthError extends Error {
  constructor(message = "The cloud account needs to be connected again.") {
    super(message);
    this.name = "CloudAuthError";
  }
}

/** Any other provider failure (network, storage full, unexpected response). */
export class CloudRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CloudRequestError";
  }
}

/**
 * The provider asks the app to slow down (Dropbox: HTTP 429 with Retry-After). Free Dropbox
 * accounts have no monthly call limit, only this per-user rate limit.
 */
export class CloudRateLimitError extends CloudRequestError {
  constructor(readonly retryAfterSeconds: number) {
    super("Dropbox asked to wait a moment before the next backup.", 429);
    this.name = "CloudRateLimitError";
  }
}

export interface CloudBackupProvider {
  readonly id: "dropbox";
  readonly label: string;
  /** false when the installation has no provider configuration (e.g. no app key). */
  readonly configured: boolean;
  /** The provider's sign-in page; the browser navigates there and comes back to `redirectUri`. */
  authorizationUrl(params: { state: string; codeChallenge: string }): string;
  /** Exchanges the code from the redirect for tokens and stores them. */
  completeAuthorization(code: string, codeVerifier: string): Promise<void>;
  isConnected(): Promise<boolean>;
  account(): Promise<CloudAccount>;
  /** Revokes and forgets the stored sign-in (best effort revoke). */
  disconnect(): Promise<void>;
  uploadBackup(name: string, json: string): Promise<CloudBackupFile>;
  /** All backups of this app, any order. */
  listBackups(): Promise<CloudBackupFile[]>;
  downloadBackup(file: CloudBackupFile): Promise<string>;
  deleteBackup(file: CloudBackupFile): Promise<void>;
}
