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

  /*
   * Firestore document IDとは別に
   * 業務上のテストIDを持てる。
   */
  testId: string;

  name: string;

  subject: string;

  grade: string;

  className: string;

  examDate: string;

  totalScore: number;

  active: boolean;

  /*
   * 追試ならtrue。
   */
  isRetest: boolean;

  /*
   * 追試の場合のみ。
   */
  originalTestId:
    | string
    | null;

  /*
   * 通常テストでも
   * 問題単位の設定を優先する。
   */
  automaticGrading: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
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

  /*
   * 画面表示用の問題番号。
   *
   * "1"
   * "1-1"
   * "大問1"
   *
   * のような表記にも対応するためstring。
   */
  questionNumber: string;

  title: string;

  maxScore: number;

  gradingMethod: GradingMethod;

  /*
   * automaticの場合のみ利用。
   *
   * manualでは空文字にする。
   */
  correctAnswer: string;

  /*
   * 手動採点時の採点基準。
   */
  rubric: string;

  /*
   * 自動採点でも人による確認を
   * 必須にできる。
   */
  requiresReview: boolean;

  /*
   * 表示順。
   */
  order: number;

  /*
   * 追試問題の場合、
   * 元問題IDを保持。
   */
  sourceQuestionId?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
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
   * Firestoreには画像本体を保存しない。
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
   * 答案から認識した
   * 生徒QR等の情報。
   */
  qrText: string;

  qrConfidence: number;

  /*
   * OCRの確信度。
   */
  ocrConfidence: number;

  processingError: string;

  uploadedBy?: string;

  processedAt?: unknown;

  confirmedAt?: unknown;

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
   Student Result
   ========================================================= */

export type ResultSource =
  | "通常"
  | "追試";

export type StudentResult = {
  id: string;

  organizationId: string;

  schoolId: string;

  /*
   * 通常答案の場合。
   */
  answerId?: string | null;

  /*
   * 追試の場合。
   */
  retestId?: string | null;

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
   Grade Report Subject
   ========================================================= */

export type GradeDistributionItem = {
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

  distribution: GradeDistributionItem[];
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

  /*
   * 元の通常テスト。
   */
  originalTestId: string;

  studentId: string;

  studentNumber: string;

  /*
   * 実際に作成された追試テスト。
   */
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
   Test ID
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
   Class
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
   Generic Firestore Timestamp-like value
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
