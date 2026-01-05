import { prisma } from "../../models/prisma";
import type { RequestRegistrationRequest } from "../../types/organization/request-registration";

export async function requestRegistration(body: RequestRegistrationRequest) {
    const { applicantName, applicantEmail, scanName, references, previousWorks, estimatedMonthlyReaders } = body;

    // Check if there's already a pending request with the same email or scan name
    const existingRequest = await prisma.organizationRequest.findFirst({
        where: {
            OR: [
                { applicantEmail },
                { scanName },
            ],
            status: "pending",
        },
    });

    if (existingRequest) {
        if (existingRequest.applicantEmail === applicantEmail) {
            throw new Error("Ya existe una solicitud pendiente con este correo electrónico.");
        }
        if (existingRequest.scanName === scanName) {
            throw new Error("Ya existe una solicitud pendiente con este nombre de scan.");
        }
    }

    // Create the organization request
    const organizationRequest = await prisma.organizationRequest.create({
        data: {
            applicantName,
            applicantEmail,
            scanName,
            references,
            previousWorks,
            estimatedMonthlyReaders,
            status: "pending",
        },
    });

    return {
        status: true,
        data: {
            id: organizationRequest.id,
            message: "Solicitud enviada exitosamente. Te contactaremos en las próximas 48 horas.",
        },
    };
}

