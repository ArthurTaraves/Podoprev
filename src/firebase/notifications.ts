import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoListUnreadNotifications, demoMarkNotificationsRead } from '../demo/store';
import type { AppNotification } from '../types';

// A criação acontece em createPrescription (src/firebase/prescriptions.ts), no
// mesmo batch da prescrição — aqui só ficam leitura e "marcar como lida".

export const notificationsRef = collection(db, 'notifications');

// Filtros só por igualdade (patientId + read) — não precisa de índice composto, e
// a regra de leitura só referencia patientId, que a query já fixa.
export async function listUnreadNotifications(patientId: string): Promise<AppNotification[]> {
  if (!isFirebaseConfigured) return demoListUnreadNotifications(patientId);
  const q = query(notificationsRef, where('patientId', '==', patientId), where('read', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) })).sort((a, b) => b.createdAt - a.createdAt);
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (!isFirebaseConfigured) return demoMarkNotificationsRead(ids);
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, 'notifications', id), { read: true }));
  await batch.commit();
}

// Avisa a barra de navegação para recontar as não lidas (ex.: depois que a aba
// Cuidados marca tudo como lido) sem precisar de estado global só pra isso.
export const NOTIFICATIONS_CHANGED_EVENT = 'podoprev:notifications-changed';

export function notifyNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
