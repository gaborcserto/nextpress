import type { RoleName } from "@/lib/auth/roles";

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  roleName: RoleName | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserValues = {
  email: string;
  name: string;
  role: RoleName;
  password: string;
};
