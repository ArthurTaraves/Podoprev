import { useState } from 'react';
import type { ExamSigns, FootSide, PatientPhoto } from '../../../types';
import { uploadPatientPhoto } from '../../../firebase/photos';
import { isStorageConfigured } from '../../../firebase/config';

interface Props {
  patientId: string;
  visitId: string;
  professionalId: string;
  hasImageConsent: boolean;
  examSigns: ExamSigns;
  photos: PatientPhoto[];
  onPhotosChange: (photos: PatientPhoto[]) => void;
  onGoToConsent: () => void;
}

export function StepPhotos({ patientId, visitId, professionalId, hasImageConsent, examSigns, photos, onPhotosChange, onGoToConsent }: Props) {
  const [caption, setCaption] = useState('');
  const [foot, setFoot] = useState<FootSide | ''>(examSigns.foot ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File | null) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const id = await uploadPatientPhoto(file, {
        patientId,
        visitId,
        professionalId,
        caption,
        ...(foot ? { foot } : {}),
      });
      onPhotosChange([
        ...photos,
        {
          id,
          patientId,
          visitId,
          professionalId,
          caption,
          storagePath: '',
          url: URL.createObjectURL(file),
          createdAt: Date.now(),
          ...(foot ? { foot } : {}),
        },
      ]);
      setCaption('');
    } catch {
      setError('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  if (!hasImageConsent) {
    return (
      <div>
        <h3>Registro de fotos</h3>
        <div className="alert-banner">
          Este paciente ainda não possui o termo de autorização de uso de imagem assinado. Não é possível anexar
          fotos sem esse consentimento.
        </div>
        <button type="button" className="btn btn-primary" onClick={onGoToConsent}>
          Registrar consentimento de imagem
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3>Registro de fotos</h3>
      <div className="info-banner">
        As imagens serão utilizadas exclusivamente para acompanhamento podológico e registro da evolução do
        tratamento, mediante consentimento do paciente.
      </div>

      {!isStorageConfigured && (
        <div className="info-banner">
          Armazenamento em nuvem de fotos não está ativado neste projeto (exige plano pago do Firebase). As fotos
          anexadas abaixo ficam disponíveis apenas nesta sessão do navegador.
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      <div className="form-grid">
        <div className="field">
          <label>Pé (opcional)</label>
          <select value={foot} onChange={(e) => setFoot(e.target.value as FootSide | '')}>
            <option value="">Sem associação específica</option>
            <option value="esquerdo">Pé esquerdo</option>
            <option value="direito">Pé direito</option>
            <option value="ambos">Ambos os pés</option>
          </select>
        </div>
        <div className="field">
          <label>Legenda</label>
          <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ex.: ferida em evolução" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
          Enviar da galeria
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {uploading && <p className="hint">Enviando foto…</p>}

      <div className="photo-grid">
        {photos.map((p) => (
          <div key={p.id}>
            <img src={p.url} alt={p.caption ?? 'foto do paciente'} />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.caption || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
