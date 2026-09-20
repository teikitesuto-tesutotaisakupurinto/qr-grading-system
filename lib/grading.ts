import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export type Mark = "○" | "△" | "×";

export type QuestionSetting = {
  id: string;
  testId: string;
  subjectId: string;
  sectionId?: string;
  questionNumber: string;
  correctAnswer: string;
  maxScore: number;
  gradingMethod:
    | "auto"
    | "manual"
    | "both";
  rubric?: string;
};

export type GradingResult = {
  id: string;
  answerId: string;
  questionId: string;
  mark: Mark;
  score: number;
  maxScore: number;
  reviewerId?: string;
  reviewStage?:
    | "auto"
    | "first"
    | "second";
  internalNote?: string;
  updatedAt: number;
};

export async function saveQuestionSetting(
  setting: QuestionSetting
) {
  await setDoc(
    doc(
      db,
      "questions",
      setting.id
    ),
    setting,
    { merge: true }
  );
}

export async function getQuestionSettings(
  testId: string,
  subjectId: string
) {
  const snapshot = await getDocs(
    query(
      collection(db, "questions"),
      where("testId", "==", testId),
      where(
        "subjectId",
        "==",
        subjectId
      )
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as QuestionSetting[];
}

export async function saveGradingResult(
  result: GradingResult
) {
  await setDoc(
    doc(
      db,
      "gradingResults",
      result.id
    ),
    {
      ...result,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

export async function updateAnswerStatus(
  answerId: string,
  status: string
) {
  await updateDoc(
    doc(db, "answers", answerId),
    {
      status,
      updatedAt: Date.now(),
    }
  );
}
