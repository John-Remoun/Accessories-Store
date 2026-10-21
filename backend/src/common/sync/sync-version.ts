let currentVersion = Date.now().toString();

export function getSyncVersion(): string {
  return currentVersion;
}

export function bumpSyncVersion(): string {
  currentVersion = Date.now().toString();
  return currentVersion;
}
