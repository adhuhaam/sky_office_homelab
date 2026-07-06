export function getApiBaseUrl(): string {
  const fromUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromUrl) return fromUrl.replace(/\/+$/, "");
  return "";
}

export function getWebAppUrl(): string {
  const fromUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (fromUrl) return fromUrl.replace(/\/+$/, "");
  return "";
}
