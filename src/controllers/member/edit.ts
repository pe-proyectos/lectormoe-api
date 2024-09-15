import { prisma } from "../../models/prisma";
import type { EditMemberRequest } from "../../types/member/edit";
import { uploadFile } from "../../util/upload-file";

export const editMember = async (
  organizationId: number,
  memberId: number,
  params: EditMemberRequest
) => {
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId,
    },
  });

  if (!member) {
    throw new Error("Member not found for this organization");
  }

  await prisma.member.update({
    where: {
      id: member.id,
    },
    data: {
      role: params.role,
      description: params.description,
      hierarchyLevel: params.hierarchyLevel,
      canSeeAdminPanel: params.canSeeAdminPanel,
      canEditOrganization: params.canEditOrganization,
      canDeleteOrganization: params.canDeleteOrganization,
      canInviteMember: params.canInviteMember,
      canEditMember: params.canEditMember,
      canDeleteMember: params.canDeleteMember,
      canCreateAuthor: params.canCreateAuthor,
      canCreateMangaProfile: params.canCreateMangaProfile,
      canCreateMangaCustom: params.canCreateMangaCustom,
      canEditMangaCustom: params.canEditMangaCustom,
      canDeleteMangaCustom: params.canDeleteMangaCustom,
      canCreateGenre: params.canCreateGenre,
      canEditGenre: params.canEditGenre,
      canDeleteGenre: params.canDeleteGenre,
      canCreateChapter: params.canCreateChapter,
      canEditChapter: params.canEditChapter,
      canDeleteChapter: params.canDeleteChapter,
      canCreatePage: params.canCreatePage,
      canEditPage: params.canEditPage,
      canDeletePage: params.canDeletePage,
      canCreateCoinPack: params.canCreateCoinPack,
      canEditCoinPack: params.canEditCoinPack,
      canDeleteCoinPack: params.canDeleteCoinPack,
    },
  });

  if (params.image && params.image instanceof File) {
    const imageBuffer = await params.image.arrayBuffer();
    const imageUrl = await uploadFile(imageBuffer, params.image.name);
    await prisma.member.update({
      where: {
        id: member.id,
      },
      data: {
        imageUrl,
      },
    });
  }

  return await prisma.member.findFirst({ where: { id: member.id } });
};
