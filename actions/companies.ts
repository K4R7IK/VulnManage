"use server";

import { z } from "zod";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  CompanySchema,
  CreateCompanySchema,
  DeleteCompanySchema,
  UpdateCompanySchema,
} from "@/types/schema";

type Company = z.infer<typeof CompanySchema>;

// Ensure Company type includes createdAt and updatedAt if they exist on the model
// For now, assuming CompanySchema only defines id and name as per the provided schema.ts
// If prisma model has more fields and they are needed, adjust CompanySchema or the select clause.

export async function fetchCompanies() {
  await verifySession();
  // No need to initialize companyData to empty array here, prisma call will provide it or throw
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        // Add other fields if necessary, e.g., createdAt, updatedAt
        // For now, sticking to what UserManagementTab might imply and what CompanySchema supports
      },
    });
    // The component handles empty state, so just return the data and success status.
    // The previous implementation had a specific error for "No companies found",
    // but it's often better to return success true and an empty array.
    // However, to match the existing pattern of error objects, I'll keep it.
    if (companies.length === 0) {
      return {
        success: true, // Or false, depending on how "no companies" should be treated. Let's say true, data is empty.
        data: [],
        error: null, // Or a specific message like "No companies found"
      };
    }
    return {
      success: true,
      data: companies,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching companies:", error);
    return {
      success: false,
      data: [],
      error: { message: "Error fetching companies. Please try again later." },
    };
  }
}

export async function fetchCompany(id: number) {
  await verifySession();
  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!company) {
      return {
        success: false,
        data: null,
        error: { message: "Company not found." },
      };
    }
    return {
      success: true,
      data: company,
      error: null,
    };
  } catch (error) {
    console.error(`Error fetching company with id ${id}:`, error);
    return {
      success: false,
      data: null,
      error: { message: "Error fetching company. Please try again later." },
    };
  }
}

export async function createCompany(_prevState: any, formData: FormData) {
  await verifySession();
  const parseResult = CreateCompanySchema.safeParse({
    name: formData.get("name"), // Changed from companyName to name
  });

  if (!parseResult.success) {
    console.error("Validation Error (createCompany): ", parseResult.error.flatten().fieldErrors);
    return {
      success: false,
      data: null,
      error: { message: "Invalid company name. " + (parseResult.error.flatten().fieldErrors.name?.join(", ") || "") },
    };
  }

  const { name } = parseResult.data;

  try {
    const newCompany = await prisma.company.create({
      data: {
        name,
      },
    });
    return {
      success: true,
      data: newCompany,
      error: null,
    };
  } catch (error) {
    console.error("Error creating company:", error);
    // Consider checking for specific Prisma errors, e.g., unique constraint violation
    return {
      success: false,
      data: null,
      error: { message: "Error creating company. Please try again later." },
    };
  }
}

export async function updateCompany(_prevState: any, formData: FormData) {
  await verifySession();

  const idFromForm = formData.get("id");
  if (idFromForm === null) {
    return {
      success: false,
      data: null,
      error: { message: "Company ID is required for update." },
    };
  }

  const companyId = Number(idFromForm);
  if (isNaN(companyId)) {
     return {
      success: false,
      data: null,
      error: { message: "Invalid Company ID format." },
    };
  }

  const parseResult = UpdateCompanySchema.safeParse({
    id: companyId,
    name: formData.get("name"), // Changed from companyName to name
  });

  if (!parseResult.success) {
    console.error("Validation Error (updateCompany): ", parseResult.error.flatten().fieldErrors);
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    const errorMessage = fieldErrors.name?.join(", ") || fieldErrors.id?.join(", ") || "Invalid data.";
    return {
      success: false,
      data: null,
      error: { message: "Validation failed: " + errorMessage },
    };
  }

  const { id, name } = parseResult.data;

  try {
    const updatedCompany = await prisma.company.update({
      where: { id },
      data: { name },
    });
    return {
      success: true,
      data: updatedCompany,
      error: null,
    };
  } catch (error) {
    console.error(`Error updating company with id ${id}:`, error);
    // Consider checking for specific Prisma errors, e.g., P2025 (record not found)
    return {
      success: false,
      data: null,
      error: { message: "Error updating company. Please try again later." },
    };
  }
}

export async function deleteCompany(_prevState: any, formData: FormData) { // Changed signature for consistency with useFormState
  await verifySession();

  const idFromForm = formData.get("id");
   if (idFromForm === null) {
    return {
      success: false,
      error: { message: "Company ID is required for deletion." },
    };
  }
  const companyId = Number(idFromForm);
   if (isNaN(companyId)) {
     return {
      success: false,
      error: { message: "Invalid Company ID format." },
    };
  }


  const parseResult = DeleteCompanySchema.safeParse({
    id: companyId,
  });

  if (!parseResult.success) {
    console.error("Validation Error (deleteCompany): ", parseResult.error.flatten().fieldErrors);
    return {
      success: false,
      error: { message: "Invalid company ID for deletion." },
    };
  }

  const { id } = parseResult.data;

  try {
    await prisma.company.delete({
      where: { id },
    });
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error(`Error deleting company with id ${id}:`, error);
    // Consider checking for specific Prisma errors, e.g., P2025 (record not found)
    // Or foreign key constraints
    return {
      success: false,
      error: { message: "Error deleting company. It might be in use or does not exist." },
    };
  }
}
