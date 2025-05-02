"use server";
import { LoginSchema, UserWithPasswordSchema } from "@/types/schema";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { LoginActionState } from "@/types/returnTypes";
import { createSession, encrypt } from "@/lib/session";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

type User = z.infer<typeof UserWithPasswordSchema> | null;

export async function loginAction(
  _prevState: any,
  formData: FormData
): Promise<LoginActionState> {
  //Validate field
  const parseResult = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") !== null,
  });
  let callbackURL = formData.get("callbackURL") as string;
  if (!callbackURL || typeof callbackURL !== "string") {
    callbackURL = "/dashboard";
  } else {
    // Ensure it's a valid relative path starting with /
    callbackURL = callbackURL.startsWith("/") ? callbackURL : "/dashboard";
  }

  if (!parseResult.success) {
    console.error(
      "Validation Error: ",
      parseResult.error.flatten().fieldErrors
    );
    return {
      errors: {
        message: ["Please check you inputs and try again"],
      },
    };
  }

  const validateFields = parseResult.data;

  //Check credentails
  const user: User = await prisma.user.findUnique({
    where: {
      email: validateFields.email,
    },
    omit: {
      createdAt: true,
      updatedAt: true,
      lastLogin: true,
    },
  });

  if (!user) {
    return {
      errors: {
        message: ["Invalid email or password"],
      },
    };
  }

  const isMatch = await bcrypt.compare(validateFields.password, user.password as string);

  if (!isMatch) {
    return {
      errors: {
        message: ["Invalid email or password"],
      },
    };
  }

  //create session
  try {
    const token = await encrypt(user, validateFields.rememberMe);
    const sessionCheck = await createSession(token, validateFields.rememberMe);

    if (!sessionCheck.success) {
      return {
        errors: {
          message: ["Error faced while creating Session. Try again later."],
        },
      };
    }
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLogin: new Date(),
      },
    });
    return {
      redirectTo: callbackURL,
    };
  } catch (_error) {
    return {
      errors: {
        message: ["Login Error"],
      },
    };
  }
}
