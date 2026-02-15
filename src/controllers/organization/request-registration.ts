import { prisma } from "../../models/prisma";
import type { RequestRegistrationRequest } from "../../types/organization/request-registration";
import { sendAdminEmail } from "../../services/email";
import { organizationRegistrationTemplate } from "../../services/email-templates";

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

    // Send notification email (fire-and-forget)
    const description = `Nombre: ${applicantName}\nEmail: ${applicantEmail}\nReferencias: ${references}\nTrabajos previos: ${previousWorks}\nLectores estimados: ${estimatedMonthlyReaders}`;
    sendAdminEmail(
        'luis.choque.castro@outlook.com',
        `Nueva Solicitud de Registro: ${scanName}`,
        organizationRegistrationTemplate(scanName, applicantEmail, description.replace(/\n/g, '<br>'))
    ).catch((err) => console.error('[Org Registration] Error sending notification email:', err));

    return {
        status: true,
        data: {
            id: organizationRequest.id,
            message: "Solicitud enviada exitosamente. Te contactaremos en las próximas 48 horas.",
        },
    };
}

