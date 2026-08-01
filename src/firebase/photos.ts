import { addDoc, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, isStorageConfigured, storage } from './config';
import { demoListPhotosByPatient, demoListPhotosByVisit, demoUploadPatientPhoto } from '../demo/store';
import type { PatientPhoto } from '../types';

const photosRef = collection(db, 'photos');

export type NewPhotoMeta = Omit<PatientPhoto, 'id' | 'storagePath' | 'url' | 'createdAt'>;

// Sem Firebase Storage habilitado (plano Blaze), fotos ficam inteiramente no
// armazenamento local em memória (mesmo do modo demonstração) — escrita e leitura
// juntas, para não gravar metadados no Firestore apontando para uma URL que só
// existe nesta aba do navegador.
export async function uploadPatientPhoto(file: File, meta: NewPhotoMeta): Promise<string> {
  if (!isStorageConfigured) return demoUploadPatientPhoto(file, meta);

  const storagePath = `patients/${meta.patientId}/visits/${meta.visitId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const docRef = await addDoc(photosRef, {
    ...meta,
    storagePath,
    url,
    createdAt: Date.now(),
  });
  return docRef.id;
}

// Filtra por professionalId E patientId — ver o comentário equivalente em
// firebase/visits.ts sobre por que a regra (isOwner OR isLinkedPatient) exige
// os dois filtros ao mesmo tempo para a consulta ser aceita pelo Firestore.
export async function listPhotosByPatient(patientId: string, professionalId: string): Promise<PatientPhoto[]> {
  if (!isStorageConfigured) return demoListPhotosByPatient(patientId, professionalId);
  const q = query(
    photosRef,
    where('professionalId', '==', professionalId),
    where('patientId', '==', patientId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PatientPhoto, 'id'>) }));
}

// Uso exclusivo do profissional (não há chamada do lado do paciente hoje) — só
// professionalId precisa ser filtrado para satisfazer o lado isOwner da regra.
export async function listPhotosByVisit(visitId: string, professionalId: string): Promise<PatientPhoto[]> {
  if (!isStorageConfigured) return demoListPhotosByVisit(visitId);
  const q = query(photosRef, where('professionalId', '==', professionalId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PatientPhoto, 'id'>) }))
    .filter((p) => p.visitId === visitId);
}
