import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { CareInstruction, Prescription } from '../types';
import { isPrescriptionActive } from '../domain/prescriptions';
import { toIsoDate } from './dates';

// Lembretes do paciente — um módulo só, um botão só (aba Cuidados).
//
// Dois tipos, agendados juntos por scheduleReminders():
// 1. Prescrições do podólogo (horários exatos, com período de validade):
//    - app Android (Capacitor): agendadas no sistema, chegam com o app fechado;
//    - navegador: Notification API exibida pelo service worker (public/sw.js).
//      Sem servidor de push (exigiria Cloud Functions/plano Blaze), quem marca
//      o horário é um timer desta página — então só chegam com o site aberto.
// 2. Orientações do último atendimento (Nx ao dia, horários distribuídos entre
//    08h e 21h): só no app Android — no navegador seriam lembretes "do dia todo"
//    que dependeriam do site aberto o dia inteiro, então não são agendadas lá.

export type ReminderPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const isNative = () => Capacitor.isNativePlatform();

// --- Permissão ---

const PERMISSION_ASKED_KEY = 'podoprev.prescriptionReminders.asked';

function webSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (isNative()) {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  }
  if (!webSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  try {
    localStorage.setItem(PERMISSION_ASKED_KEY, '1');
  } catch {
    // armazenamento indisponível (aba anônima etc.) — só faz perguntar de novo depois
  }
  if (isNative()) {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted' ? 'granted' : 'denied';
  }
  if (!webSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

// Pedido automático só na primeira vez (a partir daí o paciente usa o botão).
export function shouldAskPermissionAutomatically(current: ReminderPermission): boolean {
  if (current !== 'default') return false;
  try {
    return localStorage.getItem(PERMISSION_ASKED_KEY) !== '1';
  } catch {
    return false;
  }
}

// Há algo para lembrar NESTE dispositivo? (no navegador, só prescrições contam)
export function hasRemindersForThisDevice(prescriptions: Prescription[], careInstructions: CareInstruction[]): boolean {
  return prescriptions.length > 0 || (isNative() && careInstructions.length > 0);
}

export function isNativeApp(): boolean {
  return isNative();
}

// --- Ocorrências das prescrições ---

interface Occurrence {
  at: Date;
  prescription: Prescription;
}

function upcomingPrescriptionOccurrences(prescriptions: Prescription[], horizonDays: number, now = new Date()): Occurrence[] {
  const result: Occurrence[] = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayIso = toIsoDate(day);
    for (const prescription of prescriptions) {
      if (!isPrescriptionActive(prescription, dayIso)) continue;
      for (const time of prescription.times) {
        const [h, m] = time.split(':').map(Number);
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (at > now) result.push({ at, prescription });
      }
    }
  }
  return result.sort((a, b) => a.at.getTime() - b.at.getTime());
}

const PRESCRIPTION_TITLE = '🔔 Lembrete do seu podólogo';

// --- Navegador ---

let webTimers: number[] = [];

// register() resolve antes de o worker ficar ativo; no primeiro acesso,
// showNotification() falharia ("no active registration"). `ready` só resolve com
// o worker ativo — o limite de 5s evita travar se ele nunca ativar.
async function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    await navigator.serviceWorker.register('/sw.js');
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch {
    return null;
  }
}

async function showWebNotification(prescription: Prescription) {
  if (Notification.permission !== 'granted') return;
  const registration = await getServiceWorker();
  const options = { body: prescription.description, tag: `prescription-${prescription.id}`, icon: '/favicon.svg', data: { url: '/patient/care' } };
  if (registration) await registration.showNotification(PRESCRIPTION_TITLE, options);
  else new Notification(PRESCRIPTION_TITLE, options);
}

function scheduleWeb(prescriptions: Prescription[]) {
  webTimers.forEach((t) => window.clearTimeout(t));
  webTimers = [];
  if (prescriptions.length === 0 || Notification.permission !== 'granted') return;
  void getServiceWorker();
  for (const { at, prescription } of upcomingPrescriptionOccurrences(prescriptions, 1)) {
    webTimers.push(window.setTimeout(() => void showWebNotification(prescription), at.getTime() - Date.now()));
  }
  // Replaneja a cada 12h enquanto a página continuar aberta (cobre a virada do dia).
  webTimers.push(window.setTimeout(() => scheduleWeb(prescriptions), 12 * 60 * 60 * 1000));
}

// --- Nativo ---

const CHANNEL_ID = 'podoprev-lembretes';
// Faixas de id separadas por tipo, para que cada um possa ser limpo sem apagar o outro.
const CARE_ID_BASE = 0;
const PRESCRIPTION_ID_BASE = 100000;
const ID_RANGE = 100000;
const PRESCRIPTION_HORIZON_DAYS = 30;
const MAX_PRESCRIPTION_NOTIFICATIONS = 400; // Android limita a ~500 alarmes pendentes por app
const WAKING_START_HOUR = 8;
const WAKING_END_HOUR = 21;

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Lembretes de cuidados',
    description: 'Lembretes das prescrições e orientações do seu podólogo',
    importance: 4,
  });
}

