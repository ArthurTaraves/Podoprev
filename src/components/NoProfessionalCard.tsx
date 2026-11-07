import { Link } from 'react-router-dom';

interface Props {
  icon: string;
  message: string;
  title?: string;
}

// Estado das telas do paciente que dependem de um profissional vinculado, quando
// ainda não há nenhum (cadastro sem convite) — leva para a busca de profissionais.
export function NoProfessionalCard({ icon, message, title = 'Nenhum podólogo vinculado' }: Props) {
  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <p className="empty-icon">{icon}</p>
        <strong>{title}</strong>
        <p style={{ fontSize: 13, marginTop: 8 }}>{message}</p>
        <Link to="/patient/search" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
          Buscar profissional
        </Link>
      </div>
    </div>
  );
}
