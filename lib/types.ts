import type {
  Timestamp,
} from "firebase/firestore";

/* =========================================================
   Common
   ========================================================= */

export type FirestoreTimestamp =
  | Timestamp
  | {
      seconds: number;
      nanoseconds: number;
    }
  | Date
  | string
  | null
  | undefined;

/* =========================================================
   User Role
   ========================================================= */

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

/* =========================================================
   App User
   ========================================================= */

export type AppUser = {
  uid: string;

  name: string;

  email: string;

  role: UserRole;

  organizationId:
    | string
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Organization
   ========================================================= */

export type Organization = {
  id: string;

  name: string;

  logoUrl:
    | string
    | null;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   School
   ========================================================= */

export type School = {
  id: string;

  organizationId: string;

  name: string;

  code: string;

  address: string;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Student
   ========================================================= */

export type Student = {
  id: string;

  organizationId: string;

  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolId: string;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Student History
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
    | "手動更新"
    | "校舎変更"
    | "クラス変更"
    | "学年変更";

  changedBy: string;

  changedAt?: FirestoreTimestamp;
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

  /*
   * 通常テスト / 追試
   */
  isRetest: boolean;

  /*
   * 追試の場合の元テスト
   */
  originalTestId:
    | string
    | null;

  /*
   * 後方互換用。
   *
   * 実際の採点方式は
   * testQuestions.gradingMethod
   * を使用する。
   */
  automaticGrading: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Test Question
   ========================================================= */

export type GradingMethod =
  | "automatic"
  | "manual";

export type TestQuestion = {
  id: string;

  organizationId: string;

  testId: string;

  questionNumber: string;

  title: string;

  maxScore: number;

  gradingMethod: GradingMethod;

  correctAnswer: string;

  rubric: string;

  requiresReview: boolean;

  order: number;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Answer Status
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

/* =========================================================
   Answer
   ========================================================= */

export type Answer = {
  id: string;

  organizationId: string;

  schoolId: string;

  testId: string;

  subjectId: string;

  studentId:
    | string
    | null;

  studentNumber:
    | string
    | null;

  /*
   * Supabase Storageの
   * bucket内パス。
   *
   * 実画像はFirestoreには保存しない。
   */
  fileKey: string;

  fileName: string;

  contentType: string;

  size: number;

  status: AnswerStatus;

  reviewRequired: boolean;

  totalScore: number;

  totalMaxScore: number;

  /*
   * QR解析
   */
  qrText: string;

  qrConfidence: number;

  /*
   * OCR解析
   */
  ocrConfidence: number;

  processingError: string;

  /*
   * Firebase Timestamp等。
   */
  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;

  processedAt?: FirestoreTimestamp;

  confirmedAt?: FirestoreTimestamp;
};

/* =========================================================
   Grading Mark
   ========================================================= */

export type GradingMark =
  | "○"
  | "△"
  | "×";

/* =========================================================
   Grading Result
   ========================================================= */

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

/* =========================================================
   Grading Document
   ========================================================= */

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

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Review Status
   ========================================================= */

export type ReviewStatus =
  | "reviewing"
  | "completed"
  | "returned";

/* =========================================================
   First Review
   ========================================================= */

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

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Second Review
   ========================================================= */

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

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Result Source
   ========================================================= */

export type ResultSource =
  | "通常"
  | "追試";

/* =========================================================
   Student Result
   ========================================================= */

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

  /*
   * 受験者平均
   */
  average:
    | number
    | null;

  /*
   * 偏差値
   */
  deviationScore:
    | number
    | null;

  /*
   * 順位
   */
  rank:
    | number
    | null;

  /*
   * 受験者数
   */
  population:
    | number
    | null;

  source: ResultSource;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Grade Report Subject
   ========================================================= */

export type GradeReportDistribution = {
  range: string;

  minScore: number;

  maxScore: number;

  count: number;

  selected: boolean;
};

export type GradeReportSubject = {
  subject: string;

  maxScore: number;

  score: number;

  average:
    | number
    | null;

  deviation:
    | number
    | null;

  rank:
    | number
    | null;

  population:
    | number
    | null;

  distribution:
    GradeReportDistribution[];
};

/* =========================================================
   Grade Report
   ========================================================= */

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

  /*
   * 総合
   */
  totalScore: number;

  totalMaxScore: number;

  totalAverage:
    | number
    | null;

  totalDeviation:
    | number
    | null;

  totalRank:
    | number
    | null;

  totalPopulation:
    | number
    | null;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Retest Status
   ========================================================= */

export type RetestStatus =
  | "未受験"
  | "採点待ち"
  | "採点済み"
  | "確定";

/* =========================================================
   Retest
   ========================================================= */

export type Retest = {
  id: string;

  organizationId: string;

  schoolId: string;

  /*
   * 元テスト
   */
  originalTestId: string;

  /*
   * 生徒
   */
  studentId: string;

  studentNumber: string;

  /*
   * 追試テスト
   */
  retestTestId: string;

  scheduledDate: string;

  status: RetestStatus;

  /*
   * 手採点結果
   */
  manualScore:
    | number
    | null;

  manualMaxScore: number;

  /*
   * 確定状態
   */
  finalized: boolean;

  /*
   * 成績反映済みか
   */
  appliedToResult: boolean;

  createdBy: string;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   QR
   ========================================================= */

export type StudentQRCode = {
  id: string;

  organizationId: string;

  schoolId: string;

  studentId: string;

  studentNumber: string;

  name: string;

  qrValue: string;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

export type TestQRCode = {
  id: string;

  organizationId: string;

  testId: string;

  testCode: string;

  qrValue: string;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   User Management
   ========================================================= */

export type ManagedUser = {
  id: string;

  uid: string;

  organizationId: string;

  schoolIds: string[];

  name: string;

  email: string;

  role: UserRole;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   System Log
   ========================================================= */

export type SystemLogLevel =
  | "info"
  | "warning"
  | "error";

export type SystemLog = {
  id: string;

  organizationId: string;

  schoolId:
    | string
    | null;

  userId: string;

  action: string;

  level: SystemLogLevel;

  targetType: string;

  targetId: string;

  message: string;

  metadata:
    | Record<
        string,
        unknown
      >
    | null;

  createdAt?: FirestoreTimestamp;
};

/* =========================================================
   Notification
   ========================================================= */

export type NotificationType =
  | "system"
  | "grading"
  | "result"
  | "retest"
  | "message";

export type Notification = {
  id: string;

  organizationId: string;

  recipientUserId: string;

  type: NotificationType;

  title: string;

  message: string;

  read: boolean;

  targetPath:
    | string
    | null;

  createdAt?: FirestoreTimestamp;

  readAt?: FirestoreTimestamp;
};

/* =========================================================
   Message
   ========================================================= */

export type MessageTarget =
  | "all"
  | "school"
  | "class"
  | "student";

export type Message = {
  id: string;

  organizationId: string;

  senderId: string;

  targetType: MessageTarget;

  targetIds: string[];

  title: string;

  body: string;

  createdAt?: FirestoreTimestamp;
};

/* =========================================================
   Dashboard Statistics
   ========================================================= */

export type DashboardStatistics = {
  studentCount: number;

  testCount: number;

  answerCount: number;

  firstReviewCount: number;

  secondReviewCount: number;

  confirmedCount: number;

  retestCount: number;
};

/* =========================================================
   CSV
   ========================================================= */

export type StudentCSVRow = {
  studentNumber: string;

  name: string;

  grade: string;

  className: string;

  schoolId: string;

  schoolName: string;
};

/* =========================================================
   Permission Scope
   ========================================================= */

export type DataScope =
  | "organization"
  | "school"
  | "student";

/* =========================================================
   Answer Processing
   ========================================================= */

export type AnswerProcessingStep =
  | "uploaded"
  | "qr"
  | "ocr"
  | "grading"
  | "first_review"
  | "second_review"
  | "confirmed"
  | "published"
  | "error";

export type AnswerProcessingState = {
  answerId: string;

  currentStep:
    AnswerProcessingStep;

  qrCompleted: boolean;

  ocrCompleted: boolean;

  gradingCompleted: boolean;

  firstReviewCompleted: boolean;

  secondReviewCompleted: boolean;

  confirmed: boolean;

  published: boolean;

  error:
    | string
    | null;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Subject
   ========================================================= */

export type Subject = {
  id: string;

  organizationId: string;

  name: string;

  code: string;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Test Subject
   ========================================================= */

export type TestSubject = {
  id: string;

  organizationId: string;

  testId: string;

  subjectId: string;

  subjectName: string;

  maxScore: number;

  order: number;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Class
   ========================================================= */

export type SchoolClass = {
  id: string;

  organizationId: string;

  schoolId: string;

  grade: string;

  name: string;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   Teacher Assignment
   ========================================================= */

export type TeacherAssignment = {
  id: string;

  organizationId: string;

  teacherId: string;

  schoolId: string;

  classId:
    | string
    | null;

  subjectId:
    | string
    | null;

  active: boolean;

  createdAt?: FirestoreTimestamp;

  updatedAt?: FirestoreTimestamp;
};

/* =========================================================
   CSV Import Result
   ========================================================= */

export type CSVImportResult = {
  total: number;

  added: number;

  updated: number;

  unchanged: number;

  errors: string[];
};

/* =========================================================
   Generic Firestore Document
   ========================================================= */

export type FirestoreDocument<
  T
> = {
  id: string;

  data: T;
};

/* =========================================================
   Pagination
   ========================================================= */

export type PaginationState = {
  page: number;

  pageSize: number;

  total: number;
};

/* =========================================================
   API Result
   ========================================================= */

export type ApiSuccess<
  T
> = {
  success: true;

  data: T;
};

export type ApiFailure = {
  success: false;

  error: string;
};

export type ApiResult<
  T
> =
  | ApiSuccess<T>
  | ApiFailure;
