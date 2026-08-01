// O Firestore recusa `setDoc`/`updateDoc` inteiros quando qualquer campo aninhado
// vale `undefined` (ex.: `anamnesis.painIntensity` antes de "Dor nos pés?" ser
// respondido). Em vez de tratar cada campo opcional individualmente, remove
// recursivamente qualquer chave `undefined` do objeto antes de gravar.
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue;
      result[key] = stripUndefined(entry);
    }
    return result as T;
  }
  return value;
}
