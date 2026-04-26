// Normalises a stored asset reference into an absolute URL.
// Returns null/empty unchanged. If the value is already an absolute URL
// (http/https), returns it as-is. If it's a bare R2 object key (e.g.
// "tenants/superadmin/raffles/foo.png"), prepends the R2 public origin so
// browsers can actually load it.
//
// Defensive read-side wrapper for legacy rows whose imageUrl was saved as a
// relative path before the FE upload helper was fixed.
export const resolveR2Url = (value: string | null | undefined): string | null => {
  if (!value) return value ?? null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = (Bun.env.R2_PUBLIC_URL || "https://r2.capibaratraductor.com").replace(/\/$/, "");
  return `${base}/${value.replace(/^\/+/, "")}`;
};
