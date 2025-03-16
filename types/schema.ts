import { z } from "zod";
import { UserRole } from "@prisma/client";

export const LoginSchema = z.object({
  email: z.string().email().trim(),
  password: z.string().trim(),
  rememberMe: z.boolean(),
});

export const RegisterSchema = z.object({
  name: z.string().min(3).trim(),
  email: z.string().email().trim(),
  token: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
});

export const UserSchema = z.object({
  id: z.number().positive(),
  name: z.string().trim(),
  email: z.string().email().trim(),
  role: z.nativeEnum(UserRole),
  companyId: z.string().transform((val) => {
    if (!val) return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }),
});

export const UserWithPasswordSchema = z.object({
  id: z.number().positive(),
  name: z.string().trim(),
  email: z.string().email().trim(),
  role: z.nativeEnum(UserRole),
  companyId: z.string().transform((val) => {
    if (!val) return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }),
  password: z.string().trim(),
});

export const CreateUserSchema = UserWithPasswordSchema.pick({
  name: true,
  email: true,
  role: true,
  companyId: true,
  password: true,
});

export const UpdateUserSchema = UserWithPasswordSchema;

export const CompanySchema = z.object({
  id: z.number().positive(),
  name: z.string().trim(),
});

export const CreateCompanySchema = CompanySchema.pick({
  name: true,
});
