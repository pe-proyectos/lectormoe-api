import { Elysia, t } from "elysia";

import { editUser } from "../../controllers/user/edit";
import { loggedUserOnly } from "../../plugins/auth";
import { EditUserRequest } from "../../types/user/edit";
import { getUserById } from "../../controllers/user/get";

export const router = () =>
  new Elysia().use(loggedUserOnly()).patch(
    "/api/user/:userId",
    async ({ organizationId, user, body, params: { userId } }) => {
      // If the request user is not the same as the user to edit and does not have the permission to edit users
      if (user.id !== userId && !user.canEditUser) {
        throw new Error("No tiene permisos para editar otros usuarios.");
      }
      // Get user to edit
      const userToEdit = await getUserById(organizationId, userId);
      if (!userToEdit) {
        throw new Error("No se pudo obtener el usuario a editar.");
      }
      // If editing self, allow to change role and description only
      if (user.id === userToEdit.id) {
        // body = {
        //   description: body.description,
        //   image: body.image,
        // };
      } else if (user.hierarchyLevel < userToEdit.hierarchyLevel) {
        throw new Error("No tienes permisos para editar este usuario.");
      }

      if (
        user.id !== userToEdit.id &&
        body.hierarchyLevel &&
        user.hierarchyLevel < body.hierarchyLevel
      ) {
        throw new Error(
          "No tienes permisos para asignar un nivel de jerarquía mayor al tuyo."
        );
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
        if (body.canSeeAdminPanel) {
          body.canSeeAdminPanel = body.canSeeAdminPanel.toString() === "true";
        }
        if (body.canEditOrganization) {
          body.canEditOrganization =
            body.canEditOrganization.toString() === "true";
        }
        if (body.canDeleteOrganization) {
          body.canDeleteOrganization =
            body.canDeleteOrganization.toString() === "true";
        }
        if (body.canEditUser) {
          body.canEditUser = body.canEditUser.toString() === "true";
        }
        if (body.canDeleteUser) {
          body.canDeleteUser = body.canDeleteUser.toString() === "true";
        }
        if (body.canCreateAuthor) {
          body.canCreateAuthor = body.canCreateAuthor.toString() === "true";
        }
        if (body.canCreateMangaProfile) {
          body.canCreateMangaProfile =
            body.canCreateMangaProfile.toString() === "true";
        }
        if (body.canCreateMangaCustom) {
          body.canCreateMangaCustom =
            body.canCreateMangaCustom.toString() === "true";
        }
        if (body.canEditMangaCustom) {
          body.canEditMangaCustom =
            body.canEditMangaCustom.toString() === "true";
        }
        if (body.canDeleteMangaCustom) {
          body.canDeleteMangaCustom =
            body.canDeleteMangaCustom.toString() === "true";
        }
        if (body.canCreateGenre) {
          body.canCreateGenre = body.canCreateGenre.toString() === "true";
        }
        if (body.canEditGenre) {
          body.canEditGenre = body.canEditGenre.toString() === "true";
        }
        if (body.canDeleteGenre) {
          body.canDeleteGenre = body.canDeleteGenre.toString() === "true";
        }
        if (body.canCreateChapter) {
          body.canCreateChapter = body.canCreateChapter.toString() === "true";
        }
        if (body.canEditChapter) {
          body.canEditChapter = body.canEditChapter.toString() === "true";
        }
        if (body.canDeleteChapter) {
          body.canDeleteChapter = body.canDeleteChapter.toString() === "true";
        }
        if (body.canCreatePage) {
          body.canCreatePage = body.canCreatePage.toString() === "true";
        }
        if (body.canEditPage) {
          body.canEditPage = body.canEditPage.toString() === "true";
        }
        if (body.canDeletePage) {
          body.canDeletePage = body.canDeletePage.toString() === "true";
        }
        if (body.canCreateSubscriptionPlan) {
          body.canCreateSubscriptionPlan =
            body.canCreateSubscriptionPlan.toString() === "true";
        }
        if (body.canEditSubscriptionPlan) {
          body.canEditSubscriptionPlan =
            body.canEditSubscriptionPlan.toString() === "true";
        }
        if (body.canDeleteSubscriptionPlan) {
          body.canDeleteSubscriptionPlan =
            body.canDeleteSubscriptionPlan.toString() === "true";
        }
        if (body.canDeleteComment) {
          body.canDeleteComment = body.canDeleteComment.toString() === "true";
        }
        if (body.canEditComment) {
          body.canEditComment = body.canEditComment.toString() === "true";
        }
        if (body.canHideComment) {
          body.canHideComment = body.canHideComment.toString() === "true";
        }
        if (body.hideAds) {
          body.hideAds = body.hideAds.toString() === "true";
        }
        if (body.canDownload) {
          body.canDownload = body.canDownload.toString() === "true";
        }
        if (body.canReadUnreleased) {
          body.canReadUnreleased = body.canReadUnreleased.toString() === "true";
        }
      },
    }
  );
