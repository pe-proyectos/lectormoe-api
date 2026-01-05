import { Elysia, t } from "elysia";
import { requestRegistration } from "../../controllers/organization/request-registration";
import { RequestRegistrationBody } from "../../types/organization/request-registration";

export const router = () => new Elysia()
    .post(
        "/api/organization/request-registration",
        async ({ body }) => {
            return await requestRegistration(body);
        },
        {
            body: RequestRegistrationBody,
            detail: {
                tags: ["Organization"],
                summary: "Request organization registration",
                description: "Submit a request to register a new scan/organization",
            },
            response: {
                200: t.Object({
                    status: t.Literal(true),
                    data: t.Object({
                        id: t.Number(),
                        message: t.String(),
                    }),
                }),
            },
        }
    );

