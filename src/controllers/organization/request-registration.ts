import { prisma } from "../../models/prisma";
import type { RequestRegistrationRequest } from "../../types/organization/request-registration";
import { sendAdminEmail } from "../../services/email";
import { organizationRegistrationTemplate } from "../../services/email-templates";

export async function requestRegistration(
    body: RequestRegistrationRequest,
    user: { id: number; username: string; email: string },
) {
    const { applicantName, scanName, references, previousWorks, estimatedMonthlyReaders } = body;
    // El email sale de la cuenta registrada (garantiza que es real y agiliza el alta).
    const applicantEmail = user.email;

    // Check if there's already a pending request from the same account or scan name
    const existingRequest = await prisma.organizationRequest.findFirst({
        where: {
            OR: [
                { applicantEmail },
                { userId: user.id },
                { scanName },
            ],
            status: "pending",
        },
    });

    if (existingRequest) {
        if (existingRequest.userId === user.id || existingRequest.applicantEmail === applicantEmail) {
            throw new Error("Ya tienes una solicitud pendiente. Te contactaremos pronto.");
        }
        if (existingRequest.scanName === scanName) {
            throw new Error("Ya existe una solicitud pendiente con este nombre de scan.");
        }
    }

    // Create the organization request linked to the account
    const organizationRequest = await prisma.organizationRequest.create({
        data: {
            applicantName,
            applicantEmail,
            scanName,
            references,
            previousWorks,
            estimatedMonthlyReaders,
            status: "pending",
            userId: user.id,
        },
    });

    // Send notification email (fire-and-forget)
    const description = `Nombre: ${applicantName}\nEmail: ${applicantEmail}\nCuenta: @${user.username} (id ${user.id})\nReferencias: ${references}\nTrabajos previos: ${previousWorks}\nLectores estimados: ${estimatedMonthlyReaders}`;
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

