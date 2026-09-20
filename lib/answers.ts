import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { db, storage } from "./firebase";

export type AnswerStatus =
  | "uploaded"
  | "processing"
  | "graded"
  | "first_review"
  | "second_review"
  | "confirmed"
  | "published"
  | "error";

export type AnswerSheet = {
  id: string;
  testId: string;
  subjectId: string;
  studentNumber: string;
  filePath: string;
  pageCount: number;
  status: AnswerStatus;
  createdAt: number;
  updatedAt: number;
};

export async function uploadAnswerFile(
  testId: string,
  subjectId: string,
  studentNumber: string,
  file: File
): Promise<AnswerSheet> {
  const id = doc(
    collection(db, "answers")
  ).id;

  const filePath =
    `answers/${testId}/${subjectId}/${studentNumber}/${id}-${file.name}`;

  const storageRef = ref(
    storage,
    filePath
  );

  await uploadBytes(storageRef, file);

  await getDownloadURL(storageRef);

  const answer: AnswerSheet = {
    id,
    testId,
    subjectId,
    studentNumber,
    filePath,
    pageCount: 1,
    status: "uploaded",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(
    doc(db, "answers", id),
    answer
  );

  return answer;
}

export async function getStudentAnswers(
  studentNumber: string
) {
  const snapshot = await getDocs(
    query(
      collection(db, "answers"),
      where(
        "studentNumber",
        "==",
        studentNumber
      )
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as AnswerSheet[];
}
