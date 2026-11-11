import type { PatientPhoto } from '../types';

// Comparador de evolução fotográfica (aba Fotos do prontuário). Funções puras:
// agrupam as fotos por atendimento e montam os pares "mais recente × anterior"
// navegados pelo modo "Ver evolução".

export interface PhotoVisitGroup {
  visitId: string;
  date: number; // data do atendimento (ou da foto mais antiga do grupo, se o atendimento não estiver carregado)
  photos: PatientPhoto[];
}

export interface PhotoComparisonRow {
  key: string; // lado do pé, ou 'sem-lado'
  label: string;
  newer: PatientPhoto | null;
  older: PatientPhoto | null;
}

/** Agrupa fotos por atendimento, do mais recente para o mais antigo. */
export function groupPhotosByVisit(photos: PatientPhoto[], visitDates: Map<string, number>): PhotoVisitGroup[] {
  const groups = new Map<string, PhotoVisitGroup>();
  for (const photo of photos) {
    const existing = groups.get(photo.visitId);
    if (existing) {
      existing.photos.push(photo);
      existing.date = visitDates.get(photo.visitId) ?? Math.min(existing.date, photo.createdAt);
    } else {
      groups.set(photo.visitId, { visitId: photo.visitId, date: visitDates.get(photo.visitId) ?? photo.createdAt, photos: [photo] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.date - a.date);
}

const FOOT_ORDER = ['direito', 'esquerdo', 'ambos', 'sem-lado'];

/**
 * Alinha as fotos de dois atendimentos pelo lado do pé, para que a comparação
 * fique "pé direito × pé direito". Lados sem foto em um dos atendimentos aparecem
 * com `null` daquele lado.
 */
export function buildComparisonRows(newer: PhotoVisitGroup, older: PhotoVisitGroup): PhotoComparisonRow[] {
  const keyOf = (p: PatientPhoto) => p.foot ?? 'sem-lado';
  const keys = Array.from(new Set([...newer.photos.map(keyOf), ...older.photos.map(keyOf)]));
  keys.sort((a, b) => (FOOT_ORDER.indexOf(a) === -1 ? 99 : FOOT_ORDER.indexOf(a)) - (FOOT_ORDER.indexOf(b) === -1 ? 99 : FOOT_ORDER.indexOf(b)));

  const rows: PhotoComparisonRow[] = [];
  for (const key of keys) {
    const newerPhotos = newer.photos.filter((p) => keyOf(p) === key);
    const olderPhotos = older.photos.filter((p) => keyOf(p) === key);
    const count = Math.max(newerPhotos.length, olderPhotos.length);
    for (let i = 0; i < count; i++) {
      rows.push({
        key: `${key}-${i}`,
        label: key === 'sem-lado' ? 'Lado não informado' : key === 'ambos' ? 'Ambos os pés' : `Pé ${key}`,
        newer: newerPhotos[i] ?? null,
        older: olderPhotos[i] ?? null,
      });
    }
  }
  return rows;
}
