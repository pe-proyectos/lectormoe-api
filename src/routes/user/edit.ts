import { Elysia, t } from "elysia";

import { editUser } from "../../controllers/user/edit";
import { logged } from "../../plugins/auth";
import { useOrganizationOptional } from "../../plugins/organization";
import { EditUserRequest } from "../../types/user/edit";
import { getUserById } from "../../controllers/user/get";

export const router = () =>
  new Elysia()
    .use(useOrganizationOptional())
    .use(logged())
    .patch(
    "/api/user/:userId",
    async ({ organizationId, user, body, params: { userId } }) => {
      // Get permissions if organizationId is provided
      let permissions = user.permissions.find((permission: any) => permission.organizationId === organizationId);
      // If the request user is not the same as the user to edit and does not have the permission to edit users
      if (user.id !== userId && !permissions?.canEditUser) {
        throw new Error("No tiene permisos para editar otros usuarios.");
      }
      // Get user to edit — search globally so admins can edit users without existing org permissions
      const userToEdit = await getUserById(null, userId);
      if (!userToEdit) {
        throw new Error("No se pudo obtener el usuario a editar.");
      }
      
      // Obtener permisos del usuario a editar para comparar hierarchyLevel (solo si hay organizationId)
      let userToEditHierarchyLevel: number | null = null;
      let currentUserHierarchyLevel = 0;
      
      if (organizationId !== null && permissions) {
        const { getUserHierarchyLevel } = await import('../../util/permissions');
        userToEditHierarchyLevel = await getUserHierarchyLevel(userToEdit.id, organizationId);
        currentUserHierarchyLevel = permissions.hierarchyLevel ?? 0;
      }
      
      // If editing self, allow to change profile fields (description, image, banner, username)
      // If editing others, check hierarchy level (solo si hay organizationId)
      if (user.id !== userToEdit.id) {
        if (organizationId !== null && userToEditHierarchyLevel !== null && currentUserHierarchyLevel < userToEditHierarchyLevel) {
          throw new Error("No tienes permisos para editar este usuario.");
        }

        if (organizationId !== null && body.hierarchyLevel && currentUserHierarchyLevel < body.hierarchyLevel) {
          throw new Error(
            "No tienes permisos para asignar un nivel de jerarquía mayor al tuyo."
          );
        }
      }

      const updatedUser = await editUser(organizationId, userToEdit.id, body);

      if (!updatedUser) {
        throw new Error("No se pudo editar el miembro.");
      }

      return {
        status: true,
        data: updatedUser,
      };
    },
    {
      params: t.Object({
        userId: t.Number(),
      }),
      body: EditUserRequest,
      response: t.Object({
        status: t.Boolean(),
        data: t.Any(),
      }),
      transform({ params, body }) {
        if (params.userId) {
          params.userId = Number.parseInt(params.userId.toString());
        }
        if (body.hierarchyLevel) {
          body.hierarchyLevel = Number.parseInt(body.hierarchyLevel.toString());
        }
        if(body.birthdate){
          body.birthdate = new Date(body.birthdate);
        }
        // Convertir todos los permisos booleanos de string a boolean
        // Nota: FormData convierte todo a string, así que "true" -> true, "false" -> false
        if (body.canSeeAdminPanel !== undefined) {
          body.canSeeAdminPanel = body.canSeeAdminPanel.toString() === "true";
        }
        if (body.canEditOrganization !== undefined) {
          body.canEditOrganization =
            body.canEditOrganization.toString() === "true";
        }
        if (body.canDeleteOrganization !== undefined) {
          body.canDeleteOrganization =
            body.canDeleteOrganization.toString() === "true";
        }
        if (body.canEditUser !== undefined) {
          body.canEditUser = body.canEditUser.toString() === "true";
        }
        if (body.canDeleteUser !== undefined) {
          body.canDeleteUser = body.canDeleteUser.toString() === "true";
        }
        if (body.canCreateAuthor !== undefined) {
          body.canCreateAuthor = body.canCreateAuthor.toString() === "true";
        }
        if (body.canCreateMangaProfile !== undefined) {
          body.canCreateMangaProfile =
            body.canCreateMangaProfile.toString() === "true";
        }
        if (body.canCreateMangaCustom !== undefined) {
          body.canCreateMangaCustom =
            body.canCreateMangaCustom.toString() === "true";
        }
        if (body.canEditMangaCustom !== undefined) {
          body.canEditMangaCustom =
            body.canEditMangaCustom.toString() === "true";
        }
        if (body.canDeleteMangaCustom !== undefined) {
          body.canDeleteMangaCustom =
            body.canDeleteMangaCustom.toString() === "true";
        }
        if (body.canCreateGenre !== undefined) {
          body.canCreateGenre = body.canCreateGenre.toString() === "true";
        }
        if (body.canEditGenre !== undefined) {
          body.canEditGenre = body.canEditGenre.toString() === "true";
        }
        if (body.canDeleteGenre !== undefined) {
          body.canDeleteGenre = body.canDeleteGenre.toString() === "true";
        }
        if (body.canCreateChapter !== undefined) {
          body.canCreateChapter = body.canCreateChapter.toString() === "true";
        }
        if (body.canEditChapter !== undefined) {
          body.canEditChapter = body.canEditChapter.toString() === "true";
        }
        if (body.canDeleteChapter !== undefined) {
          body.canDeleteChapter = body.canDeleteChapter.toString() === "true";
        }
        if (body.canCreatePage !== undefined) {
          body.canCreatePage = body.canCreatePage.toString() === "true";
        }
        if (body.canEditPage !== undefined) {
          body.canEditPage = body.canEditPage.toString() === "true";
        }
        if (body.canDeletePage !== undefined) {
          body.canDeletePage = body.canDeletePage.toString() === "true";
        }
        if (body.canCreateSubscriptionPlan !== undefined) {
          body.canCreateSubscriptionPlan =
            body.canCreateSubscriptionPlan.toString() === "true";
        }
        if (body.canEditSubscriptionPlan !== undefined) {
          body.canEditSubscriptionPlan =
            body.canEditSubscriptionPlan.toString() === "true";
        }
        if (body.canDeleteSubscriptionPlan !== undefined) {
          body.canDeleteSubscriptionPlan =
            body.canDeleteSubscriptionPlan.toString() === "true";
        }
        if (body.canDeleteComment !== undefined) {
          body.canDeleteComment = body.canDeleteComment.toString() === "true";
        }
        if (body.canEditComment !== undefined) {
          body.canEditComment = body.canEditComment.toString() === "true";
        }
        if (body.canHideComment !== undefined) {
          body.canHideComment = body.canHideComment.toString() === "true";
        }
        if (body.hideAds !== undefined) {
          body.hideAds = body.hideAds.toString() === "true";
        }
        if (body.canDownload !== undefined) {
          body.canDownload = body.canDownload.toString() === "true";
        }
        if (body.canReadUnreleased !== undefined) {
          body.canReadUnreleased = body.canReadUnreleased.toString() === "true";
        }
        // Handle banner: convert "null" string to null, or keep as string
        if (body.banner !== undefined) {
          if (body.banner === "null" || body.banner === null || body.banner === "") {
            body.banner = null;
          }
        }
        // Handle image: convert "null" string to null, or keep as string
        if (body.image !== undefined) {
          if (body.image === "null" || body.image === null || body.image === "") {
            body.image = null;
          }
        }
      },
    }
  );
