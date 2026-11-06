const CHANNEL = "reelmark-store";

/** After an admin save, tell other open storefront tabs in this browser to reload their data. */
export function announceStoreUpdate() {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("updated");
    channel.close();
  } catch {
    // Older browsers: other tabs simply pick up changes on their next page load.
  }
}

export function onStoreUpdate(callback: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => callback();
  return () => channel.close();
}
