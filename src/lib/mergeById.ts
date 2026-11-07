// Junta listas vindas de várias consultas (uma por profissional já vinculado ao
// paciente — ver listAllProfessionalIdsForPatient) sem repetir itens: a última
// ocorrência de cada id vence.
export function mergeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}
