import { Elysia, t } from "elysia";

import { editMember } from "../../controllers/member/edit";
import { loggedMemberOnly } from "../../plugins/auth";
import { EditMemberRequest } from "../../types/member/edit";
import { getMemberById } from "../../controllers/member/get";

export const router = () => new Elysia()
  .use(loggedMemberOnly())
  .patch(
    "/api/member/:memberId",
    async ({ organizationId, member, body, params: { memberId } }) => {
      console.log({canEditMember: member.canEditMember, requestMember: member.id, memberId});
      
    // If the request member is not the same as the member to edit and does not have the permission to edit members
    if (member.id !== memberId && !member.canEditMember) {
      throw new Error("No tiene permisos para editar otros miembros.");
    }
    // Get member to edit
    const memberToEdit = await getMemberById(organizationId, memberId);
    if (!memberToEdit) {
      throw new Error("No se pudo obtener el miembro a editar.");
    }
    // If editing self, allow to change role and description only
    if (member.id === memberToEdit.id) {
      body = {
        description: body.description,
        image: body.image,
      };
    } else if (member.hierarchyLevel < memberToEdit.hierarchyLevel) {
      throw new Error("No tienes permisos para editar este miembro.");
    }

    if (member.id !== memberToEdit.id && body.hierarchyLevel && member.hierarchyLevel < body.hierarchyLevel) {
      throw new Error("No tienes permisos para asignar un nivel de jerarquía mayor al tuyo.");
    }

    const updatedMember = await editMember(organizationId, memberToEdit.id, body);

    if (!updatedMember) {
      throw new Error("No se pudo editar el miembro.");
    }

    return {
      status: true,
      data: updatedMember,
    };
  },
  {
    params: t.Object({
      memberId: t.Number(),
    }),
    body: EditMemberRequest,
    response: t.Object({
      status: t.Boolean(),
      data: t.Any(),
    }),
    transform({ params, body }) {
      if (params.memberId) {
        params.memberId = Number.parseInt(params.memberId.toString());
      }
      if (body.hierarchyLevel) {
        body.hierarchyLevel = Number.parseInt(body.hierarchyLevel.toString());
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
      if (body.canInviteMember) {
        body.canInviteMember = body.canInviteMember.toString() === "true";
      }
      if (body.canEditMember) {
        body.canEditMember = body.canEditMember.toString() === "true";
      }
      if (body.canDeleteMember) {
        body.canDeleteMember = body.canDeleteMember.toString() === "true";
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
      if (body.canCreateCoinPack) {
        body.canCreateCoinPack = body.canCreateCoinPack.toString() === "true";
      }
      if (body.canEditCoinPack) {
        body.canEditCoinPack = body.canEditCoinPack.toString() === "true";
      }
      if (body.canDeleteCoinPack) {
        body.canDeleteCoinPack = body.canDeleteCoinPack.toString() === "true";
      }
    },
  }
);
