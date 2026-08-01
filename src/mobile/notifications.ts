import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { CareInstruction } from '../types';

// Lembretes locais dos "cuidados do dia" (ex.: hidratar os pés 3x/dia).
// Funcionam de verdade só no app nativo compilado via Capacitor (Android/iOS) —
// no navegador (npm run dev) as chamadas são ignoradas silenciosamente, pois o
// plugin não tem como agendar notificações recorrentes em segundo plano na web.

const WAKING_START_HOUR = 8;
const WAKING_END_HOUR = 21;
const ID_RANGE = 100000; // faixa de ids reservada para lembretes de cuidado do PodoPrev
const CHANNEL_ID = 'podoprev-cuidados';

function hashToId(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % ID_RANGE;
}

function distributeTimes(timesPerDay: number): { hour: number; minute: number }[] {
  const span = WAKING_END_HOUR - WAKING_START_HOUR;
  const count = Math.max(1, Math.min(timesPerDay, 8));
  if (count === 1) return [{ hour: WAKING_START_HOUR + Math.round(span / 2), minute: 0 }];

  const times: { hour: number; minute: number }[] = [];
  for (let i = 0; i < count; i++) {
    times.push({ hour: Math.round(WAKING_START_HOUR + (span * i) / (count - 1)), minute: 0 });
  }
  return times;
}

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Cuidados podológicos',
    description: 'Lembretes de cuidados diários com os pés indicados pelo seu podólogo',
    importance: 4,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

export async function clearCareReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id < ID_RANGE);
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
}

export async function scheduleCareReminders(instructions: CareInstruction[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await ensureChannel();
  await clearCareReminders();

  const notifications = instructions.flatMap((instruction) =>
    distributeTimes(instruction.timesPerDay).map((time, index) => ({
      id: hashToId(`${instruction.id}-${index}`),
      title: `🦶 ${instruction.title}`,
      body: instruction.description,
      channelId: CHANNEL_ID,
      schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
    })),
  );

  if (notifications.length === 0) return;
  await LocalNotifications.schedule({ notifications });
}
