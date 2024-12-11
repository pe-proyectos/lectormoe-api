import { prisma } from "../../models/prisma";
import type { EditUserRequest } from "../../types/user/edit";
import { uploadFile } from "../../util/upload-file";

export const editUser = async (
  organizationId: number,
  userId: number,
  params: EditUserRequest
) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
    },
  });

  if (!user) {
    throw new Error("User not found for this organization");
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      role: params.role,
      description: params.description,
      hierarchyLevel: params.hierarchyLevel,
      canSeeAdminPanel: params.canSeeAdminPanel,
      canEditOrganization: params.canEditOrganization,
      canDeleteOrganization: params.canDeleteOrganization,
      canEditUser: params.canEditUser,
      canDeleteUser: params.canDeleteUser,
      canCreateAuthor: params.canCreateAuthor,
      canCreateMangaProfile: params.canCreateMangaProfile,
      canCreateMangaCustom: params.canCreateMangaCustom,
      canEditMangaCustom: params.canEditMangaCustom,
      canDeleteMangaCustom: params.canDeleteMangaCustom,
      canCreateGenre: params.canCreateGenre,
      canEditGenre: params.canEditGenre,
      canDeleteGenre: params.canDeleteGenre,
      canReadUnreleasedChapter: params.canReadUnreleasedChapter,
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
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        imageUrl,
      },
    });
  }

  return await prisma.user.findFirst({ where: { id: user.id } });
};
