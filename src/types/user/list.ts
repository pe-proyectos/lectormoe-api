import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export enum OrderEnum {
    USERNAME_ASC = 'username_asc',
    USERNAME_DESC = 'username_desc',
    CREATED_AT_ASC = 'createdAt_asc',
    CREATED_AT_DESC = 'createdAt_desc',
}

export const UserListQuery = t.Object({
    username: t.Optional(t.String()),
    email: t.Optional(t.String()),
    order: t.Optional(t.Enum(OrderEnum)),
    subscriptionPlanIds: t.Optional(t.Array(t.Number())),
    ...PaginationQuery.properties,
});

export type UserListQuery = Static<typeof UserListQuery>;
