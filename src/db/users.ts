import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name: name || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.warn("Failed to sync user to PostgreSQL, returning fallback memory user:", error);
    return {
      id: 1,
      uid,
      email: email || 'system@bd-accounting.local',
      name: name || 'B_D Accounting User',
      createdAt: new Date()
    };
  }
}
