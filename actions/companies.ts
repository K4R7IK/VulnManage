"use server";

import { z } from "zod";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CompanySchema, CreateCompanySchema } from "@/types/schema";

type Company = z.infer<typeof CompanySchema>;

export async function fetchCompanies() {
  await verifySession();
  let companyData: Company[] | null = null;
  try {
    companyData = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    if (!companyData) {
      return {
        error: {
          message: "No company Found",
        },
        success: false,
        data: companyData,
      };
    } else {
      return {
        error: null,
        success: true,
        data: companyData,
      };
    }
  } catch (_error) {
    return {
      error: {
        message: "Error fetching companies",
      },
      success: false,
      data: companyData,
    };
  }
}

export async function fetchCompany(id: number) {
  await verifySession();
  let companyData: Company | null = null;
  try {
    companyData = await prisma.company.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
      },
    });
    if (!companyData) {
      return {
        error: {
          message: "No company Found",
        },
        success: false,
        data: companyData,
      };
    } else {
      return {
        error: null,
        success: true,
        data: companyData,
      };
    }
  } catch (_error) {
    return {
      error: {
        message: "Error fetching companies",
      },
      success: false,
      data: companyData,
    };
  }
}

export async function createCompany(formData: FormData) {
  await verifySession();
  try {
    const parseResult = CreateCompanySchema.safeParse({
      name: formData.get("companyName"),
    });
    if (!parseResult.success) {
      return {
        error: {
          message: "Invalid Company Name",
        },
        success: false,
        data: null,
      };
    }
    const { name } = parseResult.data;
    await prisma.company.create({
      data: {
        name,
      },
    });
  } catch (_error) {
    return {
      error: {
        message: "Error creating Company.",
      },
      success: false,
      data: null,
    };
  }
}

//TODO: write update and delete action for company
export async function updateCompany() {}

export async function deleteCompany() {}
