import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPatient } from '../../firebase/patients';
import { listVisitsByPatient } from '../../firebase/visits';
import { listConsentsByPatient } from '../../firebase/consents';
import { listPhotosByPatient } from '../../firebase/photos';
import { createPatientInvite } from '../../firebase/patientInvites';
import { getPreAnamnesisForPatient, validatePreAnamnesis } from '../../firebase/preAnamnesis';
import { getPatientProfessionalLink } from '../../firebase/patientProfessionalLinks';
import type { Anamnesis, Consent, Patient, PatientPhoto, PreAnamnesis, Visit } from '../../types';
import { calculateAge } from '../../domain/riskScore';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { generateVisitReportPdf } from '../../lib/pdf';
import { formatPhone } from '../../lib/phone';
import { describeAttentionEvolution, describeScoreDiff } from '../../domain/evolution';
import { StepAnamnesis } from '../visits/steps/StepAnamnesis';

type Tab = 'dados' | 'evolucao' | 'fotos' | 'consentimentos' | 'pre-anamnese';

export function PatientRecordPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [photos, setPhotos] = useState<PatientPhoto[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [tab, setTab] = useState<Tab>('dados');
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotoIds, setComparePhotoIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [preAnamnesis, setPreAnamnesis] = useState<PreAnamnesis | null>(null);
  const [reviewedAnamnesis, setReviewedAnamnesis] = useState<Anamnesis | null>(null);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  // Onda 4 — histórico compartilhado por um profissional anterior (item 4). Só
  // existe quando este paciente veio de uma troca e há um vínculo prévio registrado.
  const [previousProfessionalName, setPreviousProfessionalName] = useState<string | null>(null);
  const [historyShared, setHistoryShared] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    load(id, user.uid);
  }, [id, user]);

  async function load(patientId: string, professionalId: string) {
    setLoading(true);
    setLoadError('');
    try {
      const [p, v, ph, c, pre, link] = await Promise.all([
        getPatient(patientId),
        listVisitsByPatient(patientId, professionalId),
        listPhotosByPatient(patientId, professionalId),
        listConsentsByPatient(patientId, professionalId),
        getPreAnamnesisForPatient(patientId, professionalId),
        getPatientProfessionalLink(patientId, professionalId),
      ]);
      const pending = pre?.status === 'aguardando_validacao' ? pre : null;

      // Onda 4 — histórico compartilhado (item 4): só busca/mescla os atendimentos
      // do profissional anterior se o vínculo ATUAL registra consentimento vivo.
      // hasConsentedHistoryAccess (firestore.rules) reavalia isso a cada leitura —
      // se o paciente revogar depois, esta mesma consulta passa a devolver vazio
      // para o profissional anterior, sem precisar de nenhuma mudança aqui.
      let mergedVisits = v;
      const previousId = link?.previousProfessionalId ?? null;
      const consented = link?.status === 'active' && link.historyAccessConsented === true;
      setPreviousProfessionalName(previousId ? link?.previousProfessionalName ?? null : null);
      setHistoryShared(consented);
      if (previousId && consented) {
        const sharedVisits = await listVisitsByPatient(patientId, previousId);
        const byId = new Map(v.map((visit) => [visit.id, visit]));
        for (const visit of sharedVisits) byId.set(visit.id, visit);
        mergedVisits = Array.from(byId.values()).sort((a, b) => b.date - a.date);
      }

      setPatient(p);
      setVisits(mergedVisits);
      setPhotos(ph);
      setConsents(c);
      setPreAnamnesis(pending);
      setReviewedAnamnesis(pending?.anamnesis ?? null);
    } catch {
      setLoadError('Não foi possível carregar os dados do paciente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePdf(visit: Visit) {
    if (!patient) return;
    setGeneratingId(visit.id);
    try {
      const visitPhotos = photos.filter((ph) => ph.visitId === visit.id);
      await generateVisitReportPdf(patient, visit, visitPhotos);
    } finally {
      setGeneratingId(null);
    }
  }

  function toggleComparePhoto(photoId: string) {
    setComparePhotoIds((prev) => {
      if (prev.includes(photoId)) return prev.filter((id) => id !== photoId);
      if (prev.length < 2) return [...prev, photoId];
      return [prev[1], photoId]; // mantém a seleção mais recente, troca a mais antiga
    });
  }

  async function handleValidatePreAnamnesis() {
    if (!preAnamnesis || !reviewedAnamnesis || !user) return;
    setValidating(true);
    try {
      await validatePreAnamnesis(preAnamnesis.id, reviewedAnamnesis, user.uid);
      setPreAnamnesis(null);
      setValidated(true);
      setTab('dados');
    } finally {
      setValidating(false);
    }
  }

  async function handleInvite() {
    if (!id || !user) return;
    setGeneratingInvite(true);
    try {
      const code = await createPatientInvite(id, user.uid);
      setInviteCode(code);
    } finally {
      setGeneratingInvite(false);
    }
  }

  if (loading) return <p>Carregando…</p>;
  if (loadError) return <p className="error-text">{loadError}</p>;
  if (!patient || !id) return <p>Paciente não encontrado.</p>;

  const latestVisit = visits[0];
  const hasDataConsent = consents.some((c) => c.type === 'dados' && c.agreed);
  const hasImageConsent = consents.some((c) => c.type === 'imagem' && c.agreed);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{patient.fullName}</h1>
          <p>
            {calculateAge(patient.birthDate)} anos · CPF {patient.cpf} · {patient.city ? `${patient.city}/${patient.state}` : 'Localização não informada'}
          </p>
          {latestVisit && (
            <div style={{ marginTop: 8 }}>
              <RiskBadge level={latestVisit.risk.level} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => navigate(`/app/patients/${id}/edit`)}>
            Editar dados
          </button>
          <button className="btn btn-outline" onClick={() => navigate(`/app/patients/${id}/consent`)}>
            Termos LGPD
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/app/patients/${id}/visits/new`)}>
            + {visits.length === 0 ? 'Realizar avaliação inicial' : 'Registrar retorno'}
          </button>
        </div>
      </div>

      {validated && (
        <div className="info-banner" style={{ marginBottom: 16 }}>
          Pré-anamnese marcada como validada.
        </div>
      )}

      {previousProfessionalName && (
        <div className={historyShared ? 'info-banner' : 'alert-banner'} style={{ marginBottom: 16, flexDirection: 'column' }}>
          {historyShared ? (
            <>
              <strong>Este paciente possui histórico compartilhado por outro profissional.</strong>
              <p style={{ margin: '4px 0 0' }}>Profissional anterior: {previousProfessionalName}</p>
            </>
          ) : (
            <>
              <strong>Este paciente optou por não compartilhar o histórico anterior.</strong>
              <p style={{ margin: '4px 0 0' }}>Profissional anterior: {previousProfessionalName}</p>
            </>
          )}
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${tab === 'dados' ? 'active' : ''}`} onClick={() => setTab('dados')}>
          Dados pessoais
        </button>
        <button className={`tab-btn ${tab === 'evolucao' ? 'active' : ''}`} onClick={() => setTab('evolucao')}>
          Histórico e evolução
        </button>
        <button className={`tab-btn ${tab === 'fotos' ? 'active' : ''}`} onClick={() => setTab('fotos')}>
          Fotos ({photos.length})
        </button>
        <button className={`tab-btn ${tab === 'consentimentos' ? 'active' : ''}`} onClick={() => setTab('consentimentos')}>
          Consentimentos LGPD
        </button>
        {preAnamnesis && (
          <button className={`tab-btn ${tab === 'pre-anamnese' ? 'active' : ''}`} onClick={() => setTab('pre-anamnese')}>
            🕓 Pré-anamnese pendente
          </button>
        )}
      </div>

      {tab === 'dados' && (
        <div className="card">
          <div className="form-grid">
            <div>
              <strong>Nome completo</strong>
              <p>{patient.fullName}</p>
            </div>
            <div>
              <strong>Data de nascimento</strong>
              <p>{new Date(patient.birthDate).toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <strong>Telefone</strong>
              <p>{formatPhone(patient.phone)}</p>
            </div>
            <div>
              <strong>E-mail</strong>
              <p>{patient.email || '—'}</p>
            </div>
            <div>
              <strong>Endereço</strong>
              <p>{patient.address || '—'}</p>
            </div>
            <div>
              <strong>Profissão</strong>
              <p>{patient.profession || '—'}</p>
            </div>
            <div>
              <strong>Contato de emergência</strong>
              <p>{patient.emergencyContact || '—'}</p>
            </div>
          </div>
          {patient.notes && (
            <div>
              <strong>Observações</strong>
              <p>{patient.notes}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className={`badge ${hasDataConsent ? 'badge-low' : 'badge-high'}`}>
              {hasDataConsent ? 'Termo de dados assinado' : 'Termo de dados pendente'}
            </span>
            <span className={`badge ${hasImageConsent ? 'badge-low' : 'badge-moderate'}`}>
              {hasImageConsent ? 'Termo de imagem assinado' : 'Termo de imagem pendente'}
            </span>
          </div>
        </div>
      )}

      {tab === 'dados' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>App do paciente</h3>
          {patient.linkedUserId ? (
            <p>Este paciente já tem uma conta vinculada e recebe orientações e lembretes pelo app.</p>
          ) : (
            <>
              <p>
                Gere um código de convite para o paciente criar a própria conta e receber, no celular, os
                cuidados e lembretes definidos nos atendimentos.
              </p>
              {inviteCode ? (
                <>
                  <div className="invite-code-box">{inviteCode}</div>
                  <p className="hint">Compartilhe este código com o paciente. Ele será usado uma única vez no cadastro do app.</p>
                </>
              ) : (
                <button className="btn btn-secondary" disabled={generatingInvite} onClick={handleInvite}>
                  {generatingInvite ? 'Gerando…' : 'Gerar código de convite'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'evolucao' && (
        <div>
          {previousProfessionalName && (
            <div className={historyShared ? 'info-banner' : 'alert-banner'} style={{ marginBottom: 16 }}>
              {historyShared
                ? `Você está visualizando histórico compartilhado mediante autorização do paciente (atendimentos anteriores de ${previousProfessionalName}).`
                : `O paciente não autorizou o compartilhamento do histórico anterior com ${previousProfessionalName}.`}
            </div>
          )}
          {visits.length === 0 ? (
            <div className="card">
              <div className="empty-state">Nenhum atendimento registrado ainda. Inicie uma nova anamnese para começar o acompanhamento.</div>
            </div>
          ) : (
            <div className="timeline">
              {visits.map((visit, index) => {
                const previous = visits[index + 1] ?? null; // próximo no array = atendimento anterior no tempo (lista desc.)
                const evolution = describeAttentionEvolution(visit.risk.level, previous?.risk.level ?? null);
                const scoreDiff = previous ? describeScoreDiff(visit.risk.score, previous.risk.score) : null;
                const isShared = visit.professionalId !== user?.uid;
                return (
                  <div key={visit.id} className="timeline-item card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong>{new Date(visit.date).toLocaleDateString('pt-BR')}</strong> — {visit.anamnesis.mainComplaint || 'Sem queixa registrada'}
                        {isShared && <span className="badge badge-low" style={{ marginLeft: 8 }}>Compartilhado por {visit.professionalName}</span>}
                      </div>
                      <RiskBadge level={visit.risk.level} />
                    </div>
                    {visit.hasCriticalAlert && <div className="alert-banner" style={{ marginTop: 10 }}>Sinal de alerta identificado neste atendimento.</div>}
                    <p style={{ marginTop: 8 }}>
                      <strong>Nível de atenção:</strong> {visit.risk.score} pontos · <strong>Retorno sugerido:</strong>{' '}
                      {new Date(visit.returnDate).toLocaleDateString('pt-BR')}
                    </p>
                    <div style={{ marginTop: -4, marginBottom: 8, fontSize: 13 }}>
                      <strong style={{ color: evolution.color ?? 'var(--color-text)' }}>
                        {evolution.icon && <>{evolution.icon} </>}
                        Evolução do paciente:
                      </strong>{' '}
                      <span style={{ color: evolution.color ?? 'inherit' }}>{evolution.text}</span>
                      {scoreDiff && (
                        <>
                          <br />
                          <span className="hint">{scoreDiff}</span>
                        </>
                      )}
                    </div>
                    {visit.conduct && <p><strong>Conduta:</strong> {visit.conduct}</p>}
                    {visit.careInstructions.length > 0 && (
                      <p><strong>Orientações ao paciente:</strong> {visit.careInstructions.map((c) => c.title).join(', ')}</p>
                    )}
                    <button className="btn btn-outline btn-sm" disabled={generatingId === visit.id} onClick={() => handleGeneratePdf(visit)}>
                      {generatingId === visit.id ? 'Gerando PDF…' : 'Gerar relatório PDF'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'fotos' && (
        <div className="card">
          {photos.length === 0 ? (
            <div className="empty-state">Nenhuma foto registrada.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <p className="hint" style={{ margin: 0 }}>
                  {compareMode ? 'Selecione duas fotos para comparar lado a lado.' : `${photos.length} foto${photos.length === 1 ? '' : 's'} registrada${photos.length === 1 ? '' : 's'}.`}
                </p>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={photos.length < 2}
                  onClick={() => {
                    setCompareMode((v) => !v);
                    setComparePhotoIds([]);
                  }}
                >
                  {compareMode ? 'Sair da comparação' : 'Comparar fotos ao longo do tempo'}
                </button>
              </div>

              {compareMode && comparePhotoIds.length === 2 && (
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  {comparePhotoIds.map((id) => {
                    const p = photos.find((ph) => ph.id === id)!;
                    return (
                      <div key={id} className="card">
                        <img src={p.url} alt={p.caption ?? ''} style={{ width: '100%', borderRadius: 8 }} />
                        <div style={{ fontSize: 12, marginTop: 8 }}>
                          <strong>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</strong>
                          {p.foot && ` · Pé ${p.foot}`}
                          <br />
                          {p.caption || '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="photo-grid">
                {photos.map((p) => {
                  const selected = comparePhotoIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      style={compareMode ? { cursor: 'pointer', outline: selected ? '3px solid var(--color-secondary)' : 'none', borderRadius: 8 } : undefined}
                      onClick={compareMode ? () => toggleComparePhoto(p.id) : undefined}
                    >
                      <img src={p.url} alt={p.caption ?? ''} />
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')} — {p.caption || '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'pre-anamnese' && preAnamnesis && reviewedAnamnesis && (
        <div>
          <div className="info-banner" style={{ marginBottom: 16 }}>
            Esta anamnese foi preenchida pelo paciente e aguarda validação profissional.
          </div>
          <p className="hint" style={{ marginBottom: 16 }}>
            Enviada em {new Date(preAnamnesis.createdAt).toLocaleDateString('pt-BR')}. Revise, corrija ou complemente antes de validar.
          </p>
          <div className="card">
            <StepAnamnesis value={reviewedAnamnesis} onChange={setReviewedAnamnesis} />
          </div>
          <button className="btn btn-primary" disabled={validating} onClick={handleValidatePreAnamnesis} style={{ marginTop: 16 }}>
            {validating ? 'Validando…' : 'Marcar como validada'}
          </button>
        </div>
      )}

      {tab === 'consentimentos' && (
        <div className="card">
          {consents.length === 0 ? (
            <div className="empty-state">Nenhum termo de consentimento registrado ainda.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => (
                  <tr key={c.id}>
                    <td>{c.type === 'dados' ? 'Dados pessoais e de saúde' : 'Uso de imagem'}</td>
                    <td>{new Date(c.agreedAt).toLocaleDateString('pt-BR')}</td>
                    <td>{c.agreed ? 'Concedido' : 'Recusado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
