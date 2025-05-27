import nodemailer from "nodemailer";
import { prisma } from "../../models/prisma";

console.log({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: Bun.env.SMTP_USER,
      pass: Bun.env.SMTP_PASSWORD,
    },
  });

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: Bun.env.SMTP_USER,
    pass: Bun.env.SMTP_PASSWORD,
  },
});

export const forgotPassword = async (
  organizationId: number,
  organizationName: string,
  email: string
) => {
  const user = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId,
        email,
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let existingToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
    },
  });

  if (existingToken?.expiresAt && existingToken.expiresAt > new Date()) {
    await prisma.passwordResetToken.delete({
      where: { id: existingToken.id },
    });
    existingToken = null;
  }

  if (existingToken) {
    throw new Error("Try again in 1 hour");
  }

  const timestamp = Date.now();
  const token = crypto.randomUUID() + timestamp;

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
      createdAt: new Date(),
    },
  });

  await transporter.sendMail({
    from: `"${organizationName}" <${Bun.env.SMTP_USER}>`,
    to: email,
    subject: `Restablece tu contraseña - ${organizationName}`,
    html: `
      <p>Codigo de restablecimiento: ${token}</p>
    `,
  });

  return true;
};
