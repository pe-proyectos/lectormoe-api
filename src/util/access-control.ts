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
    active?: boolean;
    endDate?: Date | null;
    subscriptionPlan?: Pick<SubscriptionPlan, "id" | "canReadUnreleased" | "active">;
  }>;
};

type MangaCustomWithPlans = Pick<MangaCustom, "id" | "requireLogin"> & {
  organizationId?: number;
  subscriptionPlansCanReadUnreleased?: Array<Pick<SubscriptionPlan, "id" | "canReadUnreleased" | "active" | "name">>;
  subscriptionPlansCanReadReleased?: Array<Pick<SubscriptionPlan, "id" | "canReadUnreleased" | "active" | "name">>;
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
 * Lógica:
 * 1. Si el manga requiere login y no hay usuario → DENEGAR
 * 2. Si el usuario tiene permisos especiales (staff) → PERMITIR
 * 3. Verificar si el capítulo ya fue lanzado:
 *    - Si SÍ fue lanzado:
 *      - Si subscriptionPlansCanReadReleased está configurado → Solo esos planes pueden leer (no usuarios gratuitos)
 *      - Si subscriptionPlansCanReadReleased está vacío → Todos pueden leer (gratuitos y suscriptores)
 *    - Si NO fue lanzado:
 *      - Si subscriptionPlansCanReadUnreleased está configurado → Solo esos planes pueden leer
 *      - Si subscriptionPlansCanReadUnreleased está vacío → Nadie puede leer
 */
const userHasAccessToChapter = async (
  user: Partial<UserWithSubscriptions>,
  permissions: Pick<Permission, "canReadUnreleased" | "canEditChapter" | "canEditPage"> | null | undefined,
  chapter: Pick<Chapter, "releasedAt">,
  manga: Pick<MangaCustomWithPlans, "requireLogin" | "subscriptionPlansCanReadUnreleased" | "subscriptionPlansCanReadReleased">
): Promise<boolean> => {
  // 1. Si el manga requiere login y no hay usuario, denegar acceso
  if (!user && manga?.requireLogin === true) {
    return false;
  }

  // 2. Verificar permisos especiales del usuario en la organización (staff)
  // Estos permisos permiten acceso total sin necesidad de suscripción
  if (permissions?.canReadUnreleased === true) return true;
  if (permissions?.canEditChapter === true) return true;
  if (permissions?.canEditPage === true) return true;

  const mangaWithPlans = manga as MangaCustomWithPlans;
  const isChapterReleased = chapter.releasedAt
    ? new Date(chapter.releasedAt).getTime() < new Date().getTime()
    : false; // null releasedAt = no lanzado

  // 3. Verificar acceso según si el capítulo fue lanzado o no
  if (isChapterReleased) {
    // Capítulo ya fue lanzado
    const hasCanReadReleasedPlans = (mangaWithPlans?.subscriptionPlansCanReadReleased?.length ?? 0) > 0;

    if (hasCanReadReleasedPlans) {
      // Solo usuarios con planes en subscriptionPlansCanReadReleased pueden leer
      if (!user) return false;

      for (const subscription of user?.subscriptions || []) {
        if (subscription.active === false) continue;
        if (subscription.endDate && new Date(subscription.endDate) < new Date()) continue;

        const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: subscription?.subscriptionPlan?.id },
        });

        if (!subscriptionPlan?.active) continue;

        const hasPlan = mangaWithPlans?.subscriptionPlansCanReadReleased?.find(
          (plan: { id: number; active?: boolean }) =>
            plan.id === subscription?.subscriptionPlan?.id && plan.active !== false
        );

        if (hasPlan) {
          return true;
        }
      }

      return false; // Usuario no tiene un plan permitido
    } else {
      // subscriptionPlansCanReadReleased está vacío → Todos pueden leer (gratuitos y suscriptores)
      return true;
    }
  } else {
    // Capítulo NO ha sido lanzado
    const hasCanReadUnreleasedPlans = (mangaWithPlans?.subscriptionPlansCanReadUnreleased?.length ?? 0) > 0;

    if (hasCanReadUnreleasedPlans) {
      // Solo usuarios con planes en subscriptionPlansCanReadUnreleased pueden leer
      if (!user) return false;

      for (const subscription of user?.subscriptions || []) {
        if (subscription.active === false) continue;
        if (subscription.endDate && new Date(subscription.endDate) < new Date()) continue;

        const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: subscription?.subscriptionPlan?.id },
        });

        if (!subscriptionPlan?.active) continue;

        const hasPlan = mangaWithPlans?.subscriptionPlansCanReadUnreleased?.find(
          (plan: { id: number; active?: boolean }) =>
            plan.id === subscription?.subscriptionPlan?.id && plan.active !== false
        );

        if (hasPlan) {
          return true;
        }
      }

      return false; // Usuario no tiene un plan permitido
    } else {
      // subscriptionPlansCanReadUnreleased está vacío → la obra NO restringe
      // planes específicos para el adelanto. Se respeta el flag del plan: cualquier
      // suscriptor con un plan ACTIVO del MISMO scan y con canReadUnreleased=true
      // puede leer el adelanto. (Antes: nadie podía; el flag del plan se ignoraba,
      // lo que dejaba a suscriptores pagados sin acceso al contenido anticipado.)
      if (!user) return false;

      const orgId = mangaWithPlans?.organizationId;

      for (const subscription of user?.subscriptions || []) {
        if (subscription.active === false) continue;
        if (subscription.endDate && new Date(subscription.endDate) < new Date()) continue;

        const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: subscription?.subscriptionPlan?.id },
        });

        if (!subscriptionPlan?.active) continue;
        if (subscriptionPlan.canReadUnreleased !== true) continue;
        // Seguridad: la suscripción debe ser del MISMO scan que la obra.
        // Si no conocemos el org de la obra, fallar cerrado (no dar acceso cruzado).
        if (!orgId || subscriptionPlan.organizationId !== orgId) continue;

        return true;
      }

      return false;
    }
  }
};

