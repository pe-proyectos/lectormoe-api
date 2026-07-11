import { prisma } from '../../models/prisma';
import { sendAdminEmail } from '../../services/email';

const DISCORD_HANDLE = '@shoko_cc';

const acceptanceEmailHtml = (applicantName: string, scanName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #0f0f0f; color: #e0e0e0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #333; }
    h1 { color: #f59e0b; font-size: 22px; margin-bottom: 8px; }
    .divider { border: none; border-top: 1px solid #333; margin: 20px 0; }
    .highlight { color: #a78bfa; font-weight: bold; }
    .discord { background: #5865F2; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; }
    p { line-height: 1.7; }
    .footer { margin-top: 24px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ Solicitud de registro ${scanName} en CapibaraTraductor</h1>
    <hr class="divider">
    <p>Hola <span class="highlight">${applicantName}</span> (este es tu nombre no?),</p>
    <p>He revisado su grupo y me encantaría que formen parte de la plataforma, ¿podrías escribirme por Discord para gestionar su ingreso? (el proceso dura de 10 a 30 minutos)</p>
    <p>Mi Discord es <span class="discord">${DISCORD_HANDLE}</span></p>
    <hr class="divider">
    <div class="footer">
      <p>CapibaraTraductor — <a href="https://capibaratraductor.com" style="color:#a78bfa;">capibaratraductor.com</a></p>
    </div>
  </div>
</body>
</html>
`;

const rejectionEmailHtml = (applicantName: string, scanName: string, notes?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #0f0f0f; color: #e0e0e0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #333; }
    h1 { color: #ef4444; font-size: 22px; margin-bottom: 8px; }
    .divider { border: none; border-top: 1px solid #333; margin: 20px 0; }
    .highlight { color: #a78bfa; font-weight: bold; }
    p { line-height: 1.7; }
    .footer { margin-top: 24px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Solicitud de registro ${scanName} en CapibaraTraductor</h1>
    <hr class="divider">
    <p>Hola <span class="highlight">${applicantName}</span>,</p>
    <p>Gracias por su interés en formar parte de CapibaraTraductor. Lamentablemente, luego de revisar su solicitud, no podemos aceptarla en este momento.</p>
    ${notes ? `<p><strong>Motivo:</strong> ${notes}</p>` : ''}
    <p>Si creen que esto es un error o en el futuro cumplen con los requisitos, pueden volver a enviar su solicitud.</p>
    <p>Gracias por su comprensión.</p>
    <hr class="divider">
    <div class="footer">
      <p>CapibaraTraductor — <a href="https://capibaratraductor.com" style="color:#a78bfa;">capibaratraductor.com</a></p>
    </div>
  </div>
</body>
</html>
`;

export const listRequests = async (status?: string) => {
	const where = status ? { status } : {};
	return prisma.organizationRequest.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		include: { user: { select: { id: true, username: true, slug: true } } },
	});
};

export const reviewRequest = async (
	id: number,
	action: 'accept' | 'reject' | 'accept_no_email',
	notes?: string
) => {
	const request = await prisma.organizationRequest.findUnique({ where: { id } });
	if (!request) throw new Error('Solicitud no encontrada.');
	if (request.status !== 'pending')
		throw new Error('Esta solicitud ya fue revisada.');

	const newStatus = action === 'reject' ? 'rejected' : 'accepted';

	await prisma.organizationRequest.update({
		where: { id },
		data: { status: newStatus, reviewNotes: notes ?? null },
	});

	if (action !== 'accept_no_email') {
		const subject = `Solicitud de registro ${request.scanName} en CapibaraTraductor`;
		const html =
			action === 'accept'
				? acceptanceEmailHtml(request.applicantName, request.scanName)
				: rejectionEmailHtml(request.applicantName, request.scanName, notes);
		await sendAdminEmail(request.applicantEmail, subject, html);
	}

	return { id, status: newStatus };
};
