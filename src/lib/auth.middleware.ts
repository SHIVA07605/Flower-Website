import { createMiddleware } from "@tanstack/react-start";

import { getAuthHeaders } from "./auth-token";

/**
 * Sends the signed-in shopper's ID token with a server-function call and, on the server,
 * verifies it into `context.viewer` (null for guests). What a viewer may do is always
 * decided on the server — never by the browser.
 */
export const viewerMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => next({ headers: await getAuthHeaders() }))
  .server(async ({ next }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { resolveViewer } = await import("./server/viewer.server");
    const viewer = await resolveViewer(
      getRequestHeader("authorization"),
      getRequestHeader("x-auth-provider"),
    );
    return next({ context: { viewer } });
  });
