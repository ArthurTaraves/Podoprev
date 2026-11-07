import jsPDF from 'jspdf';
import type { Patient, PatientPhoto, Prescription, RiskLevel, Visit } from '../types';
import { calculateAge } from '../domain/riskScore';
import { RETURN_DESCRIPTION } from '../domain/returnSuggestion';
import { formatDateBR, toIsoDate } from './dates';

const SIGN_LABELS: { key: 'ferida' | 'vermelhidao' | 'rachadura' | 'calo' | 'micose' | 'unhaEncravada' | 'secrecao' | 'dorAoExame'; label: string }[] = [
  { key: 'dorAoExame', label: 'Dor' },
  { key: 'vermelhidao', label: 'Vermelhidão' },
  { key: 'ferida', label: 'Ferida' },
  { key: 'rachadura', label: 'Rachadura' },
  { key: 'calo', label: 'Calo' },
  { key: 'micose', label: 'Micose' },
  { key: 'unhaEncravada', label: 'Unha encravada' },
  { key: 'secrecao', label: 'Secreção' },
];

// Mesmos rótulos do RiskBadge — o relatório fala a mesma língua da tela.
const ATTENTION_LABELS: Record<RiskLevel, string> = {
  baixo: 'Atenção baixa',
  moderado: 'Atenção média',
  alto: 'Atenção alta',
};

const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function signsOf(visit: Visit): string[] {
  return SIGN_LABELS.filter((s) => visit.examSigns[s.key]).map((s) => s.label);
}

function fileSafeName(name: string): string {
  return name.replace(/\s+/g, '_');
}

// Blocos de texto comuns aos relatórios (A4, com quebra de página automática).
function createPdfWriter() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > 280) {
      doc.addPage();
      y = MARGIN;
    }
  }

  return {
    doc,
    get y() {
      return y;
    },
    advance(mm: number) {
      y += mm;
    },
    ensureSpace,
    title(text: string) {
      doc.setFontSize(16);
      doc.setTextColor(21, 101, 192);
      doc.setFont('helvetica', 'bold');
      doc.text(text, MARGIN, y);
      y += 8;
    },
    caption(text: string) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(text, MARGIN, y);
      y += 10;
    },
    section(text: string) {
      ensureSpace(10);
      doc.setFontSize(12);
      doc.setTextColor(20, 184, 166);
      doc.setFont('helvetica', 'bold');
      doc.text(text, MARGIN, y);
      y += 6;
      doc.setDrawColor(226, 232, 240);
      doc.line(MARGIN, y - 3, PAGE_WIDTH - MARGIN, y - 3);
    },
    subheading(text: string) {
      ensureSpace(8);
      doc.setFontSize(10.5);
      doc.setTextColor(21, 101, 192);
      doc.setFont('helvetica', 'bold');
      doc.text(text, MARGIN, y);
      y += 6;
    },
    line(label: string, value: string) {
      ensureSpace(6);
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(value || '—', CONTENT_WIDTH - 45);
      doc.text(lines, MARGIN + 45, y);
      y += 5 * Math.max(lines.length, 1);
    },
    paragraph(text: string) {
      ensureSpace(10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      const lines = doc.splitTextToSize(text || '—', CONTENT_WIDTH);
      doc.text(lines, MARGIN, y);
      y += 5 * lines.length + 2;
    },
  };
}

