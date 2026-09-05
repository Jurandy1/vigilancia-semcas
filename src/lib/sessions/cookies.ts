import { hashSessionToken } from "./tokens";

export function hashTokenForLookup(token: string): string {
  return hashSessionToken(token);
}
