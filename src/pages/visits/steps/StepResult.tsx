import { RiskBadge } from '../../../components/ui/RiskBadge';
import { RETURN_DESCRIPTION } from '../../../domain/returnSuggestion';
import { ATTENTION_DISCLAIMER } from '../../../domain/riskScore';
import { describeAttentionEvolution, describeScoreDiff, describeSignalListChange } from '../../../domain/evolution';
import type { ExamSigns, RiskResult, Visit } from '../../../types';

interface Props {
  risk: RiskResult;
  examSigns: ExamSigns;
  suggestedReturnDate: string;
  returnDate: string;
  onReturnDateChange: (date: string) => void;
  conduct: string;
  onConductChange: (conduct: string) => void;
  previousVisit: Visit | null;
  hasCriticalAlert: boolean;
}

const MEANING_TEXT: Record<RiskResult['level'], string> = {
  baixo: 'Não foram identificados sinais relevantes de risco neste momento. O paciente pode manter acompanhamento preventivo de rotina.',
  moderado: 'Foram identificados fatores que exigem atenção. O paciente deve ser acompanhado com maior frequência e orientado sobre os sinais de alerta.',
  alto: 'Foram identificados sinais importantes de risco podológico. Recomenda-se acompanhamento próximo e, se necessário, encaminhamento a profissional de saúde habilitado.',
};

const FOLLOWUP_TEXT: Record<RiskResult['level'], string> = {
  baixo: 'Na próxima consulta, reavaliar se os sinais identificados permanecem estáveis. Caso o paciente relate novidades, atualizar a avaliação.',
  moderado: 'Acompanhar de perto se os sinais se mantêm, reduzem ou aumentam. Registrar um novo atendimento na data de retorno sugerida para comparar a evolução.',
  alto: 'Monitorar atentamente. No retorno, verificar se houve melhora, manutenção ou aumento dos fatores identificados. Registrar qualquer alteração no prontuário.',
};

function recommendedAction(risk: RiskResult, hasPriorVisits: boolean, hasCriticalAlert: boolean, returnDate: string): string {
  if (risk.level === 'alto' && hasCriticalAlert) {
    return 'Atenção: sinais de alerta identificados. Oriente o paciente a buscar avaliação com profissional de saúde habilitado caso os sintomas persistam ou piorem.';
  }
  if (risk.level === 'alto') {
    return 'Retorno recomendado em 7 a 15 dias. Monitorar evolução dos fatores identificados.';
  }
  if (risk.level === 'moderado') {
    return 'Agendar retorno em até 30 dias. Reforçar orientações de autocuidado e sinais de alerta.';
  }
  // baixo
  if (!hasPriorVisits) {
    return 'Agendar próxima consulta preventiva em 60 a 90 dias.';
  }
  return `Manter acompanhamento. Próximo retorno sugerido: ${new Date(returnDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`;
}

export function StepResult({
  risk,
  examSigns,
  suggestedReturnDate,
  returnDate,
  onReturnDateChange,
  conduct,
  onConductChange,
  previousVisit,
  hasCriticalAlert,
}: Props) {
  const hasPriorVisits = previousVisit !== null;
  const evolution = describeAttentionEvolution(risk.level, previousVisit?.risk.level ?? null);
  const scoreDiff = describeScoreDiff(risk.score, previousVisit?.risk.score ?? null);
  const signalChange = previousVisit ? describeSignalListChange(examSigns, previousVisit.examSigns) : null;

  return (
    <div>
      <h3>Nível de atenção</h3>
      <p className="hint">🔒 Calculado automaticamente pelo sistema a partir da anamnese e dos sinais observados — esta parte não é editável.</p>

      <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 42, fontWeight: 700 }}>{risk.score} pontos</div>
        <div style={{ margin: '8px 0' }}>
          <RiskBadge level={risk.level} />
        </div>
        <p style={{ marginTop: 10 }}>{risk.message}</p>

        {/* Evolução do paciente — melhoria 1, dentro do card de resultado existente */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--color-border)', textAlign: 'left' }}>
          <p style={{ margin: 0, fontWeight: 600, color: evolution.color ?? 'inherit' }}>
            {evolution.icon && <span style={{ marginRight: 6 }}>{evolution.icon}</span>}
            {evolution.text}
          </p>
          {scoreDiff && (
            <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
              {scoreDiff}
            </p>
          )}
        </div>
      </div>

      {/* Bloco A — O que foi identificado */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h4>O que foi identificado neste atendimento</h4>
        {risk.breakdown.length === 0 ? (
          <p style={{ marginBottom: 0 }}>Nenhum fator de risco identificado neste atendimento.</p>
        ) : (
          <table className="table">
            <tbody>
              {risk.breakdown.map((item) => (
                <tr key={item.label}>
                  <td>✓ {item.label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>+{item.points} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Comparação de sinais observados — melhoria 2 */}
        {signalChange && (
          <div style={{ marginTop: 12 }}>
            {signalChange.novos.length > 0 && (
              <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--color-risk-moderate)' }}>
                Novos sinais identificados neste atendimento: {signalChange.novos.join(', ')}
              </p>
            )}
            {signalChange.resolvidos.length > 0 && (
              <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--color-risk-low)' }}>
                Sinais não observados neste atendimento: {signalChange.resolvidos.join(', ')}
              </p>
            )}
            {signalChange.novos.length === 0 && signalChange.resolvidos.length === 0 && (
              <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
                Sem alterações nos sinais em relação ao último atendimento
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bloco B — O que isso significa */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h4>O que isso significa</h4>
        <p style={{ marginBottom: 0 }}>{MEANING_TEXT[risk.level]}</p>
        <p className="disclaimer" style={{ marginTop: 10 }}>{ATTENTION_DISCLAIMER}</p>
      </div>

      {/* Bloco C — Ação recomendada */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h4>Ação recomendada</h4>
        <p style={{ marginBottom: 0 }}>{recommendedAction(risk, hasPriorVisits, hasCriticalAlert, returnDate)}</p>
      </div>

      {/* Próximo acompanhamento — melhoria 4, card separado que fecha o ciclo */}
      <div className="card followup-card" style={{ marginBottom: 20 }}>
        <h4>Próximo acompanhamento</h4>
        <p style={{ marginBottom: 8 }}>{FOLLOWUP_TEXT[risk.level]}</p>
        <p className="hint" style={{ marginBottom: 0 }}>
          Cada atendimento registrado constrói o histórico de evolução do paciente no PodoPrev.
        </p>
      </div>

      <p className="hint">✏️ A partir daqui, você pode ajustar — o sistema sugere, você decide.</p>

      <div className="form-grid">
        <div className="field">
          <label>Data de retorno sugerida (editável)</label>
          <input type="date" value={returnDate} onChange={(e) => onReturnDateChange(e.target.value)} />
          <span className="hint">
            Sugestão automática: {new Date(suggestedReturnDate).toLocaleDateString('pt-BR')} — {RETURN_DESCRIPTION[risk.level]}
          </span>
        </div>
      </div>

      <div className="field">
        <label>Conduta / observações do podólogo</label>
        <textarea value={conduct} onChange={(e) => onConductChange(e.target.value)} placeholder="Orientações, procedimentos realizados, encaminhamentos…" />
      </div>

      <p className="disclaimer">{ATTENTION_DISCLAIMER}</p>
    </div>
  );
}
