import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export type TestStatus =
  | "draft"
  | "grading"
  | "ready"
  | "published";

export type Test = {
  id: string;
  name: string;
  date: string;
  targetSchoolIds: string[];
  targetClassIds: string[];
  subjectIds: string[];
  status: TestStatus;
  templateId?: string;
  createdAt: number;
  updatedAt: number;
};

export type TestSubject = {
  id: string;
  testId: string;
  name: string;
  order: number;
  maxScore: number;
};

export async function createTest(
  data: Omit<Test, "id">
): Promise<string> {
  const reference = doc(
    collection(db, "tests")
  );

  await setDoc(reference, {
    ...data,
    id: reference.id,
  });

  return reference.id;
}

export async function getTests(
  status?: TestStatus
): Promise<Test[]> {
  const reference = collection(db, "tests");

  const snapshot = status
    ? await getDocs(
        query(
          reference,
          where("status", "==", status)
        )
      )
    : await getDocs(reference);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as Test[];
}

export async function getTestSubjects(
  testId: string
): Promise<TestSubject[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "testSubjects"),
      where("testId", "==", testId)
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as TestSubject[];
}
