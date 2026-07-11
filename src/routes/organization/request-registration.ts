import { Elysia, t } from "elysia";
import { requestRegistration } from "../../controllers/organization/request-registration";
import { RequestRegistrationBody } from "../../types/organization/request-registration";
import { loggedUserOnlyGlobal } from "../../plugins/auth";

export const router = () => new Elysia()
    .use(loggedUserOnlyGlobal())
    .post(
        "/api/organization/request-registration",
        async ({ body, user }) => {
            return await requestRegistration(body, { id: user.id, username: user.username, email: user.email });
        },
        {
            body: RequestRegistrationBody,
            detail: {
                tags: ["Organization"],
                summary: "Request organization registration",
                description: "Submit a request to register a new scan/organization",
            },
            response: t.Object({
                status: t.Boolean(),
                data: t.Object({
                    id: t.Number(),
                    message: t.String(),
                }),
            }),
        }
    );

