const env = {
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  botToken: process.env.DISCORD_BOT_TOKEN!,
  guildId: process.env.DISCORD_GUILD_ID!,
  redirectUri: process.env.DISCORD_REDIRECT_URI || 'https://capibaratraductor.com/api/discord/callback',
};

const API = 'https://discord.com/api/v10';

// Build the consent URL the user is redirected to. Scopes 'identify guilds'
// give us their profile + the list of guilds they're in. `state` is signed
// (HMAC) so we can verify it on callback without server-side storage.
export const buildOauthUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: 'code',
    scope: 'identify guilds',
    redirect_uri: env.redirectUri,
    state,
    prompt: 'consent',
  });
  return `${API}/oauth2/authorize?${params}`;
};

export const exchangeCodeForToken = async (code: string) => {
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.redirectUri,
  });
  const r = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('Discord OAuth: token exchange failed');
  return r.json() as Promise<{ access_token: string; token_type: string; expires_in: number; refresh_token?: string; scope: string }>;
};

export const fetchDiscordUser = async (accessToken: string) => {
  const r = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error('Discord: fetch user failed');
  return r.json() as Promise<{ id: string; username: string; global_name?: string; avatar?: string | null }>;
};

export const fetchUserGuilds = async (accessToken: string) => {
  const r = await fetch(`${API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error('Discord: fetch guilds failed');
  return r.json() as Promise<Array<{ id: string }>>;
};

// Bot-side verification — uses the bot token, no user OAuth needed. Returns
// true if the user is currently a member of our guild.
export const checkGuildMembershipViaBot = async (discordUserId: string): Promise<boolean> => {
  const r = await fetch(`${API}/guilds/${env.guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${env.botToken}` },
  });
  if (r.status === 404) return false;
  if (!r.ok) throw new Error(`Discord: bot membership check failed (${r.status})`);
  return true;
};

export const ourGuildId = () => env.guildId;
export const ourClientId = () => env.clientId;
