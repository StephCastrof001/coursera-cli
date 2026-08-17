/**
 * Error vocabulary. Agents read `code` and `hint` to self-correct instead of
 * parsing prose.
 *
 * The distinction that matters here comes straight from the recon: a 200 that
 * returns HTML means the route is gone or the request was malformed — NOT that
 * the session died. A dead session is 401/403. Confusing them sends you to
 * re-login when the real fix was the URL.
 */
import { AppError, type ErrorMap } from "./cli/foundation/error-map.ts";

export { AppError };

export const ERRORS: ErrorMap = {
  NO_SESSION: {
    name: "NoSession",
    human: "No Coursera session found.",
    hint: "Set COURSERA_CAUTH, or capture one with capture_session.py from the coursera_recon repo.",
  },
  SESSION_EXPIRED: {
    name: "SessionExpired",
    human: "The CAUTH cookie is invalid or expired.",
    hint: "Capture a fresh session. The cookie lasts days, not hours.",
  },
  ROUTE_GONE: {
    name: "RouteGone",
    human: "Coursera answered 200 with HTML instead of JSON: the route is gone or the request was malformed.",
    hint: "This is not a session problem. Check the route in endpoints.json.",
  },
  NOT_FOUND: {
    name: "NotFound",
    human: "Coursera has no record with that id or slug.",
    hint: "Find the right slug with: coursera courses --search <text>",
  },
  NETWORK: {
    name: "NetworkError",
    human: "Could not reach coursera.org.",
    hint: "Check connectivity and retry.",
  },
  HTTP_ERROR: {
    name: "HttpError",
    human: "Coursera returned an unexpected status.",
    hint: "Retry; if it persists the endpoint may have changed.",
  },
  NOT_DOWNLOADED: {
    name: "NotDownloaded",
    human: "That course has not been downloaded yet.",
    hint: "Run: coursera transcript <slug>",
  },
  MISSING_ARGUMENT: {
    name: "MissingArgument",
    human: "A required argument is missing.",
    hint: "Run: coursera --help",
  },
};

export function fail(code: keyof typeof ERRORS | string, cause?: unknown): never {
  const entry = ERRORS[code] ?? ERRORS.HTTP_ERROR;
  throw new AppError(String(code), entry as { name: string; human: string; hint?: string }, cause);
}
