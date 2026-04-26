import { prisma } from "../../models/prisma";
import { executeCancel, executeDraw } from "../../services/raffle-draw";

const MAX_TICKETS_HARD_LIMIT = 99999;

export type CreateRaffleInput = {
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  ticketPrice?: number;
  currency?: string;
  minTickets?: number;
  maxTickets: number;
  maxTicketsPerUser?: number;
  drawType: "countdown" | "max-tickets";
  drawAt?: string | null;
};

const validate = (input: Partial<CreateRaffleInput>) => {
  if (input.maxTickets !== undefined) {
    if (!Number.isInteger(input.maxTickets) || input.maxTickets < 1) {
      throw new Error("maxTickets debe ser un entero positivo.");
    }
    if (input.maxTickets > MAX_TICKETS_HARD_LIMIT) {
      throw new Error(`maxTickets no puede exceder ${MAX_TICKETS_HARD_LIMIT}.`);
    }
  }
  if (input.minTickets !== undefined && input.minTickets < 1) {
    throw new Error("minTickets debe ser >= 1.");
  }
  if (input.maxTicketsPerUser !== undefined && input.maxTicketsPerUser < 1) {
    throw new Error("maxTicketsPerUser debe ser >= 1.");
  }
  if (input.ticketPrice !== undefined && input.ticketPrice < 0) {
    throw new Error("ticketPrice no puede ser negativo.");
  }
  if (input.drawType && !["countdown", "max-tickets"].includes(input.drawType)) {
    throw new Error("drawType debe ser 'countdown' o 'max-tickets'.");
  }
};

export const createRaffleAdmin = async (input: CreateRaffleInput) => {
  validate(input);
  if (!input.slug || !input.title) throw new Error("slug y title son obligatorios.");
  if (input.drawType === "countdown" && !input.drawAt) {
    throw new Error("drawAt es obligatorio para sorteos por cuenta atrás.");
  }
  const created = await prisma.raffle.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      ticketPrice: input.ticketPrice ?? 0,
      currency: input.currency ?? "USD",
      minTickets: input.minTickets ?? 1,
      maxTickets: input.maxTickets,
      maxTicketsPerUser: input.maxTicketsPerUser ?? 1,
      drawType: input.drawType,
      drawAt: input.drawAt ? new Date(input.drawAt) : null,
    },
  });
  return created;
};

export const editRaffleAdmin = async (slug: string, input: Partial<CreateRaffleInput>) => {
  validate(input);
  const raffle = await prisma.raffle.findUnique({
    where: { slug },
    include: { _count: { select: { tickets: true } } },
  });
  if (!raffle || raffle.deletedAt) throw new Error("Sorteo no encontrado.");
  if (raffle.status !== "active") throw new Error("Solo sorteos activos pueden editarse.");

  const ticketsExist = raffle._count.tickets > 0;
  // If tickets exist, only cosmetic fields can be updated.
  const cosmeticOnly = ticketsExist;
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl;
  if (!cosmeticOnly) {
    if (input.ticketPrice !== undefined) data.ticketPrice = input.ticketPrice;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.minTickets !== undefined) data.minTickets = input.minTickets;
    if (input.maxTickets !== undefined) data.maxTickets = input.maxTickets;
    if (input.maxTicketsPerUser !== undefined) data.maxTicketsPerUser = input.maxTicketsPerUser;
    if (input.drawType !== undefined) data.drawType = input.drawType;
    if (input.drawAt !== undefined) data.drawAt = input.drawAt ? new Date(input.drawAt) : null;
    if (input.slug !== undefined) data.slug = input.slug;
  }

  return prisma.raffle.update({ where: { id: raffle.id }, data });
};

export const softDeleteRaffleAdmin = async (slug: string) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle) throw new Error("Sorteo no encontrado.");
  if (raffle.deletedAt) throw new Error("Sorteo ya eliminado.");
  // Trigger cancel + refunds, then mark as deleted.
  if (raffle.status === "active" || raffle.status === "drawing") {
    await executeCancel(raffle.id, "deleted-by-admin");
  }
  return prisma.raffle.update({
    where: { id: raffle.id },
    data: { deletedAt: new Date() },
  });
};

export const triggerDrawAdmin = async (slug: string) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle) throw new Error("Sorteo no encontrado.");
  await executeDraw(raffle.id);
  return { ok: true };
};

export const cancelRaffleAdmin = async (slug: string, reason: string) => {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle) throw new Error("Sorteo no encontrado.");
  await executeCancel(raffle.id, reason || "cancelled-by-admin");
  return { ok: true };
};
