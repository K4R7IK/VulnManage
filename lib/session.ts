"use server";

import { jwtVerify, SignJWT } from "jose";
import { UserSchema } from "@/types/userSchema";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type User = z.infer<typeof UserSchema>;
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function encrypt(payload: User, rememberMe: boolean) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? "4h" : "2h")
    .sign(secret);
}

export async function decrypt(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_error) {
    return null;
  }
}

export async function createSession(token: string, rememberMe: boolean) {
  try {
    (await cookies()).set({
      name: "token",
      value: token,
      httpOnly: true,
      maxAge: rememberMe ? 60 * 60 * 4 : 60 * 60 * 2,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    console.log("Cookies set successfully");
    return {
      success: true,
    };
  } catch (error) {
    console.error("Error while setting session: ", error);
    return {
      success: false,
    };
  }
}

export async function verifySession(details: boolean = false) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    redirect("/login");
  }
  try {
    const payload = await decrypt(token);
    const user = {
      id: payload?.id,
      name: payload?.name,
      email: payload?.email,
      role: payload?.role,
      companyId: payload?.companyId,
    };
    if (details) {
      return { success: true, user };
    } else {
      return { success: true };
    }
  } catch (error) {
    console.error("Error while verifying session: ", error);
    redirect("/login");
  }
}

export async function deleteSession() {
  (await cookies()).delete("token");
  redirect("/login");
}
