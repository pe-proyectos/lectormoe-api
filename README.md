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
