import jsPDF from 'jspdf';
import type { Patient, PatientPhoto, Visit } from '../types';
import { calculateAge } from '../domain/riskScore';
import { RETURN_DESCRIPTION } from '../domain/returnSuggestion';

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

export async function generateVisitReportPdf(patient: Patient, visit: Visit, photos: PatientPhoto[]): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  function addTitle(text: string) {
    doc.setFontSize(16);
    doc.setTextColor(21, 101, 192);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN, y);
    y += 8;
  }

  function addSection(text: string) {
    ensureSpace(10);
    doc.setFontSize(12);
    doc.setTextColor(20, 184, 166);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y - 3, PAGE_WIDTH - MARGIN, y - 3);
  }

  function addLine(label: string, value: string) {
    ensureSpace(6);
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || '—', CONTENT_WIDTH - 45);
    doc.text(lines, MARGIN + 45, y);
    y += 5 * Math.max(lines.length, 1);
  }

  function addParagraph(text: string) {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(text || '—', CONTENT_WIDTH);
    doc.text(lines, MARGIN, y);
    y += 5 * lines.length + 2;
  }

  function ensureSpace(needed: number) {
    if (y + needed > 280) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // Cabeçalho
  addTitle('PodoPrev — Relatório de Atendimento Podológico');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, MARGIN, y);
  y += 10;

  // Dados do paciente
  addSection('Dados do paciente');
  addLine('Nome completo', patient.fullName);
  addLine('Idade', `${calculateAge(patient.birthDate)} anos`);
  addLine('CPF', patient.cpf);
  addLine('Telefone', patient.phone);
  addLine('Cidade/UF', patient.city ? `${patient.city}/${patient.state ?? ''}` : '—');
  y += 3;

  // Dados do atendimento
  addSection('Dados do atendimento');
  addLine('Data do atendimento', new Date(visit.date).toLocaleDateString('pt-BR'));
  addLine('Profissional responsável', visit.professionalName);
  addLine('Queixa principal', visit.anamnesis.mainComplaint);
  y += 3;

  // Resumo da anamnese
  addSection('Resumo da anamnese');
  addLine('Dor nos pés', visit.anamnesis.hasPain === 'sim' ? `Sim (intensidade ${visit.anamnesis.painIntensity ?? '—'}/10)` : 'Não');
  addLine('Possui diabetes', visit.anamnesis.diabetes.hasDiabetes === 'sim' ? 'Sim' : 'Não');
  if (visit.anamnesis.diabetes.hasDiabetes === 'sim') {
    addLine('Tipo de diabetes', visit.anamnesis.diabetes.type || 'Não informado');
    addLine('Tempo de diagnóstico', visit.anamnesis.diabetes.diagnosisTime || '—');
  }
  y += 3;

  // Fatores de risco
  addSection('Fatores de risco identificados');
  addParagraph(visit.risk.breakdown.map((b) => `• ${b.label} (+${b.points})`).join('\n') || 'Nenhum fator de risco relevante identificado.');
  y += 2;

  // Nível de atenção (classificação fixa, não editável)
  addSection('Nível de atenção');
  addLine('Pontuação total', `${visit.risk.score} pontos`);
  addLine('Classificação', visit.risk.level.toUpperCase());
  addParagraph(visit.risk.message);
  y += 2;

  // Sinais observados
  addSection('Sinais observados no exame');
  const signs = SIGN_LABELS.filter((s) => visit.examSigns[s.key]).map((s) => s.label);
  addLine('Pé afetado', visit.examSigns.foot ? `Pé ${visit.examSigns.foot}` : 'Não informado');
  addParagraph(signs.length > 0 ? signs.join(', ') : 'Nenhum sinal marcado no exame.');
  if (visit.examSigns.observation) addParagraph(`Obs.: ${visit.examSigns.observation}`);
  y += 2;

  // Checklist de alerta
  addSection('Checklist de sinais de alerta');
  addLine('Sinal de alerta identificado', visit.hasCriticalAlert ? 'SIM — recomenda-se avaliação por profissional de saúde habilitado' : 'Não');

  // Conduta
  addSection('Conduta / observações do podólogo');
  addParagraph(visit.conduct || 'Não informado.');

  // Orientações ao paciente
  addSection('Orientações ao paciente');
  if (visit.careInstructions.length === 0) {
    addParagraph('Nenhuma orientação registrada.');
  } else {
    visit.careInstructions.forEach((instruction) => {
      addLine(`${instruction.title} (${instruction.timesPerDay}x/dia)`, instruction.description);
    });
  }

  // Retorno
  addSection('Sugestão de retorno');
  addLine('Data sugerida', new Date(visit.returnDate).toLocaleDateString('pt-BR'));
  addParagraph(RETURN_DESCRIPTION[visit.risk.level]);

  // Fotos
  if (photos.length > 0) {
    addSection('Fotos autorizadas');
    for (const photo of photos) {
      ensureSpace(70);
      const dataUrl = await imageUrlToDataUrl(photo.url);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'JPEG', MARGIN, y, 60, 60);
        } catch {
          // formato não suportado — ignora silenciosamente
        }
      }
      doc.setFontSize(9);
      doc.text(photo.caption || '', MARGIN, y + 64);
      y += 72;
    }
  }

  // Aviso legal
  ensureSpace(20);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  const disclaimer =
    'Documento gerado para fins de acompanhamento podológico. Não substitui diagnóstico ou prescrição médica. ' +
    'O nível de atenção é uma classificação preventiva e não diagnóstica, construída a partir de sinais informados ' +
    'e observados — a decisão clínica é sempre do profissional responsável.';
  doc.text(doc.splitTextToSize(disclaimer, CONTENT_WIDTH), MARGIN, 285);

  doc.save(`relatorio-${patient.fullName.replace(/\s+/g, '_')}-${new Date(visit.date).toISOString().slice(0, 10)}.pdf`);
}
