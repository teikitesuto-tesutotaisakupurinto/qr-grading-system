export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

export type UserProfile = {
  uid: string;

  organizationId: string;

  role: UserRole;

  schoolIds: string[];

  name: string;

  studentId?: string | null;
};
