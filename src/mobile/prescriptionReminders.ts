import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Prescription } from '../types';
import { isPrescriptionActive, toLocalIsoDate } from '../domain/prescriptions';

// Lembretes das prescrições do podólogo, nos horários exatos que ele definiu.
//
// - App nativo (Capacitor): @capacitor/local-notifications agenda no sistema
//   operacional — dispara mesmo com o app fechado.
// - Navegador: Web Notification API exibida pelo service worker (public/sw.js).
//   A web não tem como agendar uma notificação futura com a página fechada sem
//   um servidor de push (exigiria Cloud Functions/plano Blaze), e o navegador
//   encerra service workers ociosos em segundos — então quem marca o horário é
//   um timer desta página, e o service worker só exibe a notificação. Na prática:
//   no navegador o lembrete chega enquanto o PodoPrev estiver aberto (mesmo em
//   outra aba ou minimizado).

// Faixa de ids própria: src/mobile/notifications.ts limpa tudo abaixo de 100000.
const ID_BASE = 100000;
const ID_RANGE = 100000;
const CHANNEL_ID = 'podoprev-prescricoes';
const NATIVE_HORIZON_DAYS = 30;
const NATIVE_MAX_NOTIFICATIONS = 400; // Android limita a ~500 alarmes pendentes por app
const PERMISSION_ASKED_KEY = 'podoprev.prescriptionReminders.asked';

interface Occurrence {
  at: Date;
  prescription: Prescription;
}

// Próximas ocorrências (a partir de agora) dentro do horizonte, respeitando o
// período de validade de cada prescrição.
function upcomingOccurrences(prescriptions: Prescription[], horizonDays: number, now = new Date()): Occurrence[] {
  const result: Occurrence[] = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayIso = toLocalIsoDate(day);
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

function notificationText(prescription: Prescription) {
  return {
    title: '🔔 Lembrete do seu podólogo',
    body: prescription.description,
  };
}

// --- Permissão ---

export function notificationsSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function notificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (Capacitor.isNativePlatform()) return 'default'; // o plugin informa ao pedir
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestReminderPermission(): Promise<boolean> {
  try {
    localStorage.setItem(PERMISSION_ASKED_KEY, '1');
  } catch {
    // armazenamento indisponível (aba anônima etc.) — só faz perguntar de novo depois
  }
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

// Pedido automático só na primeira vez (a partir daí o paciente usa o botão).
export function shouldAskPermissionAutomatically(): boolean {
  if (!notificationsSupported()) return false;
  if (!Capacitor.isNativePlatform() && Notification.permission !== 'default') return false;
  try {
    return localStorage.getItem(PERMISSION_ASKED_KEY) !== '1';
  } catch {
    return false;
  }
}

// --- Navegador ---

let webTimers: number[] = [];

function clearWebTimers() {
  webTimers.forEach((t) => window.clearTimeout(t));
  webTimers = [];
}

async function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

async function showWebNotification(prescription: Prescription) {
  if (Notification.permission !== 'granted') return;
  const { title, body } = notificationText(prescription);
  const registration = await getServiceWorker();
  const options = { body, tag: `prescription-${prescription.id}`, icon: '/favicon.svg', data: { url: '/patient/care' } };
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
}

function scheduleWeb(prescriptions: Prescription[]) {
  clearWebTimers();
  if (prescriptions.length === 0 || Notification.permission !== 'granted') return;
  void getServiceWorker();
  for (const { at, prescription } of upcomingOccurrences(prescriptions, 1)) {
    webTimers.push(window.setTimeout(() => void showWebNotification(prescription), at.getTime() - Date.now()));
  }
  // Replaneja a cada 12h enquanto a página continuar aberta (cobre a virada do dia).
  webTimers.push(window.setTimeout(() => scheduleWeb(prescriptions), 12 * 60 * 60 * 1000));
}

// --- Nativo ---

async function clearNativeReminders() {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + ID_RANGE);
  if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
}

async function scheduleNative(prescriptions: Prescription[]) {
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Prescrições do podólogo',
      description: 'Lembretes nos horários definidos pelo seu podólogo',
      importance: 4,
    });
  }
  await clearNativeReminders();
  const notifications = upcomingOccurrences(prescriptions, NATIVE_HORIZON_DAYS)
    .slice(0, NATIVE_MAX_NOTIFICATIONS)
    .map(({ at, prescription }, index) => ({
      id: ID_BASE + index,
      ...notificationText(prescription),
      channelId: CHANNEL_ID,
      schedule: { at, allowWhileIdle: true },
    }));
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

// Substitui todos os lembretes de prescrição já agendados pelos das prescrições
// informadas. Chamada sempre que a aba "Cuidados" carrega — no nativo isso
// renova o horizonte de 30 dias; na web, recria os timers da sessão.
export async function schedulePrescriptionReminders(prescriptions: Prescription[]): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) await scheduleNative(prescriptions);
    else if (notificationsSupported()) scheduleWeb(prescriptions);
  } catch {
    // Lembrete é conveniência — nunca deve quebrar a tela de cuidados.
  }
}
