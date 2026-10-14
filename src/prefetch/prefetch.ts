/**
 * pageturn/prefetch: asks the browser for a page about to be opened, once per address.
 * Imported for its effect; the full pageturn entry includes it.
 */
import { registry } from "../common/registry.ts";

const asked = new Set<string>();

interface Connection {
  saveData?: boolean;
  effectiveType?: string;
}

registry.prefetcher ??= (to: URL): void => {
  const address = to.href.split("#")[0] ?? to.href;
  if (asked.has(address)) return;
  const connection = (navigator as Navigator & { connection?: Connection })
    .connection;
  // Not on a connection the visitor asked to spare, nor on one too slow to spare.
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) {
    return;
  }
  asked.add(address);
  const link = document.createElement("link");
  if (link.relList.supports("prefetch")) {
    link.rel = "prefetch";
    link.href = address;
    document.head.append(link);
  } else {
    // Safari has no prefetch: a fetch of low priority fills the cache instead.
    fetch(address, { priority: "low" }).catch(() => {});
  }
};
