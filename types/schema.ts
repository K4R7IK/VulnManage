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
  name: z.string().trim().min(1, "Company name cannot be empty"), // Added min length validation
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const CreateCompanySchema = CompanySchema.pick({
  name: true, // Will inherit the min(1) validation from CompanySchema.name
});

export const UpdateCompanySchema = CompanySchema.pick({
  id: true, // id is a positive number
  name: true, // name is a non-empty string
});

export const DeleteCompanySchema = CompanySchema.pick({
  id: true,
});