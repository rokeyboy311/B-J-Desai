import { db } from '../../db/index.ts';
import { securitySettings } from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import { timingSafeCompare } from '../middleware/auth.ts';

export const UNIVERSAL_PASSWORD_KEY = 'APP_UNIVERSAL_PASSWORD';
export const DEFAULT_UNIVERSAL_PASSWORD = 'Bh@ju1204';

/**
 * Initializes and guarantees that strictly ONLY 1 password exists in the database.
 * Deletes all obsolete/duplicate PIN/password keys (APP_MASTER_PIN, CATEGORY_LOCK_PIN, etc.)
 * and sets the single universal password to 'Bh@ju1204' (or preserves it if already configured).
 */
export async function initializeSinglePasswordInDB(): Promise<string> {
  try {
    // Check if universal password exists in the database
    const existing = await db
      .select()
      .from(securitySettings)
      .where(eq(securitySettings.key, UNIVERSAL_PASSWORD_KEY));

    let activePassword = DEFAULT_UNIVERSAL_PASSWORD;

    if (existing.length > 0 && existing[0].value) {
      activePassword = existing[0].value.trim();
    }

    // Clean up all obsolete/duplicate keys so ONLY 1 password record remains in the database
    await db
      .delete(securitySettings)
      .where(sql`${securitySettings.key} != ${UNIVERSAL_PASSWORD_KEY}`);

    // Ensure the single password record exists in security_settings
    await db
      .insert(securitySettings)
      .values({
        key: UNIVERSAL_PASSWORD_KEY,
        value: activePassword,
        description: 'Single Universal Password for Login, Categories, and Deletion Verification',
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: securitySettings.key,
        set: { value: activePassword, updatedAt: new Date() }
      });

    console.log(`[Security] Universal password active in database (Key: ${UNIVERSAL_PASSWORD_KEY})`);
    return activePassword;
  } catch (err) {
    console.error('[Security] Failed to initialize single password in database:', err);
    return DEFAULT_UNIVERSAL_PASSWORD;
  }
}

/**
 * Directly queries the database to retrieve the current single active password.
 * Satisfies instruction: "verification mate database ma jai ne check kare and pachi access ape"
 */
export async function getUniversalPasswordFromDB(): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(securitySettings)
      .where(eq(securitySettings.key, UNIVERSAL_PASSWORD_KEY));

    if (rows.length > 0 && rows[0].value) {
      return rows[0].value.trim();
    }

    // If table was empty or missing key, initialize and return active password
    return await initializeSinglePasswordInDB();
  } catch (err) {
    console.error('[Security] Failed to query database for universal password:', err);
    return DEFAULT_UNIVERSAL_PASSWORD;
  }
}

/**
 * Checks a provided password directly against the database password using timing-safe comparison.
 */
export async function verifyPasswordAgainstDB(inputPassword: string): Promise<boolean> {
  if (!inputPassword || typeof inputPassword !== 'string') return false;
  const dbPassword = await getUniversalPasswordFromDB();
  return timingSafeCompare(inputPassword.trim(), dbPassword);
}

/**
 * Updates the single universal password in the database, ensuring strictly 1 row remains.
 */
export async function updateUniversalPasswordInDB(newPassword: string): Promise<void> {
  const cleanPassword = newPassword.trim();
  // Wipe all existing keys so only 1 record remains in DB
  await db.delete(securitySettings);
  await db.insert(securitySettings).values({
    key: UNIVERSAL_PASSWORD_KEY,
    value: cleanPassword,
    description: 'Single Universal Password for Login, Categories, and Deletion Verification',
    updatedAt: new Date()
  });
  console.log(`[Security] Single password updated in database.`);
}
