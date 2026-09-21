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

  name: string;

  studentId: string | null;

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
   * システムが自動発行。
   */
  studentNumber: string;

  name: string;

  /*
   * 現在の所属情報。
   * 変更可能。
   */
  grade: string;

  className: string;

  schoolId: string;

  active: boolean;

  createdAt?: unknown;

  updatedAt?: unknown;
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

  originalTestCode: string | null;

  automaticGrading: boolean;

  aiGrading: boolean;

  retestManualGrading: boolean;
};

/* =========================================================
   Answer
   ========================================================= */

export type Answer = {
  id: string;

  organizationId: string;

  schoolId: string;

  testId: string;

  testCode: string;

  studentId: string | null;

  studentNumber: string | null;

  totalScore: number;

  maxScore: number;

  finalized: boolean;

  status: string;

  gradingStatus: string;

  createdAt?: unknown;

  updatedAt?: unknown;

  finalizedAt?: unknown;
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

  originalTestCode: string;

  studentId: string;

  studentNumber: string;

  originalScore: number;

  retestTestId: string;

  retestTestCode: string;

  scheduledDate: string;

  status: RetestStatus;

  manualScore: number | null;

  manualMaxScore: number;

  manualPercentage: number | null;

  finalized: boolean;

  appliedToResult: boolean;

  createdBy: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Retest Result
   ========================================================= */

export type RetestResult = {
  id: string;

  organizationId: string;

  schoolId: string;

  retestId: string;

  originalTestId: string;

  originalTestCode: string;

  studentId: string;

  studentNumber: string;

  originalScore: number;

  retestScore: number;

  retestMaxScore: number;

  retestPercentage: number | null;

  /*
   * 通常成績で採用する点数。
   */
  appliedScore: number;

  appliedMaxScore: number;

  appliedPercentage: number | null;

  source: "追試";

  createdBy: string;

  createdAt?: unknown;

  updatedAt?: unknown;
};

/* =========================================================
   Result
   ========================================================= */

export type StudentResult = {
  studentId: string;

  studentNumber: string;

  testId: string;

  testCode: string;

  testName: string;

  subject: string;

  score: number;

  maxScore: number;

  percentage: number;

  average: number | null;

  rank: number | null;

  deviationScore: number | null;

  source:
    | "通常"
    | "追試";
};

/* =========================================================
   Permission scope
   ========================================================= */

export type DataScope =
  | "organization"
  | "school"
  | "student";

/* =========================================================
   CSV Student Row
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
   Generic operation result
   ========================================================= */

export type OperationResult = {
  success: boolean;

  message: string;

  errorCode?: string;
};