/**
 * Determina el tipo de error de acceso cuando un usuario no puede acceder a un capítulo
 *
 * @param user - Usuario (puede ser null si no está logueado)
 * @param chapter - Capítulo al que se intenta acceder
 * @param manga - Manga al que pertenece el capítulo
 * @returns Tipo de error: "login_required" | "subscription_required" | "not_released" | "subscription_plan_required"
 */
export function getAccessDeniedReason(
  user: Partial<UserWithSubscriptions>,
  chapter: Pick<Chapter, "releasedAt">,
  manga: MangaCustomWithPlans
): "login_required" | "subscription_required" | "not_released" | "subscription_plan_required" {
  // Si el manga requiere login y no hay usuario
  if (!user && manga?.requireLogin === true) {
    return "login_required";
  }

  const isChapterReleased = chapter.releasedAt
    ? new Date(chapter.releasedAt).getTime() < new Date().getTime()
    : false; // null releasedAt = no lanzado

  if (isChapterReleased) {
    const hasCanReadReleasedPlans = (manga?.subscriptionPlansCanReadReleased?.length ?? 0) > 0;
    if (hasCanReadReleasedPlans) {
      return "subscription_plan_required";
    }
    return "subscription_required";
  } else {
    const hasCanReadUnreleasedPlans = (manga?.subscriptionPlansCanReadUnreleased?.length ?? 0) > 0;
    if (hasCanReadUnreleasedPlans) {
      return "subscription_plan_required";
    }
    return "not_released";
  }
}

/**
 * Obtiene el mensaje de error apropiado según el tipo de error de acceso
 *
 * @param errorType - Tipo de error de acceso
 * @param manga - Manga al que pertenece el capítulo (para obtener nombres de planes)
 * @param isReleased - Si el capítulo ya fue lanzado
 * @returns Mensaje de error localizado
 */
export function getAccessDeniedMessage(
  errorType: "login_required" | "subscription_required" | "not_released" | "subscription_plan_required",
  manga?: MangaCustomWithPlans,
  isReleased?: boolean
): string {
  switch (errorType) {
    case "login_required":
      return "Debes iniciar sesión para leer este manga.";
    case "subscription_required":
      return "Este capítulo es exclusivo para suscriptores. Suscríbete para acceder a contenido premium.";
    case "not_released":
      return "Este capítulo aún no ha sido publicado.";
    case "subscription_plan_required": {
      if (!manga) {
        return "No tienes acceso a este capítulo. Se requiere una suscripción específica.";
      }
      const plans = isReleased 
        ? manga.subscriptionPlansCanReadReleased 
        : manga.subscriptionPlansCanReadUnreleased;
      if (plans && plans.length > 0) {
        const planNames = plans.map((p: any) => p.name || `Plan ${p.id}`).join(", ");
        return `Este capítulo requiere uno de los siguientes planes: ${planNames}.`;
      }
      return "No tienes acceso a este capítulo. Se requiere una suscripción específica.";
    }
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
      requiredPlans: null,
    };
  }

  const isChapterReleased = chapter.releasedAt
    ? new Date(chapter.releasedAt).getTime() < new Date().getTime()
    : false; // null releasedAt = no lanzado
  const errorType = getAccessDeniedReason(user, chapter, manga);
  const message = getAccessDeniedMessage(errorType, manga, isChapterReleased);
  
  // Obtener planes requeridos para el mensaje
  let requiredPlans: Array<{ id: number; name: string }> | null = null;
  if (errorType === "subscription_plan_required") {
    if (isChapterReleased) {
      requiredPlans = (manga.subscriptionPlansCanReadReleased || []).map((p: any) => ({
        id: p.id,
        name: p.name || `Plan ${p.id}`
      }));
    } else {
      requiredPlans = (manga.subscriptionPlansCanReadUnreleased || []).map((p: any) => ({
        id: p.id,
        name: p.name || `Plan ${p.id}`
      }));
    }
  }

  return {
    hasAccess: false,
    errorType,
    message,
    requiredPlans,
  };
}
