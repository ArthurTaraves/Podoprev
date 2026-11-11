import { useEffect, useState } from 'react';

// Modo offline básico (app do paciente). `navigator.onLine === false` é um sinal
// confiável de "sem rede nenhuma"; o inverso não é garantido (pode haver rede sem
// internet de verdade) — nesse caso a chamada ao Firebase falha sozinha depois e
// cai no mesmo tratamento de erro das páginas.

export class OfflineError extends Error {
  constructor() {
    super('Sem conexão com a internet.');
    this.name = 'OfflineError';
  }
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Falha na hora quando o aparelho está sem rede, em vez de deixar o Firestore
 * tentar a conexão (pode levar ~10s até ele desistir). Vale também no modo
 * demonstração, para o comportamento offline poder ser demonstrado igual.
 */
export function assertOnline(): void {
  if (isOffline()) throw new OfflineError();
}

/**
 * `online`: estado atual da rede. `reconnectCount`: incrementa a cada vez que a
 * conexão volta — usar como dependência do efeito de carga para recarregar os
 * dados automaticamente ao reconectar (sem recarregar ao CAIR a conexão, o que
 * apagaria os dados já exibidos).
 */
export function useOnlineStatus(): { online: boolean; reconnectCount: number } {
  const [online, setOnline] = useState(() => !isOffline());
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setReconnectCount((count) => count + 1);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { online, reconnectCount };
}

/**
 * Padrão de carga das páginas do paciente: `reloadKey` muda quando a conexão
 * volta OU quando o usuário toca "Tentar novamente" — usar como dependência do
 * efeito de carga.
 */
export function useReloadOnReconnect(): { online: boolean; reloadKey: number; retry: () => void } {
  const { online, reconnectCount } = useOnlineStatus();
  const [retries, setRetries] = useState(0);
  return { online, reloadKey: reconnectCount + retries, retry: () => setRetries((count) => count + 1) };
}

export type LoadStatus = 'loading' | 'ready' | 'failed';
