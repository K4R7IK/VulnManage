import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordKartik = await bcrypt.hash("etek@1234", 10);

  // Create two companies
  const company1 = await prisma.company.upsert({
    where: { name: "Nayara" }, // Check if it exists
    update: {}, // Do nothing if it exists
    create: {
      name: "Nayara",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create users,
  const user1 = await prisma.user.upsert({
    where: { email: "kkushwaha@etek.com" },
    update: {},
    create: {
      name: "Kartik",
      email: "kkushwaha@etek.com",
      password: passwordKartik,
      role: UserRole.Admin,
    },
  });

  console.log("Seed data created:");
  console.log({ company1, user1 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
