import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { E2E } from "./env";

/* Mints a JWT for the seeded user (same payload shape as the backend's
 * authService.signToken: { sub, email, name }) and writes it into a Playwright
 * storageState file as localStorage["nextbnb.token"]. Every test then starts
 * already authenticated, so the real Google OAuth flow never has to run. */
export default function globalSetup() {
  const token = jwt.sign(
    { sub: E2E.USER_ID, email: E2E.USER_EMAIL, name: E2E.USER_NAME },
    E2E.JWT_SECRET,
    { expiresIn: "7d" },
  );

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: E2E.FRONTEND_ORIGIN,
        localStorage: [{ name: "nextbnb.token", value: token }],
      },
    ],
  };

  mkdirSync(path.dirname(E2E.STORAGE_STATE), { recursive: true });
  writeFileSync(E2E.STORAGE_STATE, JSON.stringify(storageState, null, 2));
}
