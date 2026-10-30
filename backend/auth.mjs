import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString("hex");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key || !/^[0-9a-f]{128}$/i.test(key)) {
    // Bozuk kayıt: zamanlamayı eşitlemek için yine de hash hesaplanır.
    await scrypt(String(password), "invalid-salt", 64);
    return false;
  }
  const hash = await scrypt(password, salt, 64);
  return timingSafeEqual(hash, Buffer.from(key, "hex"));
}
export function cookieValue(req) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("budget_session="))
      ?.slice(15) || ""
  );
}
