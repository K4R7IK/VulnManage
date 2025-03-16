"use server";

import { z } from "zod";
import {
  UserSchema,
  UserWithPasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
} from "@/types/schema";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type User = z.infer<typeof UserSchema>;
type UserWithPassword = z.infer<typeof UserWithPasswordSchema>;

export async function fetchUsers() {
  let users: User[] | null = null;
  await verifySession();
  try {
    users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    });
    return users;
  } catch (_error) {
    console.error("Error fetching Users");
    return null;
  }
}

export async function createUser(_prevState: any, formData: FormData) {
  await verifySession();
  const parseResult = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    companyId: formData.get("companyId"),
    role: formData.get("role"),
  });
  if (!parseResult.success) {
    console.error(
      "Validation Error: ",
      parseResult.error.flatten().fieldErrors,
    );
    return {
      errors: {
        message: ["Please check you inputs and try again"],
      },
    };
  }
  const { name, email, role, companyId, password } = parseResult.data;
  try {
    const hashedPassword = await Bun.password.hash(password);
    await prisma.user.create({
      data: {
        name,
        email,
        role,
        companyId,
        password: hashedPassword,
      },
    });
  } catch (_error) {
    return {
      errors: {
        message: ["Error faced when updating user"],
      },
    };
  }
  revalidatePath("/dashboard/settings", "page");
}

export async function updateUser(_prevState: any, formData: FormData) {
  await verifySession();
  const parseResult = UpdateUserSchema.safeParse({
    id: Number(formData.get("id")),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    companyId: formData.get("companyId"),
    role: formData.get("role"),
  });
  if (!parseResult.success) {
    console.error(
      "Validation Error: ",
      parseResult.error.flatten().fieldErrors,
    );
    return {
      errors: {
        message: ["Please check you inputs and try again"],
      },
    };
  }
  const validatedResult = parseResult.data;

  try {
    const user: UserWithPassword | null = await prisma.user.findUnique({
      where: {
        id: validatedResult.id,
      },
    });
    if (!user) {
      console.error("Can't fetch the user for updating");
      return {
        errors: {
          message: ["Problem faced during user fetching when creating user"],
        },
      };
    }
    let hashedPassword: string;
    if (!validatedResult.password) {
      hashedPassword = user.password;
    } else {
      hashedPassword = await Bun.password.hash(validatedResult.password);
    }
    await prisma.user.update({
      where: {
        id: validatedResult.id,
      },
      data: {
        name: validatedResult.name,
        email: validatedResult.email,
        role: validatedResult.role,
        companyId: validatedResult.companyId,
        password: hashedPassword,
      },
    });
  } catch (_error) {
    return {
      errors: {
        message: ["Error faced when updating user"],
      },
    };
  }
}

export async function deleteUser(id: number) {
  await verifySession();
  try {
    await prisma.user.delete({
      where: {
        id,
      },
    });
  } catch (_error) {
    return {
      errors: {
        message: ["Error faced when deleting user"],
      },
    };
  }
  revalidatePath("/dashboard/setting");
}
