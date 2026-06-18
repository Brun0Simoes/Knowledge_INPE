export const APP_BASE_PATH = "/knowledge";

export function withBasePath(pathname: string) {
  if (
    !APP_BASE_PATH ||
    !pathname.startsWith("/") ||
    pathname.startsWith(`${APP_BASE_PATH}/`) ||
    pathname.startsWith("/_next/")
  ) {
    return pathname;
  }

  return `${APP_BASE_PATH}${pathname}`;
}
