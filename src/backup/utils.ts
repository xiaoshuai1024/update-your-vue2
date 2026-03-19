export function posixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

