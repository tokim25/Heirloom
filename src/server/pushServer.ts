import { cert, getApp, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { Household, ShareInvite, User } from '../types/recipe.ts';
import { dateKeyInZone, dinnerMessage, inboxMessage, PushMessage, wantsPush } from '../utils/pushMessages.ts';
import { planToList } from '../utils/mealPlan.ts';
import { stockToList } from '../utils/stock.ts';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

/**
 * Sends push notifications. It needs a Firebase service account (FIREBASE_SERVICE_ACCOUNT, the JSON file's
 * contents, optionally base64) so the server may read other people's tokens and send through Firebase Cloud
 * Messaging. Without it every function here reports "not configured" and nothing is sent.
 */

export interface PushBackend {
  db: Firestore;
  messaging: Messaging;
}

let cached: PushBackend | null | undefined;

export function getPushBackend(): PushBackend | null {
  if (cached !== undefined) return cached;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return (cached = null);
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const credentials = JSON.parse(text);
    const app: App = getApps().length
      ? getApp()
      : initializeApp({ credential: cert(credentials), projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId });
    const databaseId = firebaseConfig.firestoreDatabaseId;
    cached = { db: databaseId ? getFirestore(app, databaseId) : getFirestore(app), messaging: getMessaging(app) };
  } catch (err) {
    console.error('[Push] FIREBASE_SERVICE_ACCOUNT could not be read:', err instanceof Error ? err.message : err);
    cached = null;
  }
  return cached;
}

const DEAD_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

/** Sends one message to every device a person registered; forgets devices Firebase says no longer exist. */
export async function sendToUser(backend: PushBackend, uid: string, user: User, message: PushMessage): Promise<number> {
  const entries = Object.entries(user.pushTokens ?? {});
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    entries.map(async ([key, device]) => {
      try {
        await backend.messaging.send({
          token: device.token,
          // Data only: the app's service worker builds the notification, so tapping it can open the right screen.
          data: { title: message.title, body: message.body, url: message.url, tag: message.tag },
          webpush: { headers: { Urgency: 'high', TTL: '86400' } },
        });
        sent += 1;
      } catch (err: any) {
        if (DEAD_TOKEN_CODES.includes(err?.code)) dead.push(key);
        else console.warn('[Push] send failed:', err?.code || err?.message);
      }
    })
  );
  if (dead.length > 0) {
    const updates: Record<string, unknown> = {};
    dead.forEach((key) => (updates[`pushTokens.${key}`] = FieldValue.delete()));
    if (dead.length === entries.length) updates.pushEnabled = false;
    await backend.db.collection('users').doc(uid).update(updates).catch(() => undefined);
  }
  return sent;
}

export type InboxPushResult = 'sent' | 'not_configured' | 'not_found' | 'forbidden' | 'no_recipient' | 'declined' | 'already_sent';

/** Notifies the person an invite was addressed to. Only the sender of that invite may trigger it, once. */
export async function pushInboxInvite(callerUid: string, inviteId: string): Promise<InboxPushResult> {
  const backend = getPushBackend();
  if (!backend) return 'not_configured';
  const inviteRef = backend.db.collection('shareInvites').doc(inviteId);
  const snap = await inviteRef.get();
  if (!snap.exists) return 'not_found';
  const invite = snap.data() as ShareInvite & { pushedAt?: string };
  if (invite.fromUid !== callerUid) return 'forbidden';
  if (invite.pushedAt) return 'already_sent';

  const found = await backend.db.collection('users').where('email', '==', invite.toEmail).limit(1).get();
  if (found.empty) return 'no_recipient';
  const recipient = found.docs[0];
  const user = recipient.data() as User;
  if (!user.pushEnabled || !wantsPush(user.pushPrefs, 'inbox')) return 'declined';

  await inviteRef.update({ pushedAt: new Date().toISOString() });
  const sent = await sendToUser(backend, recipient.id, user, inboxMessage(invite.fromName, invite.recipeTitle));
  return sent > 0 ? 'sent' : 'declined';
}

export interface DinnerRunSummary {
  configured: boolean;
  checked: number;
  sent: number;
}

/**
 * The morning job: for everyone with notifications on, send tonight's dinner and any thaw reminder.
 * "Today" is the day in each person's own time zone, and nobody gets two on the same day.
 */
export async function runDinnerReminders(now: Date = new Date()): Promise<DinnerRunSummary> {
  const backend = getPushBackend();
  if (!backend) return { configured: false, checked: 0, sent: 0 };

  const users = await backend.db.collection('users').where('pushEnabled', '==', true).limit(500).get();
  const households = new Map<string, Household | null>();
  let sent = 0;

  for (const doc of users.docs) {
    const user = doc.data() as User;
    if (!wantsPush(user.pushPrefs, 'dinner') || !user.householdId) continue;
    const zone = Object.values(user.pushTokens ?? {})[0]?.timeZone || 'UTC';
    const today = dateKeyInZone(now, zone);
    if (user.lastDinnerPush === today) continue;

    if (!households.has(user.householdId)) {
      const hh = await backend.db.collection('households').doc(user.householdId).get();
      households.set(user.householdId, hh.exists ? (hh.data() as Household) : null);
    }
    const household = households.get(user.householdId);
    if (!household) continue;

    const message = dinnerMessage(planToList(household.mealPlan), stockToList(household.stockItems), today);
    if (!message) continue;
    await doc.ref.update({ lastDinnerPush: today });
    if ((await sendToUser(backend, doc.id, user, message)) > 0) sent += 1;
  }
  return { configured: true, checked: users.size, sent };
}
