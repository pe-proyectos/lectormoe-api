import { type Static, t } from 'elysia';
import { PaginationQuery } from '../common/pagination';

export enum OrderEnum {
    USERNAME_ASC = 'username_asc',
    USERNAME_DESC = 'username_desc',
    CREATED_AT_ASC = 'createdAt_asc',
    CREATED_AT_DESC = 'createdAt_desc',
    COINS_ASC = 'coins_asc',
    COINS_DESC = 'coins_desc',
}

export const MemberListQuery = t.Object({
    username: t.Optional(t.String()),
    email: t.Optional(t.String()),
    order: t.Optional(t.Enum(OrderEnum)),
    ...PaginationQuery.properties,
});

export type MemberListQuery = Static<typeof MemberListQuery>;
