import { Link } from 'react-router-dom';

// Mensagem das páginas do paciente quando os dados não puderam ser carregados —
// substitui o antigo "Carregando…" eterno (as cargas não tinham tratamento de erro).
// Offline: recarrega sozinha quando a conexão voltar (ver useOnlineStatus).
export function LoadFailedNotice({ online, onRetry, showCareLink = true }: { online: boolean; onRetry: () => void; showCareLink?: boolean }) {
  return (
    <div className="card empty-state">
      <div style={{ fontSize: 32, marginBottom: 8 }}>{online ? '⚠️' : '📶'}</div>
      <strong>{online ? 'Não foi possível carregar seus dados.' : 'Sem conexão no momento'}</strong>
      <p className="care-description" style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>
        {online ? 'Verifique sua internet e tente novamente.' : 'As informações aparecerão automaticamente assim que a conexão voltar.'}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        {online && (
          <button className="btn btn-outline btn-sm" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
        {!online && showCareLink && (
          <Link to="/patient/care" className="btn btn-outline btn-sm">
            Ver meus cuidados salvos
          </Link>
        )}
      </div>
    </div>
  );
}