export async function generateVisitReportPdf(patient: Patient, visit: Visit, photos: PatientPhoto[]): Promise<void> {
  const w = createPdfWriter();
  const { doc } = w;

  // Cabeçalho
  w.title('PodoPrev — Relatório de Atendimento Podológico');
  w.caption(`Emitido em ${formatDateBR(new Date())}`);

  // Dados do paciente
  w.section('Dados do paciente');
  w.line('Nome completo', patient.fullName);
  w.line('Idade', `${calculateAge(patient.birthDate)} anos`);
  w.line('CPF', patient.cpf);
  w.line('Telefone', patient.phone);
  w.line('Cidade/UF', patient.city ? `${patient.city}/${patient.state ?? ''}` : '—');
  w.advance(3);

  // Dados do atendimento
  w.section('Dados do atendimento');
  w.line('Data do atendimento', formatDateBR(visit.date));
  w.line('Profissional responsável', visit.professionalName);
  w.line('Queixa principal', visit.anamnesis.mainComplaint);
  w.advance(3);

  // Resumo da anamnese
  w.section('Resumo da anamnese');
  w.line('Dor nos pés', visit.anamnesis.hasPain === 'sim' ? `Sim (intensidade ${visit.anamnesis.painIntensity ?? '—'}/10)` : 'Não');
  w.line('Possui diabetes', visit.anamnesis.diabetes.hasDiabetes === 'sim' ? 'Sim' : 'Não');
  if (visit.anamnesis.diabetes.hasDiabetes === 'sim') {
    w.line('Tipo de diabetes', visit.anamnesis.diabetes.type || 'Não informado');
    w.line('Tempo de diagnóstico', visit.anamnesis.diabetes.diagnosisTime || '—');
  }
  w.advance(3);

  // Fatores de risco
  w.section('Fatores de risco identificados');
  w.paragraph(visit.risk.breakdown.map((b) => `• ${b.label} (+${b.points})`).join('\n') || 'Nenhum fator de risco relevante identificado.');
  w.advance(2);

  // Nível de atenção (classificação fixa, não editável)
  w.section('Nível de atenção');
  w.line('Pontuação total', `${visit.risk.score} pontos`);
  w.line('Classificação', visit.risk.level.toUpperCase());
  w.paragraph(visit.risk.message);
  w.advance(2);

  // Sinais observados
  w.section('Sinais observados no exame');
  const signs = signsOf(visit);
  w.line('Pé afetado', visit.examSigns.foot ? `Pé ${visit.examSigns.foot}` : 'Não informado');
  w.paragraph(signs.length > 0 ? signs.join(', ') : 'Nenhum sinal marcado no exame.');
  if (visit.examSigns.observation) w.paragraph(`Obs.: ${visit.examSigns.observation}`);
  w.advance(2);

  // Checklist de alerta
  w.section('Checklist de sinais de alerta');
  w.line('Sinal de alerta identificado', visit.hasCriticalAlert ? 'SIM — recomenda-se avaliação por profissional de saúde habilitado' : 'Não');

  // Conduta
  w.section('Conduta / observações do podólogo');
  w.paragraph(visit.conduct || 'Não informado.');

  // Orientações ao paciente
  w.section('Orientações ao paciente');
  if (visit.careInstructions.length === 0) {
    w.paragraph('Nenhuma orientação registrada.');
  } else {
    visit.careInstructions.forEach((instruction) => {
      w.line(`${instruction.title} (${instruction.timesPerDay}x/dia)`, instruction.description);
    });
  }

  // Retorno
  w.section('Sugestão de retorno');
  w.line('Data sugerida', formatDateBR(visit.returnDate));
  w.paragraph(RETURN_DESCRIPTION[visit.risk.level]);

  // Fotos
  if (photos.length > 0) {
    w.section('Fotos autorizadas');
    for (const photo of photos) {
      w.ensureSpace(70);
      const dataUrl = await imageUrlToDataUrl(photo.url);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'JPEG', MARGIN, w.y, 60, 60);
        } catch {
          // formato não suportado — ignora silenciosamente
        }
      }
      doc.setFontSize(9);
      doc.text(photo.caption || '', MARGIN, w.y + 64);
      w.advance(72);
    }
  }

  // Aviso legal
  w.ensureSpace(20);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  const disclaimer =
    'Documento gerado para fins de acompanhamento podológico. Não substitui diagnóstico ou prescrição médica. ' +
    'O nível de atenção é uma classificação preventiva e não diagnóstica, construída a partir de sinais informados ' +
    'e observados — a decisão clínica é sempre do profissional responsável.';
  doc.text(doc.splitTextToSize(disclaimer, CONTENT_WIDTH), MARGIN, 285);

  doc.save(`relatorio-${fileSafeName(patient.fullName)}-${toIsoDate(visit.date)}.pdf`);
}

