# Sistema de Control de Acceso a Capítulos

Este módulo proporciona funciones centralizadas para verificar el acceso de usuarios a capítulos de manga.

## 🎯 Objetivo

Evitar duplicación de lógica y garantizar consistencia en todas las verificaciones de acceso a capítulos.

## 📦 Funciones Disponibles

### `userHasAccessToChapter(user, permissions, chapter, manga): boolean`

Verifica si un usuario tiene acceso para leer un capítulo específico.

**Parámetros:**
- `user`: Usuario con suscripciones (puede ser null)
- `permissions`: Permisos del usuario en la organización (puede ser null)
- `chapter`: Capítulo al que se intenta acceder
- `manga`: Manga al que pertenece el capítulo

**Retorna:** `true` si tiene acceso, `false` en caso contrario

**Ejemplo:**
```typescript
import { userHasAccessToChapter } from '../../util/access-control';

const hasAccess = userHasAccessToChapter(user, permissions, chapter, manga);
if (!hasAccess) {
  // Denegar acceso
}
```

---

### `getAccessDeniedReason(user, chapter, manga): string`

Determina el tipo de error cuando un usuario no tiene acceso.

**Retorna:** 
- `"login_required"` - El manga requiere login
- `"subscription_required"` - El capítulo es solo para suscriptores
- `"not_released"` - El capítulo aún no ha sido lanzado

**Ejemplo:**
```typescript
import { getAccessDeniedReason } from '../../util/access-control';

const errorType = getAccessDeniedReason(user, chapter, manga);
```

---

### `getAccessDeniedMessage(errorType): string`

Obtiene el mensaje de error localizado según el tipo de error.

**Ejemplo:**
```typescript
import { getAccessDeniedMessage } from '../../util/access-control';

const message = getAccessDeniedMessage("subscription_required");
// "Este capítulo es exclusivo para suscriptores..."
```

---

### `checkChapterAccess(user, permissions, chapter, manga): object`

Función todo-en-uno que verifica acceso y devuelve resultado completo.

**Retorna:**
```typescript
{
  hasAccess: boolean;
  errorType: "login_required" | "subscription_required" | "not_released" | null;
  message: string | null;
}
```

**Ejemplo:**
```typescript
import { checkChapterAccess } from '../../util/access-control';

const accessCheck = checkChapterAccess(user, permissions, chapter, manga);

if (!accessCheck.hasAccess) {
  return {
    status: false,
    message: accessCheck.message,
    errorType: accessCheck.errorType
  };
}

// Usuario tiene acceso, continuar...
```

## 🔐 Lógica de Verificación

El sistema verifica el acceso en el siguiente orden (prioridad de mayor a menor):

### 1️⃣ Manga con `requireLogin: true`
```typescript
if (!user && manga.requireLogin === true) {
  return false; // DENEGAR
}
```

### 2️⃣ Capítulos públicos ya lanzados
```typescript
if (chapter.releasedAt < now && !chapter.subscribersOnly) {
  return true; // PERMITIR
}
```

### 3️⃣ Permisos especiales de staff (tabla `permissions`)
```typescript
if (permissions?.canReadUnreleased === true) return true;
if (permissions?.canEditChapter === true) return true;
if (permissions?.canEditPage === true) return true;
```

**⚠️ IMPORTANTE:** Estos permisos están en la tabla `permissions`, NO en el objeto `user`.

### 4️⃣ Suscripciones activas
```typescript
// Plan con permiso global canReadUnreleased
if (subscription.subscriptionPlan.canReadUnreleased === true) return true;

// Plan asociado al manga
if (manga.subscriptionPlans.includes(subscription.subscriptionPlan)) return true;
```

