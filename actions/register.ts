"use server";
import { RegisterSchema } from "@/types/userSchema";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { LoginActionState } from "@/types/returnTypes";
import { redirect } from "next/navigation";

export async function registerAction(
  prevState: any,
  formData: FormData,
): Promise<LoginActionState> {
  const parseResult = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    token: formData.get("token"),
    confirmPassword: formData.get("confirmPassword"),
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

  const {
    name,
    email,
    password,
    confirmPassword,
    token,
  }: z.infer<typeof RegisterSchema> = parseResult.data;

  if (password !== confirmPassword) {
    return {
      errors: {
        message: ["Password didn't matched."],
      },
    };
  }

  const registerToken = await prisma.registerToken.findUnique({
    where: { token },
    select: {
      email: true,
      expiresAt: true,
      companyId: true,
      role: true,
    },
  });

  if (!registerToken || registerToken.expiresAt < new Date()) {
    return {
      errors: {
        message: ["Registration Token Expired"],
      },
    };
  }
  if (registerToken.email !== email) {
    return {
      errors: {
        message: ["This token isn't registered to this user."],
      },
    };
  }
  const hashedPassword = await Bun.password.hash(password);

  //TODO: Let admin set the usersrole and company on Token Creatation.
  await prisma.$transaction([
    prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        companyId: registerToken.companyId
          ? Number(registerToken.companyId)
          : null,
        role: registerToken.role,
      },
    }),

    prisma.registerToken.delete({
      where: {
        token,
      },
    }),
  ]);

  redirect("/login");
}