// Relatório geral do paciente (botão "Gerar relatório" do prontuário): dados
// cadastrais, nível de atenção atual, prescrições ativas e todos os atendimentos
// visíveis para o profissional (inclui os compartilhados por um anterior).
export function generatePatientReportPdf(patient: Patient, visits: Visit[], activePrescriptions: Prescription[]): void {
  const w = createPdfWriter();
  const { doc } = w;
  const generatedAt = formatDateBR(new Date());
  const sortedVisits = [...visits].sort((a, b) => b.date - a.date);
  const latest = sortedVisits[0] ?? null;

  w.title('PodoPrev — Relatório do Paciente');
  w.caption(`Gerado em ${generatedAt}`);

  // 1. Dados do paciente
  w.section('Dados do paciente');
  w.line('Nome completo', patient.fullName);
  w.line('Nascimento', `${formatDateBR(patient.birthDate)} (${calculateAge(patient.birthDate)} anos)`);
  w.line('CPF', patient.cpf);
  w.line('Telefone', patient.phone);
  const cityState = patient.city ? `${patient.city}/${patient.state ?? ''}` : '';
  w.line('Endereço', [patient.address, cityState].filter(Boolean).join(' — '));
  w.advance(3);

  // 2. Nível de atenção atual
  w.section('Nível de atenção atual');
  if (latest) {
    w.line('Classificação', `${ATTENTION_LABELS[latest.risk.level]} (${latest.risk.score} pontos)`);
    w.line('Último atendimento', formatDateBR(latest.date));
  } else {
    w.paragraph('Ainda sem avaliação registrada.');
  }
  w.advance(3);

  // 3. Prescrições ativas
  w.section('Prescrições ativas');
  if (activePrescriptions.length === 0) {
    w.paragraph('Nenhuma prescrição ativa no momento.');
  } else {
    activePrescriptions.forEach((prescription) => {
      w.paragraph(`• ${prescription.description}`);
      w.line('Horários', prescription.times.join(' · '));
      w.line('Até', prescription.endDate ? formatDateBR(prescription.endDate) : 'Sem data de fim');
      w.advance(2);
    });
  }
  w.advance(1);

  // 4. Histórico de atendimentos
  w.section(`Histórico de atendimentos (${sortedVisits.length})`);
  if (sortedVisits.length === 0) {
    w.paragraph('Nenhum atendimento registrado.');
  }
  sortedVisits.forEach((visit, index) => {
    // Bloco inteiro do atendimento na mesma página (e longe do rodapé, em y=283).
    w.ensureSpace(55);
    w.subheading(`${formatDateBR(visit.date)} — ${ATTENTION_LABELS[visit.risk.level]} (${visit.risk.score} pontos)`);
    w.line('Profissional', visit.professionalName);
    w.line('Queixa principal', visit.anamnesis.mainComplaint);
    const signs = signsOf(visit);
    const foot = visit.examSigns.foot ? ` (pé ${visit.examSigns.foot})` : '';
    w.line('Sinais observados', signs.length > 0 ? `${signs.join(', ')}${foot}` : 'Nenhum sinal marcado');
    if (visit.examSigns.observation) w.line('Observação', visit.examSigns.observation);
    w.line(
      'Orientações',
      visit.careInstructions.length > 0
        ? visit.careInstructions.map((instruction) => `${instruction.title} (${instruction.timesPerDay}x/dia)`).join('; ')
        : 'Nenhuma orientação registrada',
    );
    w.line('Retorno sugerido', formatDateBR(visit.returnDate));
    if (index < sortedVisits.length - 1) w.advance(3);
  });

  // 5. Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Gerado em ${generatedAt}. Documento gerado pelo PodoPrev — ferramenta de apoio, não substitui diagnóstico clínico.`,
      MARGIN,
      288,
    );
    doc.setFont('helvetica', 'normal');
    doc.text(`${page}/${pageCount}`, PAGE_WIDTH - MARGIN, 288, { align: 'right' });
  }

  doc.save(`relatorio-paciente-${fileSafeName(patient.fullName)}-${toIsoDate(new Date())}.pdf`);
}
