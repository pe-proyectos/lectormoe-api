# Agregar un nuevo campo a Organization (Backend)

## 1. Prisma Schema

`prisma/schema.prisma` — agregar el campo al modelo `Organization`:

```prisma
model Organization {
  // ...
  miNuevoCampo Boolean @default(false)
}
```

Luego correr la migración:

```bash
bunx prisma migrate dev --name add-mi-nuevo-campo-to-organization
```

---

## 2. Si el campo es editable por el admin de la org

### `src/types/organization/edit.ts`

Agregar el campo al tipo del request:

```typescript
export const EditOrganizationRequest = t.Object({
  // ...
  miNuevoCampo: t.Optional(t.Boolean()),
})
```

### `src/controllers/organization/edit.ts`

Incluirlo en el `data` del update:

```typescript
await prisma.organization.update({
  where: { id: organization.id },
  data: {
    // ...
    miNuevoCampo: body.miNuevoCampo,
  },
})
```

---

## 3. Si el campo necesita mostrarse en páginas públicas de landing

Los siguientes archivos usan `select` explícito — hay que agregar el campo manualmente si se necesita:

- `src/controllers/landing/featured-manga.ts`
- `src/controllers/landing/per-org-popular.ts`
- `src/controllers/landing/scans.ts`
- `src/controllers/organization/list-followed.ts`

```typescript
select: {
  id: true,
  slug: true,
  // ...
  miNuevoCampo: true, // agregar aquí
}
```

---

## Lo que NO hay que tocar

- `src/controllers/organization/check.ts` — usa `include` sin `select`, retorna todos los campos automáticamente
- Cualquier query que use `findUnique`/`findFirst` sin `select` explícito
