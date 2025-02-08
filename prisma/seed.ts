import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {

  const passwordKartik = await bcrypt.hash("asdf1234", 10);
  const passwordRajat = await bcrypt.hash("asdf5678", 10);

  // Create two companies
  const company1 = await prisma.company.create({
    data: {
      name: "Etek",
    },
  });

  const company2 = await prisma.company.create({
    data: {
      name: "Rocket Inc",
    },
  });

  // Create two users, one associated with each company.
  const user1 = await prisma.user.create({
    data: {
      name: "Kartik",
      email: "kkushwaha@etek.com",
      password:passwordKartik,
      role: UserRole.Admin,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: "Bob Smith",
      email: "bob@example.com",
      password:passwordRajat, // In a real app, store a hashed password
      role: UserRole.User,
    },
  });

  console.log("Seed data created:");
  console.log({ company1, company2, user1, user2 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
