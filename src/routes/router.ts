import { Elysia } from "elysia";

import { router as adsenseMonthlyRevenueRouter } from "./adsense/monthly-revenue";
import { router as analyticsCreateRouter } from "./analytics/create";
import { router as analyticsGetRouter } from "./analytics/get";
import { router as analyticsEmailStatisticsRouter } from "./analytics/email-statistics";
import { router as analyticsEngagementStatisticsRouter } from "./analytics/engagement-statistics";
import { router as authCheckRouter } from "./auth/check";
import { router as authForgotPasswordRouter } from "./auth/forgot_password";
import { router as authLoginRouter } from "./auth/login";
import { router as authLogoutRouter } from "./auth/logout";
import { router as authRegisterRouter } from "./auth/register";
import { router as authResetPasswordRouter } from "./auth/reset_password";
import { router as authVerifyEmailRouter } from "./auth/verify_email";
import { router as emailPreferencesRouter } from "./email/preferences";
import { router as emailUnsubscribeRouter } from "./email/unsubscribe";
import { router as emailCronRouter } from "./email/cron";
import { router as authorCreateRouter } from "./author/create";
import { router as authorListRouter } from "./author/list";
import { router as bookTypeListRouter } from "./book_type/list";
import { router as chapterCreateRouter } from "./chapter/create";
import { router as chapterEditRouter } from "./chapter/edit";
import { router as chapterGetRouter } from "./chapter/get";
import { router as commentCreateRouter } from "./comment/create";
import { router as commentDeleteRouter } from "./comment/delete";
import { router as commentEditRouter } from "./comment/edit";
import { router as commentHideRouter } from "./comment/hide";
import { router as commentLikeRouter } from "./comment/like";
import { router as commentListRouter } from "./comment/list";
import { router as commentListAllRouter } from "./comment/listAll";
import { router as commentRestoreRouter } from "./comment/restore";
import { router as demographyListRouter } from "./demography/list";
import { router as favoritesDeleteRouter } from "./favorites/delete";
import { router as favoritesGetRouter } from "./favorites/get";
import { router as favoritesListRouter } from "./favorites/list";
import { router as favoritesSaveRouter } from "./favorites/save";
import { router as filesPresignedUrlRouter } from "./files/presigned-url";
import { router as genreCreateRouter } from "./genre/create";
import { router as genreDeleteRouter } from "./genre/delete";
import { router as genreEditRouter } from "./genre/edit";
import { router as genreListRouter } from "./genre/list";
import { router as landingFeaturedMangaRouter } from "./landing/featured-manga";
import { router as landingPerOrgPopularRouter } from "./landing/per-org-popular";
import { router as landingScansRouter } from "./landing/scans";
import { router as landingTopCommentersRouter } from "./landing/top-commenters";
import { router as landingTopReadersRouter } from "./landing/top-readers";
import { router as mangaAutocompleteRouter } from "./manga/autocomplete";
import { router as mangaCreateRouter } from "./manga/create";
import { router as mangaGetRouter } from "./manga/get";
import { router as mangaListRouter } from "./manga/list";
import { router as mangaCustomCreateRouter } from "./manga-custom/create";
import { router as mangaCustomEditRouter } from "./manga-custom/edit";
import { router as mangaCustomGetRouter } from "./manga-custom/get";
import { router as mangaCustomListRouter } from "./manga-custom/list";
import { router as mangaCustomRankRouter } from "./manga-custom/rank";
import { router as mangaCustomUpdateUsersAlsoReadRouter } from "./manga-custom/update-users-also-read";
import { router as organizationCheckRouter } from "./organization/check";
import { router as organizationEditRouter } from "./organization/edit";
import { router as organizationFollowRouter } from "./organization/follow";
import { router as organizationListFollowedRouter } from "./organization/list-followed";
import { router as organizationRequestRegistrationRouter } from "./organization/request-registration";
import { router as organizationTopCommentersRouter } from "./organization/top-commenters";
import { router as organizationTopDonorsRouter } from "./organization/top-donors";
import { router as organizationTopReadersRouter } from "./organization/top-readers";
import { router as pagesCreateRouter } from "./pages/create";
import { router as pagesDeleteRouter } from "./pages/delete";
import { router as pagesListRouter } from "./pages/list";
import { router as pagesOrderRouter } from "./pages/order";
import { router as subscriptionCreateRouter } from "./subscription/create";
import { router as subscriptionEditRouter } from "./subscription/edit";
import { router as subscriptionListRouter } from "./subscription/list";
import { router as subscriptionMonthlyRevenueRouter } from "./subscription/monthly-revenue";
import { router as subscriptionPaypalWebhookRouter } from "./subscription/paypal_webhook";
import { router as subscriptionStatisticsRouter } from "./subscription/statistics";
import { router as subscriptionSubscriptionsByPlanRouter } from "./subscription/subscriptions-by-plan";
import { router as subscriptionSyncStatusRouter } from "./subscription/sync-status";
import { router as subscriptionPlanCreateRouter } from "./subscription_plan/create";
import { router as subscriptionPlanEditRouter } from "./subscription_plan/edit";
import { router as subscriptionPlanListRouter } from "./subscription_plan/list";
import { router as transactionsCronRouter } from "./transactions/cron";
import { router as transactionsListRouter } from "./transactions/list";
import { router as userEditRouter } from "./user/edit";
import { router as userListRouter } from "./user/list";
import { router as userPublicProfileRouter } from "./user/public-profile";
import { router as userAchievementsRouter } from "./user/achievements";
import { router as userStatsRouter } from "./user/stats";
import { router as userChapterHistoryListRouter } from "./user-chapter-history/list";
import { router as userChapterHistorySaveChapterRouter } from "./user-chapter-history/save-chapter";
import { router as userChapterHistorySaveRouter } from "./user-chapter-history/save";
import { router as userChapterHistoryUnreadChapterRouter } from "./user-chapter-history/unread-chapter";
import { router as viewsCreateRouter } from "./views/create";
import { router as viewsJointRouter } from "./views/create-joint";
import { router as userChapterHistoryJointRouter } from "./user-chapter-history/save-joint";
import { router as superadminRouter } from "./superadmin/index";
import { router as jointRouter } from "./joint/index";

