export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
}

export interface UpdateUserInput {
  email?: string;
  username?: string;
  avatar?: string;
  role?: UserRole;
  status?: UserStatus;
}
