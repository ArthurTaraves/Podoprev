import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createPatient, deletePatient, getPatient, updatePatient, type NewPatient } from '../../firebase/patients';
import { calculateAge } from '../../domain/riskScore';
import { formatCpf, isValidCpf } from '../../lib/cpf';
import { formatPhone } from '../../lib/phone';

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const emptyForm: NewPatient = {
  professionalId: '',
  fullName: '',
  birthDate: '',
  cpf: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  profession: '',
  emergencyContact: '',
  notes: '',
};

export function PatientFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<NewPatient>(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getPatient(id).then((p) => {
        if (p) setForm(p);
        setLoading(false);
      });
    }
  }, [id]);

  function set<K extends keyof NewPatient>(key: K, value: NewPatient[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.birthDate || !form.cpf.trim() || !form.phone.trim()) {
      setError('Preencha os campos obrigatórios: nome, data de nascimento, CPF e telefone.');
      return;
    }
    if (!isValidCpf(form.cpf)) {
      setError('CPF inválido. Verifique o número informado.');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      if (isEdit && id) {
        await updatePatient(id, form);
        navigate(`/app/patients/${id}`);
      } else {
        const newId = await createPatient({ ...form, professionalId: user.uid });
        navigate(`/app/patients/${newId}`);
      }
    } catch {
      setError('Não foi possível salvar o paciente. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm('Excluir este paciente? O histórico clínico será preservado, mas o paciente não aparecerá mais na lista.')) return;
    await deletePatient(id);
    navigate('/app/patients');
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isEdit ? 'Editar paciente' : 'Cadastrar paciente'}</h1>
          <p>Dados pessoais utilizados para identificação e contato do paciente.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="error-text">{error}</div>}

        <div className="form-grid">
          <div className="field">
            <label>Nome completo *</label>
            <input type="text" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </div>
          <div className="field">
            <label>Data de nascimento *</label>
            <input type="date" required value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
            {form.birthDate && <span className="hint">Idade: {calculateAge(form.birthDate)} anos</span>}
          </div>
          <div className="field">
            <label>CPF *</label>
            <input type="text" required value={form.cpf} onChange={(e) => set('cpf', formatCpf(e.target.value))} placeholder="000.000.000-00" />
          </div>
          <div className="field">
            <label>Telefone *</label>
            <input type="tel" required value={form.phone} onChange={(e) => set('phone', formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Profissão</label>
            <input type="text" value={form.profession} onChange={(e) => set('profession', e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Endereço</label>
            <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="field">
            <label>Cidade</label>
            <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={form.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">Selecione</option>
              {BRAZIL_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Contato de emergência</label>
            <input type="text" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} placeholder="Nome e telefone" />
          </div>
        </div>

        <div className="field">
          <label>Observações gerais</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="wizard-actions">
          <div>
            {isEdit && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Excluir paciente
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar paciente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