export const router = () => async (app: Elysia) => {
	console.log('Loading routes...');

	// Analytics
	app.use(analyticsCreateRouter());
	app.use(analyticsGetRouter());
	app.use(analyticsEmailStatisticsRouter());
	app.use(analyticsEngagementStatisticsRouter());

	// Auth
	app.use(authCheckRouter());
	app.use(authForgotPasswordRouter());
	app.use(authResetPasswordRouter());
	app.use(authVerifyEmailRouter());
	app.use(authLoginRouter());
	app.use(authLogoutRouter());
	app.use(authRegisterRouter());

	// Email
	app.use(emailPreferencesRouter());
	app.use(emailUnsubscribeRouter());
	app.use(emailCronRouter());

	// Author
	app.use(authorCreateRouter());
	app.use(authorListRouter());

	// Book Type
	app.use(bookTypeListRouter());

	// Chapter
	app.use(chapterCreateRouter());
	app.use(chapterEditRouter());
	app.use(chapterGetRouter());

	// Comment
	app.use(commentCreateRouter());
	app.use(commentDeleteRouter());
	app.use(commentEditRouter());
	app.use(commentHideRouter());
	app.use(commentLikeRouter());
	app.use(commentListRouter());
	app.use(commentListAllRouter());
	app.use(commentRestoreRouter());

	// Demography
	app.use(demographyListRouter());

	// Favorites
	app.use(favoritesDeleteRouter());
	app.use(favoritesGetRouter());
	app.use(favoritesListRouter());
	app.use(favoritesSaveRouter());

	// Files
	app.use(filesPresignedUrlRouter());

	// Genre
	app.use(genreCreateRouter());
	app.use(genreDeleteRouter());
	app.use(genreEditRouter());
	app.use(genreListRouter());

	// Landing
	app.use(landingFeaturedMangaRouter());
	app.use(landingPerOrgPopularRouter());
	app.use(landingScansRouter());
	app.use(landingTopCommentersRouter());
	app.use(landingTopReadersRouter());

	// Manga
	app.use(mangaAutocompleteRouter());
	app.use(mangaCreateRouter());
	app.use(mangaGetRouter());
	app.use(mangaListRouter());

	// Manga Custom
	app.use(mangaCustomCreateRouter());
	app.use(mangaCustomEditRouter());
	app.use(mangaCustomGetRouter());
	app.use(mangaCustomListRouter());
	app.use(mangaCustomRankRouter());
	app.use(mangaCustomUpdateUsersAlsoReadRouter());

	// Organization
	app.use(organizationCheckRouter());
	app.use(organizationEditRouter());
	app.use(organizationFollowRouter());
	app.use(organizationListFollowedRouter());
	app.use(organizationRequestRegistrationRouter());
	app.use(organizationTopCommentersRouter());
	app.use(organizationTopDonorsRouter());
	app.use(organizationTopReadersRouter());

	// Pages
	app.use(pagesCreateRouter());
	app.use(pagesDeleteRouter());
	app.use(pagesListRouter());
	app.use(pagesOrderRouter());

	// Subscription
	app.use(subscriptionCreateRouter());
	app.use(subscriptionEditRouter());
	app.use(subscriptionListRouter());
	app.use(subscriptionMonthlyRevenueRouter());
	app.use(subscriptionPaypalWebhookRouter());
	app.use(subscriptionStatisticsRouter());
	app.use(subscriptionSubscriptionsByPlanRouter());
	app.use(subscriptionSyncStatusRouter());

	// Subscription Plan
	app.use(subscriptionPlanCreateRouter());
	app.use(subscriptionPlanEditRouter());
	app.use(subscriptionPlanListRouter());

	// Transactions
	app.use(transactionsCronRouter());
	app.use(transactionsListRouter());

	// User
	app.use(userAchievementsRouter());
	app.use(userEditRouter());
	app.use(userListRouter());
	app.use(userPublicProfileRouter());
	app.use(userStatsRouter());

	// User Chapter History
	app.use(userChapterHistoryListRouter());
	app.use(userChapterHistorySaveChapterRouter());
	app.use(userChapterHistorySaveRouter());
	app.use(userChapterHistoryUnreadChapterRouter());

	// Views
	app.use(viewsCreateRouter());
	app.use(viewsJointRouter());

	// User Chapter History (Joint)
	app.use(userChapterHistoryJointRouter());

	// Joint
	app.use(jointRouter());

	// Superadmin
	app.use(superadminRouter());

	// Adsense
	app.use(adsenseMonthlyRevenueRouter());

	console.log('Routes loaded');
	
	return app;
};
