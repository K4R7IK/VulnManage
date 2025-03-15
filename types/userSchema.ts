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
  name: z.string(),
  email: z.string().email().trim(),
  role: z.nativeEnum(UserRole),
  companyId: z.number().nullable(),
});
