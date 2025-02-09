-- CreateTable
CREATE TABLE "RegisterToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegisterToken_token_key" ON "RegisterToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterToken_email_key" ON "RegisterToken"("email");
