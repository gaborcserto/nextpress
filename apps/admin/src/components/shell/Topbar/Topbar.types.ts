// Extend the default user type locally with an optional role field
export type UserWithRole = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role?: string | null;
};
