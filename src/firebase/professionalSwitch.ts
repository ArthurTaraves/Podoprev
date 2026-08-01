import { collection, doc, runTransaction } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoSwitchProfessional } from '../demo/store';
import { stripUndefined } from '../lib/firestoreSanitize';

export interface SwitchProfessionalParams {
  patientId: string;
  patientUid: string; // uid da conta do paciente (patientAccounts/{uid})
  currentProfessionalId: string;
  currentProfessionalName: string;
  newProfessionalId: string;
  newProfessionalName: string;
  historyAccessConsented: boolean;
  consentTerm: string;
  patientCreatedAt: number; // usado só se o vínculo antigo precisar ser criado retroativamente
}

// Orquestra a troca de profissional (Onda 4) — 5 escritas atômicas:
// 1. patient_professional_links/{patientId}_{atual}   -> status: 'inactive'
// 2. patient_professional_links/{patientId}_{novo}     -> criado, status: 'active' + consentimento
// 3. switch_history/{autoId}                            -> novo registro do evento
// 4. patients/{patientId}.professionalId                -> novo profissional
// 5. patientAccounts/{patientUid}.professionalId         -> novo profissional
//
// Usa runTransaction (não writeBatch) de propósito: lê patients/{patientId} antes de
// escrever e aborta se professionalId não for mais o esperado — fecha a corrida entre
// duas trocas concorrentes (ex.: duplo clique, duas abas), que um writeBatch simples
// não impediria (ver validação arquitetural desta onda).
//
// O vínculo antigo pode não existir ainda (paciente cadastrado antes da Onda 4, nunca
// trocou de profissional) — nesse caso é criado diretamente já como inactive, com
// linkedAt retroativo ao cadastro do paciente, em vez de atualizado.
export async function switchProfessional(params: SwitchProfessionalParams): Promise<void> {
  if (!isFirebaseConfigured) return demoSwitchProfessional(params);

  const oldLinkId = `${params.patientId}_${params.currentProfessionalId}`;
  const newLinkId = `${params.patientId}_${params.newProfessionalId}`;
  const oldLinkRef = doc(db, 'patient_professional_links', oldLinkId);
  const newLinkRef = doc(db, 'patient_professional_links', newLinkId);
  const patientRef = doc(db, 'patients', params.patientId);
  const accountRef = doc(db, 'patientAccounts', params.patientUid);
  const switchRef = doc(collection(db, 'switch_history'));

  await runTransaction(db, async (tx) => {
    const [oldLinkSnap, patientSnap] = await Promise.all([tx.get(oldLinkRef), tx.get(patientRef)]);
    if (!patientSnap.exists()) throw new Error('Paciente não encontrado.');
    if (patientSnap.data().professionalId !== params.currentProfessionalId) {
      throw new Error('Seu vínculo com o profissional já foi alterado. Atualize a página e tente novamente.');
    }

    const now = Date.now();

    if (oldLinkSnap.exists()) {
      tx.update(oldLinkRef, { status: 'inactive', unlinkedAt: now });
    } else {
      tx.set(oldLinkRef, {
        patientId: params.patientId,
        professionalId: params.currentProfessionalId,
        status: 'inactive',
        linkedAt: params.patientCreatedAt,
        unlinkedAt: now,
        historyAccessConsented: false,
      });
    }

    tx.set(
      newLinkRef,
      stripUndefined({
        patientId: params.patientId,
        professionalId: params.newProfessionalId,
        status: 'active',
        linkedAt: now,
        historyAccessConsented: params.historyAccessConsented,
        consentedAt: now,
        consentTerm: params.consentTerm,
        previousProfessionalId: params.currentProfessionalId,
        previousProfessionalName: params.currentProfessionalName,
      }),
    );

    tx.set(switchRef, {
      patientId: params.patientId,
      previousProfessionalId: params.currentProfessionalId,
      previousProfessionalName: params.currentProfessionalName,
      newProfessionalId: params.newProfessionalId,
      newProfessionalName: params.newProfessionalName,
      switchedAt: now,
      historyShared: params.historyAccessConsented,
    });

    tx.update(patientRef, { professionalId: params.newProfessionalId, updatedAt: now });
    tx.update(accountRef, { professionalId: params.newProfessionalId });
  });
}
