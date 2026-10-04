/** Saving generated files in the browser (backups). Client only. */

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["{}"], "test.json", { type: "application/json" })] });
  } catch {
    return false;
  }
}

/** Starts a download of the text as a file. */
export function downloadTextFile(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke later: some browsers read the URL asynchronously after the click.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the share sheet with the file (e.g. "Save to Files" on iPhone).
 * Resolves true when shared, false when the user cancelled.
 */
export async function shareTextFile(text: string, fileName: string, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([text], fileName, { type: "application/json" })], title });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false;
    throw error;
  }
}
