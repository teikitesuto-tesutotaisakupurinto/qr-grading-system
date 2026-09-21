export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

/* =========================================================
   User
   ========================================================= */

export type UserProfile = {
  uid: string;

  organizationId: string | null;

  role: UserRole | null;

  schoolIds: string[];

  studentId: string | null;

  name: string;

  email: string | null;

  active: boolean;
};

/* =========================================================
   Student
   ========================================================= */

export type Student = {
  id: string;

  organizationId: string;

  /*
   * 永久識別子。
   * システム側で自動発行。
   */
  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolId: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Student history
   ========================================================= */

export type StudentHistory = {
  id: string;

  organizationId: string;

  studentId: string;

  studentNumber: string;

  previousName: string;

  previousGrade: string;

  previousClassName: string;

  previousSchoolId: string;

  newName: string;

  newGrade: string;

  newClassName: string;

  newSchoolId: string;

  changeType:
    | "新規登録"
    | "CSV更新"
    | "管理者更新";

  changedBy: string;

  changedAt?: unknown;
};

/* =========================================================
   School
   ========================================================= */

export type School = {
  id: string;

  organizationId: string;

  name: string;

  active: boolean;

  logoUrl?: string;
};

/* =========================================================
   Test
   ========================================================= */

export type Test = {
  id: string;

  organizationId: string;

  schoolId: string;

  testId: string;

  name: string;

  subject: string;

  grade: string;

  className: string;

  examDate: string;

  totalScore: number;

  active: boolean;

  isRetest: boolean;

  originalTestId: string | null;

  automaticGrading: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Test subject
   ========================================================= */

export type TestSubject = {
  id: string;

  testId: string;

  subjectId: string;

  subjectName: string;

  maxScore: number;

  sortOrder: number;
};

/* =========================================================
   Answer
   ========================================================= */

export type AnswerStatus =
  | "uploaded"
  | "processing"
  | "graded"
  | "first_review"
  | "second_review"
  | "confirmed"
  | "published"
  | "error";

export type Answer = {
  id: string;

  organizationId: string;

  schoolId: string;

  testId: string;

  subjectId: string;

  studentId: string | null;

  studentNumber: string | null;

  fileKey: string;

  fileName: string;

  contentType: string;

  size: number;

  status: AnswerStatus;

  reviewRequired: boolean;

  totalScore: number;

  totalMaxScore: number;

  qrText?: string;

  qrConfidence?: number;

  ocrConfidence?: number;

  processingError?: string;

  createdAt?: unknown;

  updatedAt?: unknown;

  processedAt?: unknown;

  confirmedAt?: unknown;
};

/* =========================================================
   Grading
   ========================================================= */

export type GradingMark =
  | "○"
  | "△"
  | "×";

export type GradingResult = {
  questionId: string;

  questionNumber: string;

  answerText: string;

  mark: GradingMark;

  score: number;

  maxScore: number;

  confidence: number;

  reviewRequired: boolean;

  reason?: string;

  rubric?: string;
};

export type GradingDocument = {
  id: string;

  answerId: string;

  results: GradingResult[];

  totalScore: number;

  totalMaxScore: number;

  status: string;

  reviewRequired: boolean;

  internalNote: string;

  publicAnnotation: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Review
   ========================================================= */

export type ReviewStatus =
  | "reviewing"
  | "completed"
  | "returned";

export type FirstReview = {
  id: string;

  answerId: string;

  testId: string;

  subjectId: string;

  studentNumber: string;

  reviewerId: string;

  results: GradingResult[];

  totalScore: number;

  totalMaxScore: number;

  internalNote: string;

  publicAnnotation: string;

  status: ReviewStatus;

  createdAt?: unknown;

  updatedAt?: unknown;
};

export type SecondReview = {
  id: string;

  answerId: string;

  testId: string;

  subjectId: string;

  studentNumber: string;

  reviewerId: string;

  results: GradingResult[];

  totalScore: number;

  totalMaxScore: number;

  disagreement: boolean;

  internalNote: string;

  publicAnnotation: string;

  status: ReviewStatus;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Result
   ========================================================= */

export type ResultSource =
  | "通常"
  | "追試";

export type StudentResult = {
  id: string;

  organizationId: string;

  schoolId: string;

  studentId: string;

  studentNumber: string;

  testId: string;

  testName: string;

  subject: string;

  score: number;

  maxScore: number;

  percentage: number;

  average: number | null;

  deviationScore: number | null;

  rank: number | null;

  population: number | null;

  source: ResultSource;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Distribution
   ========================================================= */

export type ScoreDistribution = {
  range: string;

  minScore: number;

  maxScore: number;

  count: number;

  selected: boolean;
};

/* =========================================================
   Grade report
   ========================================================= */

export type GradeReportSubject = {
  subject: string;

  maxScore: number;

  score: number;

  average: number | null;

  deviation: number | null;

  rank: number | null;

  population: number | null;

  distribution: ScoreDistribution[];
};

export type GradeReport = {
  id: string;

  organizationId: string;

  schoolId: string;

  studentId: string;

  studentNumber: string;

  studentName: string;

  schoolName: string;

  grade: string;

  className: string;

  gender: string;

  enrolledSchool: string;

  testId: string;

  testName: string;

  examDate: string;

  subjects: GradeReportSubject[];

  totalScore: number;

  totalMaxScore: number;

  totalAverage: number | null;

  totalDeviation: number | null;

  totalRank: number | null;

  totalPopulation: number | null;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Retest
   ========================================================= */

export type RetestStatus =
  | "未受験"
  | "採点待ち"
  | "採点済み"
  | "確定";

export type Retest = {
  id: string;

  organizationId: string;

  schoolId: string;

  originalTestId: string;

  studentId: string;

  studentNumber: string;

  retestTestId: string;

  scheduledDate: string;

  status: RetestStatus;

  manualScore: number | null;

  manualMaxScore: number;

  finalized: boolean;

  appliedToResult: boolean;

  createdBy: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   CSV
   ========================================================= */

export type StudentCSVRow = {
  rowNumber: number;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolName: string;

  schoolId: string;

  studentId: string;

  error: string;

  isNew: boolean;

  isUpdate: boolean;

  isUnchanged: boolean;
};

/* =========================================================
   Scope
   ========================================================= */

export type DataScope =
  | "organization"
  | "school"
  | "student";

/* =========================================================
   Operation
   ========================================================= */

export type OperationResult = {
  success: boolean;

  message: string;

  errorCode?: string;
};
