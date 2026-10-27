let csrf = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public field = "",
    public status = 400,
  ) {
    super(message);
  }
}
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      method === "GET"
        ? "Sunucuya ulaşılamıyor. Bağlantıyı kontrol edip tekrar deneyin."
        : "Sunucu yanıtı alınamadı. Kayıt sonucu belirsiz; tekrar kaydetmeden önce verileri yenileyip kontrol edin.",
      "",
      503,
    );
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      data.error || "İşlem tamamlanamadı.",
      data.field,
      response.status,
    );
  }
  return data;
}
