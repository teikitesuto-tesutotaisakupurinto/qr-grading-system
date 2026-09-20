import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "./firebase";

export async function getCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const reference = collection(db, collectionName);

  const snapshot = await getDocs(
    query(reference, ...constraints)
  );

  return snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...item.data(),
      }) as T
  );
}

export async function getDocument<T = DocumentData>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const reference = doc(db, collectionName, id);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T;
}

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: T
) {
  const reference = await addDoc(
    collection(db, collectionName),
    data
  );

  return reference.id;
}

export async function setDocument<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: T
) {
  await setDoc(
    doc(db, collectionName, id),
    data,
    { merge: true }
  );
}

export async function updateDocument<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: Partial<T>
) {
  await updateDoc(
    doc(db, collectionName, id),
    data
  );
}

export async function deleteDocument(
  collectionName: string,
  id: string
) {
  await deleteDoc(
    doc(db, collectionName, id)
  );
}

export {
  collection,
  doc,
  orderBy,
  query,
  where,
};