async function clearNativeReminders(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= CARE_ID_BASE && n.id < PRESCRIPTION_ID_BASE + ID_RANGE);
  if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
}

function hashToId(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return CARE_ID_BASE + (hash % ID_RANGE);
}

function distributeTimes(timesPerDay: number): { hour: number; minute: number }[] {
  const span = WAKING_END_HOUR - WAKING_START_HOUR;
  const count = Math.max(1, Math.min(timesPerDay, 8));
  if (count === 1) return [{ hour: WAKING_START_HOUR + Math.round(span / 2), minute: 0 }];
  return Array.from({ length: count }, (_, i) => ({ hour: Math.round(WAKING_START_HOUR + (span * i) / (count - 1)), minute: 0 }));
}

function careNotifications(instructions: CareInstruction[]): LocalNotificationSchema[] {
  return instructions.flatMap((instruction) =>
    distributeTimes(instruction.timesPerDay).map((time, index) => ({
      id: hashToId(`${instruction.id}-${index}`),
      title: `🦶 ${instruction.title}`,
      body: instruction.description,
      channelId: CHANNEL_ID,
      schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
    })),
  );
}

function prescriptionNotifications(prescriptions: Prescription[]): LocalNotificationSchema[] {
  return upcomingPrescriptionOccurrences(prescriptions, PRESCRIPTION_HORIZON_DAYS)
    .slice(0, MAX_PRESCRIPTION_NOTIFICATIONS)
    .map(({ at, prescription }, index) => ({
      id: PRESCRIPTION_ID_BASE + index,
      title: PRESCRIPTION_TITLE,
      body: prescription.description,
      channelId: CHANNEL_ID,
      schedule: { at, allowWhileIdle: true },
    }));
}

async function scheduleNative(prescriptions: Prescription[], careInstructions: CareInstruction[]) {
  const { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') return;
  await ensureChannel();
  await clearNativeReminders();
  const notifications = [...careNotifications(careInstructions), ...prescriptionNotifications(prescriptions)];
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

// --- Notificação imediata (ex.: "novo cuidado prescrito") ---
// Sem servidor de push, só dispara quando o app/site está aberto e encontra uma
// notificação ainda não exibida neste aparelho — guardamos os ids já exibidos para
// não repetir a cada navegação.

const SHOWN_NOTIFICATIONS_KEY = 'podoprev.shownNotifications';
const INSTANT_ID_BASE = 200000; // fora das faixas dos lembretes agendados

function readShownIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_NOTIFICATIONS_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export async function showNotificationsOnce(items: { id: string; message: string }[]): Promise<void> {
  const shown = readShownIds();
  const pending = items.filter((item) => !shown.has(item.id));
  if (pending.length === 0) return;
  try {
    if ((await getReminderPermission()) !== 'granted') return;
    if (isNative()) {
      await ensureChannel();
      await LocalNotifications.schedule({
        notifications: pending.map((item, index) => ({
          id: INSTANT_ID_BASE + (Date.now() % 100000) + index,
          title: '🦶 PodoPrev',
          body: item.message,
          channelId: CHANNEL_ID,
        })),
      });
    } else {
      const registration = await getServiceWorker();
      for (const item of pending) {
        const options = { body: item.message, tag: `notification-${item.id}`, icon: '/favicon.svg', data: { url: '/patient/care' } };
        if (registration) await registration.showNotification('🦶 PodoPrev', options);
        else new Notification('🦶 PodoPrev', options);
      }
    }
    pending.forEach((item) => shown.add(item.id));
    localStorage.setItem(SHOWN_NOTIFICATIONS_KEY, JSON.stringify([...shown]));
  } catch {
    // Aviso extra — o contador na aba Cuidados continua funcionando sem ele.
  }
}

// --- API pública ---

// Substitui todos os lembretes deste dispositivo pelos informados (lista vazia =
// limpa). Chamada sempre que a aba "Cuidados" carrega — no nativo isso renova o
// horizonte de 30 dias das prescrições; na web, recria os timers da sessão.
// Só agenda se a permissão já foi concedida; nunca pede permissão sozinha.
export async function scheduleReminders(prescriptions: Prescription[], careInstructions: CareInstruction[]): Promise<void> {
  try {
    if (isNative()) await scheduleNative(prescriptions, careInstructions);
    else if (webSupported()) scheduleWeb(prescriptions);
  } catch {
    // Lembrete é conveniência — nunca deve quebrar a tela de cuidados.
  }
}
