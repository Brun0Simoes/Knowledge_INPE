#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BASE_URL = "http://localhost:3000/knowledge"
COURSE_SLUG = "minicurso-processamento-e-visualizacao-de-dados-de-queimadas-2026"

PAGES = {
    "index.html": f"{BASE_URL}",
    "login.html": f"{BASE_URL}/login",
    "register.html": f"{BASE_URL}/register",
    "forgot-password.html": f"{BASE_URL}/forgot-password",
    "course-minicurso-queimadas-2026.html": f"{BASE_URL}/courses/{COURSE_SLUG}",
}

LINK_REPLACEMENTS = {
    "./dashboard": "index.html",
    "./": "index.html",
    "./login": "login.html",
    "./register": "register.html",
    "./forgot-password": "forgot-password.html",
    f"./courses/{COURSE_SLUG}": "course-minicurso-queimadas-2026.html",
}


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def docker(*args: str) -> None:
    docker_exe = "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
    run([docker_exe, *args])


def windows_path(path: Path) -> str:
    return subprocess.check_output(["wslpath", "-w", str(path)], text=True).strip()


def clean_generated_assets() -> None:
    for path in [
        DOCS / "_next",
        DOCS / "brand",
        DOCS / "uploads",
        DOCS / "assets",
    ]:
        if path.exists():
            shutil.rmtree(path)

    for file_name in PAGES:
        path = DOCS / file_name
        if path.exists():
            path.unlink()

    fallback = ROOT / "index.html"
    if fallback.exists():
        fallback.unlink()


def copy_runtime_assets() -> None:
    (DOCS / "_next").mkdir(parents=True, exist_ok=True)
    docker("cp", "site_inpe-web-1:/app/.next/static", windows_path(DOCS / "_next/static"))
    docker("cp", "site_inpe-web-1:/app/public/brand", windows_path(DOCS / "brand"))
    docker("cp", "site_inpe-web-1:/app/public/uploads", windows_path(DOCS / "uploads"))
    shutil.copy2(ROOT / "app/favicon.ico", DOCS / "favicon.ico")


def fetch_html(url: str) -> str:
    with urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def normalize_html(html: str, current_file: str) -> str:
    html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<script\b[^>]*/>", "", html, flags=re.IGNORECASE)
    html = html.replace("/knowledge/", "./")
    html = html.replace('href="/knowledge"', 'href="index.html"')
    html = html.replace("href='/knowledge'", "href='index.html'")
    html = html.replace('src="/knowledge"', 'src="./"')
    html = html.replace("src='/knowledge'", "src='./'")

    for source, target in LINK_REPLACEMENTS.items():
        html = html.replace(f'href="{source}"', f'href="{target}"')
        html = html.replace(f"href='{source}'", f"href='{target}'")

    html = html.replace(
        "</head>",
        '<meta name="robots" content="noindex" />'
        '<meta name="x-static-preview" content="GitHub Pages export from local Docker build" />'
        "</head>",
        1,
    )
    html = html.replace(
        '<body class="min-h-full font-body text-zinc-950">',
        '<body class="min-h-full font-body text-zinc-950" data-static-page="' + current_file + '">',
        1,
    )
    return html


def write_pages() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    for file_name, url in PAGES.items():
        html = normalize_html(fetch_html(url), file_name)
        (DOCS / file_name).write_text(html, encoding="utf-8")


def write_support_files() -> None:
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")
    (ROOT / "index.html").write_text(
        """<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=docs/" />
    <title>Knowledge INPE | GitHub Pages</title>
  </head>
  <body>
    <p>Redirecionando para <a href="docs/">Knowledge INPE</a>.</p>
  </body>
</html>
""",
        encoding="utf-8",
    )


def main() -> None:
    clean_generated_assets()
    copy_runtime_assets()
    write_pages()
    write_support_files()


if __name__ == "__main__":
    main()
