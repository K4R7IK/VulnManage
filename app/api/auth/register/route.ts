import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";

// Validate token & register user
export async function POST(req: Request) {
  try {
    const { email, token, password } = await req.json();

    if (!email || !token || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the token in the database
    const registerToken = await prisma.registerToken.findUnique({
      where: { token },
    });

    if (!registerToken || registerToken.email !== email) {
      return NextResponse.json({ error: "Invalid token or email" }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        name: email.split("@")[0], // Default name as first part of email
        email,
        password: hashedPassword,
        role: "User",
        companyId: registerToken.companyId ? Number(registerToken.companyId) : null,
      },
    });

    // Remove token after successful registration
    await prisma.registerToken.delete({ where: { token } });

    return NextResponse.json({ message: "User registered successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
