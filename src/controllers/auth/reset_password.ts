import { prisma } from '../../models/prisma';

export const resetPassword = async (token: string, password: string) => {
  // Find valid token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true } } },
  });

  if (!resetToken) {
    throw new Error('El enlace de restablecimiento no es valido o ya fue utilizado.');
  }

  if (resetToken.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    throw new Error('El enlace de restablecimiento ha expirado. Solicita uno nuevo.');
  }

  // Validate password
  if (!password || password.length < 6) {
    throw new Error('La contrasena debe tener al menos 6 caracteres.');
  }

  const userId = resetToken.user.id;

  // Hash new password
  const hashedPassword = await Bun.password.hash(password);

  // Update password, delete token, and invalidate all sessions in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId },
    }),
    prisma.token.deleteMany({
      where: { userId },
    }),
  ]);

  return true;
};
