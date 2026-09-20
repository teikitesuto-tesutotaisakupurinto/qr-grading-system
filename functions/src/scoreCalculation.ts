import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

const db = getFirestore();

type GradingResult = {
  questionId: string;
  questionNumber: string;
  mark: "○" | "△" | "×";
  score: number;
  maxScore: number;
  rubric?: string;
};

type StudentScore = {
  studentNumber: string;
  testId: string;
  subjectId: string;

  score: number;
  maxScore: number;
  percentage: number;

  sectionScores: Record<
    string,
    {
      score: number;
      maxScore: number;
      percentage: number;
    }
  >;

  rubricScores: Record<
    string,
    {
      score: number;
      maxScore: number;
      percentage: number;
    }
  >;

  updatedAt: FirebaseFirestore.FieldValue;
};

type QuestionSetting = {
  id: string;
  sectionId?: string;
  questionNumber: string;
  maxScore: number;
  rubric?: string;
};

type Section = {
  id: string;
  name: string;
  order: number;
};

export async function calculateTestScores(
  testId: string
) {
  const answersSnapshot =
    await db
      .collection("answers")
      .where(
        "testId",
        "==",
        testId
      )
      .where(
        "status",
        "in",
        [
          "graded",
          "first_review",
          "second_review",
          "confirmed",
          "published",
        ]
      )
      .get();

  if (
    answersSnapshot.empty
  ) {
    return {
      testId,
      processed: 0,
      scores: [],
    };
  }

  const batchLimit = 400;

  const answerDocs =
    answersSnapshot.docs;

  const resultIds: string[] = [];

  for (
    let start = 0;
    start < answerDocs.length;
    start += batchLimit
  ) {
    const chunk =
      answerDocs.slice(
        start,
        start + batchLimit
      );

    const batch =
      db.batch();

    for (
      const answerDoc of chunk
    ) {
      const answer =
        answerDoc.data();

      const studentNumber =
        answer.studentNumber;

      const subjectId =
        answer.subjectId;

      if (
        typeof studentNumber !==
          "string" ||
        typeof subjectId !==
          "string"
      ) {
        continue;
      }

      const result =
        await calculateStudentSubjectScore(
          testId,
          subjectId,
          studentNumber,
          answerDoc.id
        );

      const resultRef =
        db
          .collection("scores")
          .doc(
            `${testId}_${subjectId}_${studentNumber}`
          );

      batch.set(
        resultRef,
        result,
        {
          merge: true,
        }
      );

      resultIds.push(
        resultRef.id
      );
    }

    await batch.commit();
  }

  return {
    testId,
    processed:
      resultIds.length,
    scores:
      resultIds,
  };
}

async function calculateStudentSubjectScore(
  testId: string,
  subjectId: string,
  studentNumber: string,
  answerId: string
): Promise<StudentScore> {
  const gradingSnapshot =
    await db
      .collection(
        "gradingResults"
      )
      .doc(answerId)
      .get();

  if (
    !gradingSnapshot.exists
  ) {
    throw new Error(
      `採点結果がありません: ${answerId}`
    );
  }

  const grading =
    gradingSnapshot.data();

  if (!grading) {
    throw new Error(
      `採点結果を取得できません: ${answerId}`
    );
  }

  const results =
    Array.isArray(
      grading.grading?.results
    )
      ? (grading.grading.results as GradingResult[])
      : [];

  const questions =
    await getQuestionSettings(
      testId,
      subjectId
    );

  const sections =
    await getSections(
      testId,
      subjectId
    );

  const score =
    results.reduce(
      (sum, result) =>
        sum +
        Number(result.score || 0),
      0
    );

  const maxScore =
    questions.reduce(
      (sum, question) =>
        sum +
        Number(
          question.maxScore || 0
        ),
      0
    );

  const sectionScores =
    calculateSectionScores(
      results,
      questions,
      sections
    );

  const rubricScores =
    calculateRubricScores(
      results,
      questions
    );

  return {
    studentNumber,
    testId,
    subjectId,

    score,

    maxScore,

    percentage:
      calculatePercentage(
        score,
        maxScore
      ),

    sectionScores,

    rubricScores,

    updatedAt:
      FieldValue.serverTimestamp(),
  };
}

async function getQuestionSettings(
  testId: string,
  subjectId: string
): Promise<QuestionSetting[]> {
  const snapshot =
    await db
      .collection("questions")
      .where(
        "testId",
        "==",
        testId
      )
      .where(
        "subjectId",
        "==",
        subjectId
      )
      .get();

  return snapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as QuestionSetting
    )
    .sort(
      (a, b) =>
        Number(
          a.questionNumber
        ) -
        Number(
          b.questionNumber
        )
    );
}

async function getSections(
  testId: string,
  subjectId: string
): Promise<Section[]> {
  const snapshot =
    await db
      .collection("testSections")
      .where(
        "testId",
        "==",
        testId
      )
      .where(
        "subjectId",
        "==",
        subjectId
      )
      .get();

  return snapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Section
    )
    .sort(
      (a, b) =>
        a.order - b.order
    );
}

function calculateSectionScores(
  results: GradingResult[],
  questions: QuestionSetting[],
  sections: Section[]
) {
  const output: Record<
    string,
    {
      score: number;
      maxScore: number;
      percentage: number;
    }
  > = {};

  for (
    const section of sections
  ) {
    output[section.id] = {
      score: 0,
      maxScore: 0,
      percentage: 0,
    };
  }

  for (
    const question of questions
  ) {
    if (
      !question.sectionId
    ) {
      continue;
    }

    if (
      !output[question.sectionId]
    ) {
      output[question.sectionId] = {
        score: 0,
        maxScore: 0,
        percentage: 0,
      };
    }

    const result =
      results.find(
        (item) =>
          item.questionId ===
          question.id
      );

    output[
      question.sectionId
    ].maxScore +=
      question.maxScore;

    output[
      question.sectionId
    ].score +=
      result?.score ?? 0;
  }

  for (
    const sectionId of
      Object.keys(output)
  ) {
    const item =
      output[sectionId];

    item.percentage =
      calculatePercentage(
        item.score,
        item.maxScore
      );
  }

  return output;
}

function calculateRubricScores(
  results: GradingResult[],
  questions: QuestionSetting[]
) {
  const output: Record<
    string,
    {
      score: number;
      maxScore: number;
      percentage: number;
    }
  > = {};

  for (
    const question of questions
  ) {
    if (
      !question.rubric
    ) {
      continue;
    }

    if (
      !output[question.rubric]
    ) {
      output[question.rubric] = {
        score: 0,
        maxScore: 0,
        percentage: 0,
      };
    }

    const result =
      results.find(
        (item) =>
          item.questionId ===
          question.id
      );

    output[
      question.rubric
    ].maxScore +=
      question.maxScore;

    output[
      question.rubric
    ].score +=
      result?.score ?? 0;
  }

  for (
    const rubric of
      Object.keys(output)
  ) {
    const item =
      output[rubric];

    item.percentage =
      calculatePercentage(
        item.score,
        item.maxScore
      );
  }

  return output;
}

function calculatePercentage(
  score: number,
  maxScore: number
) {
  if (maxScore <= 0) {
    return 0;
  }

  return (
    (score / maxScore) *
    100
  );
}