### 5️⃣ Por defecto
```typescript
return false; // DENEGAR
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│         Endpoints que requieren validación      │
│  /api/manga-custom/:slug/chapter/:number       │
│  /api/manga-custom/:slug/chapter/:number/pages │
└────────────────┬────────────────────────────────┘
                 │
                 ├─ imports
                 ↓
┌─────────────────────────────────────────────────┐
│      src/util/access-control.ts                 │
│                                                  │
│  ✓ userHasAccessToChapter()                    │
│  ✓ getAccessDeniedReason()                     │
│  ✓ getAccessDeniedMessage()                    │
│  ✓ checkChapterAccess()                        │
└─────────────────────────────────────────────────┘
```

## 📝 Uso Recomendado

### Para endpoints que devuelven datos del capítulo
```typescript
import { checkChapterAccess } from '../../util/access-control';

const accessCheck = checkChapterAccess(user, permissions, chapter, manga);

return {
  status: true,
  data: {
    ...chapter,
    hasAccess: accessCheck.hasAccess,
    accessDeniedReason: accessCheck.errorType
  }
};
```

### Para endpoints que bloquean acceso
```typescript
import { checkChapterAccess } from '../../util/access-control';

const accessCheck = checkChapterAccess(user, permissions, chapter, manga);

if (!accessCheck.hasAccess) {
  return {
    status: false,
    message: accessCheck.message,
    errorType: accessCheck.errorType
  };
}

// Continuar con la lógica...
```

## ⚠️ Errores Comunes a Evitar

### ❌ NO hacer esto (verifica `user` en lugar de `permissions`)
```typescript
if (user?.canReadUnreleased === true) return true;
```

### ✅ Hacer esto (verifica `permissions`)
```typescript
if (permissions?.canReadUnreleased === true) return true;
```

### ❌ NO duplicar la lógica
```typescript
// Cada endpoint con su propia verificación
const canAccess = () => {
  if (!user && manga.requireLogin) return false;
  // ... 40 líneas más ...
};
```

### ✅ Usar la función centralizada
```typescript
import { checkChapterAccess } from '../../util/access-control';

const accessCheck = checkChapterAccess(user, permissions, chapter, manga);
```

## 🧪 Testing

Para probar diferentes escenarios:

```typescript
// Capítulo público
const chapter = { releasedAt: pastDate, subscribersOnly: false };
const manga = { requireLogin: false };
// Resultado: true (público, todos pueden acceder)

// Capítulo protegido con staff
const permissions = { canReadUnreleased: true };
// Resultado: true (staff puede acceder)

// Capítulo protegido con suscripción
const user = {
  subscriptions: [{
    subscriptionPlan: { id: 1, canReadUnreleased: false }
  }]
};
const manga = { subscriptionPlans: [{ id: 1 }] };
// Resultado: true (tiene suscripción válida)

// Sin acceso
const user = null;
const permissions = null;
const chapter = { subscribersOnly: true };
// Resultado: false (sin suscripción ni permisos)
```

## 🔄 Migración de Código Existente

Si encuentras código con validación de acceso duplicada:

1. Importa la función centralizada:
```typescript
import { checkChapterAccess } from '../../util/access-control';
```

2. Reemplaza la lógica personalizada:
```typescript
// ❌ ANTES (código duplicado)
const userHasAccessToChapter = () => {
  if (!user && manga?.requireLogin === true) return false;
  // ... 30 líneas más ...
};

// ✅ DESPUÉS (función centralizada)
const accessCheck = checkChapterAccess(user, permissions, chapter, manga);
```

3. Actualiza el código que usa el resultado:
```typescript
// ❌ ANTES
if (!userHasAccessToChapter()) {
  return { status: false, message: "No tienes acceso" };
}

// ✅ DESPUÉS
if (!accessCheck.hasAccess) {
  return {
    status: false,
    message: accessCheck.message,
    errorType: accessCheck.errorType
  };
}
```

## 📚 Referencias

- `src/routes/chapter/get.ts` - Ejemplo de uso
- `src/routes/pages/list.ts` - Ejemplo de uso
- `src/util/permissions.ts` - Sistema de permisos de organización

