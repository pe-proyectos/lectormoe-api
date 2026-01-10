import { prisma } from "../models/prisma";
import type {
  Chapter,
  Permission,
  MangaCustom,
  User,
  SubscriptionPlan,
} from "../prisma-generated/client";

/**
 * Tipos extendidos para incluir relaciones necesarias
 * Solo incluye los campos de User que realmente se usan
 */
type UserWithSubscriptions = Pick<User, "id"> & {
  subscriptions?: Array<{
    subscriptionPlanId: number;
    active?: boolean;
    status?: string;
    endDate?: Date | null;
    subscriptionPlan?: Pick<SubscriptionPlan, "id" | "canReadUnreleased" | "active">;
  }>;
};

type MangaCustomWithPlans = Pick<MangaCustom, "id" | "requireLogin"> & {
  subscriptionPlans?: Array<Pick<SubscriptionPlan, "id" | "canReadUnreleased" | "active">>;
};

/**
 * Verifica si un usuario tiene acceso para leer un capítulo específico
 *
 * @param user - Usuario (puede ser null si no está logueado)
 * @param permissions - Permisos del usuario en la organización (puede ser null)
 * @param chapter - Capítulo al que se intenta acceder
 * @param manga - Manga al que pertenece el capítulo
 * @returns true si el usuario tiene acceso, false en caso contrario
 *
 * Orden de verificación:
 * 1. Si el manga requiere login y no hay usuario → DENEGAR
 * 2. Si el capítulo ya fue lanzado y NO es solo para suscriptores → PERMITIR
 * 3. Si no hay usuario logueado → DENEGAR
 * 4. Si el usuario tiene permisos especiales (staff) → PERMITIR
 * 5. Si el usuario tiene suscripción activa válida → PERMITIR
 * 6. De lo contrario → DENEGAR
 */
const userHasAccessToChapter = async (
  user: Partial<UserWithSubscriptions>,
  permissions: Pick<Permission, "canReadUnreleased" | "canEditChapter" | "canEditPage"> | null | undefined,
  chapter: Pick<Chapter, "releasedAt" | "subscribersOnly">,
  manga: Pick<MangaCustomWithPlans, "requireLogin" | "subscriptionPlans">
): Promise<boolean> => {
  // 1. Si el manga requiere login y no hay usuario, denegar acceso
  if (!user && manga?.requireLogin === true) {
    return false;
  }

  // 2. Si el capítulo ya fue lanzado y NO es solo para suscriptores, permitir acceso público
  const isChapterReleased =
    new Date(chapter.releasedAt).getTime() < new Date().getTime();
  const isPublicChapter = chapter?.subscribersOnly !== true;

  if (isChapterReleased && isPublicChapter) {
    return true;
  }

  // 3. Si no hay usuario logueado, denegar acceso a capítulos protegidos
  if (!user) {
    return false;
  }

  // 4. Verificar permisos especiales del usuario en la organización (staff)
  // Estos permisos permiten acceso total sin necesidad de suscripción
  if (permissions?.canReadUnreleased === true) return true;
  if (permissions?.canEditChapter === true) return true;
  if (permissions?.canEditPage === true) return true;

  // 5. Verificar suscripciones activas del usuario
  for (const subscription of user?.subscriptions || []) {
    // SECURITY: Validar que la suscripción esté activa y no haya expirado
    if (subscription.active === false) continue;
    if (subscription.status !== "ACTIVE") continue;
    if (subscription.endDate && new Date(subscription.endDate) < new Date()) continue;

    // 5a. Si la suscripción tiene el permiso global canReadUnreleased
    const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
      where: {
        id: subscription?.subscriptionPlanId,
      },
    });

    // SECURITY: Validar que el plan esté activo
    if (!subscriptionPlan?.active) continue;

    if (subscriptionPlan?.canReadUnreleased === true) {
      return true;
    }

    // 5b. Si el manga está asociado a alguno de los planes de suscripción del usuario
    const mangaWithPlans = manga as MangaCustomWithPlans;
    const hasPlanForThisManga = mangaWithPlans?.subscriptionPlans?.find(
      (plan: { id: number; canReadUnreleased?: boolean; active?: boolean }) =>
        plan.id === subscription?.subscriptionPlanId && plan.active !== false
    );

    if (hasPlanForThisManga) {
      return true;
    }
  }

  // 6. Si llegamos aquí, el usuario no tiene acceso
  return false;
};

/**
 * Determina el tipo de error de acceso cuando un usuario no puede acceder a un capítulo
 *
 * @param user - Usuario (puede ser null si no está logueado)
 * @param chapter - Capítulo al que se intenta acceder
 * @param manga - Manga al que pertenece el capítulo
 * @returns Tipo de error: "login_required" | "subscription_required" | "not_released"
 */
export function getAccessDeniedReason(
  user: Partial<UserWithSubscriptions>,
  chapter: Pick<Chapter, "releasedAt" | "subscribersOnly">,
  manga: MangaCustomWithPlans
): "login_required" | "subscription_required" | "not_released" {
  // Si el manga requiere login y no hay usuario
  if (!user && manga?.requireLogin === true) {
    return "login_required";
  }

  // Si el capítulo es solo para suscriptores
  if (chapter?.subscribersOnly === true) {
    return "subscription_required";
  }

  // Si el capítulo aún no ha sido lanzado
  const isChapterReleased =
    new Date(chapter.releasedAt).getTime() < new Date().getTime();
  if (!isChapterReleased) {
    return "not_released";
  }

  // Por defecto, asumir que se requiere suscripción
  return "subscription_required";
}

/**
 * Obtiene el mensaje de error apropiado según el tipo de error de acceso
 *
 * @param errorType - Tipo de error de acceso
 * @returns Mensaje de error localizado
 */
export function getAccessDeniedMessage(
  errorType: "login_required" | "subscription_required" | "not_released"
): string {
  switch (errorType) {
    case "login_required":
      return "Debes iniciar sesión para leer este manga.";
    case "subscription_required":
      return "Este capítulo es exclusivo para suscriptores. Suscríbete para acceder a contenido premium.";
    case "not_released":
      return "Este capítulo aún no ha sido publicado. Solo los suscriptores pueden acceder a capítulos anticipados.";
    default:
      return "No tienes acceso a este capítulo.";
  }
}

/**
 * Verifica acceso y devuelve objeto con resultado completo
 * Útil para endpoints que necesitan devolver información de acceso
 */
export async function checkChapterAccess(
  user: UserWithSubscriptions,
  permissions: Permission,
  chapter: Chapter,
  manga: MangaCustomWithPlans
) {
  const hasAccess = await userHasAccessToChapter(
    user,
    permissions,
    chapter,
    manga
  );

  if (hasAccess) {
    return {
      hasAccess: true,
      errorType: null,
      message: null,
    };
  }

  const errorType = getAccessDeniedReason(user, chapter, manga);
  const message = getAccessDeniedMessage(errorType);

  return {
    hasAccess: false,
    errorType,
    message,
  };
}
