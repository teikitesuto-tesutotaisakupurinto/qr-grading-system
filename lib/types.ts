export type UserRole =
  | "本部管理者"
  | "校舎管理者"
  | "講師"
  | "生徒";

export type UserProfile = {
  uid: string;

  organizationId:
    | string
    | null;

  role:
    | UserRole
    | null;

  schoolIds: string[];

  name: string;

  studentId:
    | string
    | null;
};
