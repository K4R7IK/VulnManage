import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordKartik = await bcrypt.hash("etek@1234", 10);

  // Create two companies
  const company1 = await prisma.company.create({
    data: {
      name: "Nayara",
    },
  });

  // Create users,
  const user1 = await prisma.user.create({
    data: {
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
