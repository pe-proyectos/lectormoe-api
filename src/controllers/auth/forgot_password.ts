import { prisma } from '../../models/prisma';
import { sendPasswordResetEmail } from '../../services/email-notifications';

export const forgotPassword = async (
  organizationId: number,
  organizationName: string,
  email: string
) => {
  // Find user by email (global, not org-scoped)
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    // Never reveal whether user exists - silently succeed
    return true;
  }

  // Ensure user has permission record for this organization
  let permission = await prisma.permission.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
  });

  if (!permission) {
    permission = await prisma.permission.create({
      data: {
        userId: user.id,
        organizationId,
        role: 'user',
        hierarchyLevel: 0,
      },
    });
  }

  // Delete any existing token for this user (expired or not)
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  // Generate new token
  const token = crypto.randomUUID() + '-' + Date.now();

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      organizationId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
    },
  });

  // Send email via Resend
  await sendPasswordResetEmail(user.id, user.email, user.username, token);

  return true;
};
