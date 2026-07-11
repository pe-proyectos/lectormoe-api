import { t } from "elysia";

export const RequestRegistrationBody = t.Object({
    applicantName: t.String({ minLength: 1, maxLength: 256 }),
    // Ignorado: el email se toma de la cuenta logueada. Se acepta por
    // compatibilidad con clientes que aun lo envian.
    applicantEmail: t.Optional(t.String({ maxLength: 256 })),
    scanName: t.String({ minLength: 1, maxLength: 256 }),
    references: t.String({ minLength: 1 }),
    previousWorks: t.String({ minLength: 1 }),
    estimatedMonthlyReaders: t.String({ minLength: 1, maxLength: 50 }),
});

export type RequestRegistrationRequest = typeof RequestRegistrationBody.static;

