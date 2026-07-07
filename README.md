# latmanga

## Alertas de crons

Configura `DISCORD_ALERTS_WEBHOOK_URL` en el `.env` de producción (webhook de un canal de Discord) para recibir un aviso cuando cualquier cron falle. Sin la variable, los fallos solo salen por `console.error`. Las alertas por cron tienen cooldown de 30 minutos para no inundar el canal.

To install dependencies:

```bash
bun install
```

To run migrations:

```bash
bun db:migrate
```

To run:

```bash
bun start
```

## Cloudflare R2 Configuration

This project uses Cloudflare R2 for file storage. You need to configure the following environment variables:

```env
# Cloudflare R2 Configuration (Required)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
```

**Note:** All images are stored with full URLs in the database using the R2 public endpoint format: `https://pub-{R2_ACCOUNT_ID}.r2.dev/{fileKey}`

## Variables de entorno

```env
# Base de datos (apunta a PRODUCCIÓN en el .env local)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Cloudflare R2 (obligatorias, ver arriba)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://r2.capibaratraductor.com   # base pública de los archivos

# Alertas de crons a Discord (opcional; sin ella los fallos solo salen por console.error)
DISCORD_ALERTS_WEBHOOK_URL=https://discord.com/api/webhooks/...

# PayPal (suscripciones)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Superadmin (login del panel global)
SUPERADMIN_SECRET=...        # secreto JWT del superadmin
```

El frontend define además `PUBLIC_API_URL`, `PUBLIC_R2_PUBLIC_URL` y las zonas
de Adsterra/AdSense; ver `lectormoe-frontend`.

### Setting up CORS

After configuring your R2 bucket, run the CORS configuration script:

```bash
bun src/scripts/configure-r2-cors.ts
```

This will configure CORS on your R2 bucket to allow direct uploads from the frontend using presigned URLs.

### Getting R2 Credentials

1. Go to Cloudflare Dashboard > R2 > Manage R2 API Tokens
2. Create a new API token with read and write permissions
3. Copy the Access Key ID and Secret Access Key
4. Your Account ID can be found in your R2 bucket settings

This project was created using `bun init` in bun v1.0.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
