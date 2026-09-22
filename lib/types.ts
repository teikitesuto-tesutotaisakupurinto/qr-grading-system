/* =========================================================
   User
   ========================================================= */

export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

export type AppUser = {
  uid: string;

  email:
    | string
    | null;

  name: string;

  role: UserRole;

  organizationId:
    | string
    | null;

  schoolIds: string[];

  studentId:
    | string
    | null;

  active: boolean;

  photoURL:
    | string
    | null;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/*
 * 既存画面との互換用
 */
export type UserProfile =
  AppUser;

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

  gender?: string;

  schoolName?: string;

  enrolledSchool?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   School
   ========================================================= */

export type School = {
  id: string;

  organizationId: string;

  name: string;

  code?: string;

  postalCode?: string;

  address?: string;

  phone?: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
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

  originalTestId:
    | string
    | null;

  automaticGrading: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Grading Method
   ========================================================= */

export type GradingMethod =
  | "automatic"
  | "manual";

/* =========================================================
   Test Question
   ========================================================= */

export type TestQuestion = {
  id: string;

  organizationId: string;

  testId: string;

  questionNumber: string;

  title: string;

  maxScore: number;

  /*
   * デフォルトはautomatic。
   * 必要な問題だけmanualに変更する。
   */
  gradingMethod: GradingMethod;

  correctAnswer: string;

  rubric: string;

  requiresReview: boolean;

  order: number;

  sourceQuestionId?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
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

  fileKey: string;

  fileName: string;

  contentType: string;

  size: number;

  status: AnswerStatus;

  reviewRequired: boolean;

  totalScore: number;

  totalMaxScore: number;

  qrText: string;

  qrConfidence: number;

  ocrConfidence: number;

  processingError: string;

  /*
   * 点数公開状態
   *
   * false / undefined:
   *   生徒には点数を公開しない
   *
   * true:
   *   点数公開済み
   */
  scorePublished?: boolean;

  /*
   * 点数を公開した日時
   */
  scorePublishedAt?: unknown;

  /*
   * 採点確定者
   */
  confirmedBy?: string;

  /*
   * 採点確定日時
   */
  confirmedAt?: unknown;

  uploadedBy?: string;

  processedAt?: unknown;

  createdAt?: unknown;

  updatedAt?: unknown;
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

  reason: string;

  rubric: string;
};

/* =========================================================
   Grading
   ========================================================= */

export type GradingStatus =
  | "graded"
  | "first_review"
  | "second_review"
  | "confirmed";

export type Grading = {
  id: string;

  answerId: string;

  testId: string;

  subjectId: string;

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

  createdAt?: unknown;

  updatedAt?: unknown;
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

  createdAt?: unknown;

  updatedAt?: unknown;
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

  answerId?:
    | string
    | null;

  retestId?:
    | string
    | null;

  studentId: string;

  studentNumber: string;

  testId: string;

  testName: string;

  subject: string;

  score: number;

  maxScore: number;

  percentage: number;

  average:
    | number
    | null;

  deviationScore:
    | number
    | null;

  rank:
    | number
    | null;

  population:
    | number
    | null;

  source: ResultSource;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Grade Distribution
   ========================================================= */

export type GradeDistributionItem = {
  range: string;

  minScore: number;

  maxScore: number;

  count: number;

  selected: boolean;
};

/* =========================================================
   Grade Report Subject
   ========================================================= */

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
    GradeDistributionItem[];
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

  manualScore:
    | number
    | null;

  manualMaxScore: number;

  finalized: boolean;

  appliedToResult: boolean;

  createdBy: string;

  internalNote?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   QR Sticker
   ========================================================= */

export type QRSticker = {
  id: string;

  organizationId: string;

  schoolId: string;

  studentId: string;

  studentNumber: string;

  studentName: string;

  qrText: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Test Identifier
   ========================================================= */

export type TestIdentifier = {
  id: string;

  organizationId: string;

  testId: string;

  testName: string;

  schoolId: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Subject
   ========================================================= */

export type Subject = {
  id: string;

  organizationId: string;

  name: string;

  code?: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   School Class
   ========================================================= */

export type SchoolClass = {
  id: string;

  organizationId: string;

  schoolId: string;

  name: string;

  grade: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Teacher Assignment
   ========================================================= */

export type TeacherAssignment = {
  id: string;

  organizationId: string;

  schoolId: string;

  teacherId: string;

  subjectId?: string;

  testId?: string;

  classId?: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Notification
   ========================================================= */

export type NotificationType =
  | "system"
  | "grading"
  | "result"
  | "message"
  | "warning";

export type Notification = {
  id: string;

  organizationId: string;

  recipientUserId: string;

  type: NotificationType;

  title: string;

  message: string;

  read: boolean;

  link?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Message
   ========================================================= */

export type Message = {
  id: string;

  organizationId: string;

  senderId: string;

  recipientUserIds: string[];

  title: string;

  body: string;

  readBy: string[];

  createdAt?: unknown;

  updatedAt?: unknown;
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

  userId:
    | string
    | null;

  level: SystemLogLevel;

  action: string;

  resourceType?: string;

  resourceId?: string;

  message: string;

  metadata?: Record<
    string,
    unknown
  >;

  createdAt?: unknown;
};

/* =========================================================
   App Settings
   ========================================================= */

export type AppSettings = {
  id: string;

  organizationId: string;

  siteName: string;

  logoUrl:
    | string
    | null;

  timezone: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Timestamp
   ========================================================= */

export type TimestampLike =
  | {
      seconds: number;

      nanoseconds: number;

      toDate?: () => Date;

      toMillis?: () => number;
    }
  | Date
  | string
  | number
  | null
  | undefined;
