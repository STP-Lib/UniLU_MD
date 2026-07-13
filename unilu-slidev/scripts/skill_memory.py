#!/usr/bin/env python3
"""Learned-recipe memory and token-efficiency review for this skill."""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
RECIPES = ROOT / "references" / "FREQUENT_TASK_RECIPES.md"
START = "<!-- SKILL_LEARNED_RECIPE:"
END = "<!-- /SKILL_LEARNED_RECIPE:"
PROJECT_MARKERS = (".git", ".ignore", ".gitignore")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")[:80] or "recipe"


def redact(text: str) -> str:
    text = text or ""
    text = re.sub(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?[^'\"\s]+", r"\1=<redacted>", text)
    text = re.sub(r"(?i)(authorization\s*[:=]\s*bearer\s+)[A-Za-z0-9._-]+", r"\1<redacted>", text)
    return text


def ensure_section(text: str) -> str:
    if "## Learned Recipes" in text:
        return text.rstrip() + "\n"
    return text.rstrip() + "\n\n## Learned Recipes\n\nShort reproducible fixes captured after solved Slidev workflow problems.\n"


def render(args: argparse.Namespace) -> tuple[str, str]:
    slug = slugify(args.title)
    lines = [
        f"{START}{slug} -->",
        f"### {redact(args.title)}",
        f"- Problem: {redact(args.problem)}",
    ]
    if args.root_cause:
        lines.append(f"- Root cause: {redact(args.root_cause)}")
    lines.append(f"- Fix: {redact(args.fix)}")
    if args.use_when:
        lines.append(f"- Use when: {redact(args.use_when)}")
    for command in args.command or []:
        lines.append(f"- Command: `{redact(command)}`")
    for file_path in args.file or []:
        lines.append(f"- File: `{redact(file_path)}`")
    if args.tag:
        lines.append("- Tags: " + ", ".join(f"`{redact(t)}`" for t in args.tag))
    lines.append(f"- Learned: {dt.datetime.now().astimezone().isoformat(timespec='seconds')}")
    lines.append(f"{END}{slug} -->")
    return slug, "\n".join(lines) + "\n"


def learn(args: argparse.Namespace) -> dict:
    RECIPES.parent.mkdir(parents=True, exist_ok=True)
    text = RECIPES.read_text(encoding="utf-8") if RECIPES.exists() else "# Frequent Task Recipes\n"
    text = ensure_section(text)
    slug, block = render(args)
    pattern = re.compile(rf"{re.escape(START + slug + ' -->')}.*?{re.escape(END + slug + ' -->')}\s*", re.DOTALL)
    updated = bool(pattern.search(text))
    text = pattern.sub(block + "\n", text) if updated else text.rstrip() + "\n\n" + block
    RECIPES.write_text(text, encoding="utf-8")
    return {"ok": True, "recipe": slug, "updated_existing": updated, "path": str(RECIPES)}


def _blocks() -> list[dict]:
    text = RECIPES.read_text(encoding="utf-8") if RECIPES.exists() else ""
    pattern = re.compile(rf"{re.escape(START)}([^ ]+) -->\n(.*?){re.escape(END)}\1 -->", re.DOTALL)
    rows = []
    for match in pattern.finditer(text):
        body = match.group(2).strip()
        title = re.search(r"^###\s+(.+)$", body, re.MULTILINE)
        rows.append({"slug": match.group(1), "title": title.group(1) if title else match.group(1), "body": body})
    return rows


def search(args: argparse.Namespace) -> dict:
    terms = [t.casefold() for t in re.findall(r"[A-Za-z0-9_/-]+", args.query or "") if len(t) > 2]
    hits = []
    for block in _blocks():
        hay = (block["title"] + "\n" + block["body"]).casefold()
        score = sum(hay.count(term) for term in terms) if terms else 0
        if score:
            hits.append({"score": score, "slug": block["slug"], "title": block["title"], "snippet": block["body"][:700]})
    hits.sort(key=lambda row: (-row["score"], row["title"]))
    return {"ok": True, "query": args.query, "hits": hits[: args.limit]}


def project_root() -> Path:
    parent = ROOT.parent
    installed_parent = parent.name.casefold() == "skills" and parent.parent.name.casefold() in {".codex", ".agents"}
    if not installed_parent and any((parent / marker).exists() for marker in PROJECT_MARKERS):
        return parent
    return ROOT


def ignore_text(repo_root: Path) -> str:
    parts = []
    for name in (".ignore", ".gitignore"):
        path = repo_root / name
        if path.exists():
            parts.append(path.read_text(encoding="utf-8"))
    return "\n".join(parts)


def review(_: argparse.Namespace) -> dict:
    skill_text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    repo_root = project_root()
    ignored_patterns = ignore_text(repo_root)
    generated = [p for p in repo_root.rglob("*") if "__pycache__" in p.parts or p.suffix == ".pyc"]
    suggestions = []
    if len(skill_text.splitlines()) > 220:
        suggestions.append("Move new long lessons into references/ instead of growing SKILL.md.")
    if generated and ("__pycache__/" not in ignored_patterns or "*.pyc" not in ignored_patterns):
        suggestions.append("Add .ignore entries for __pycache__/ and *.pyc.")
    for pattern in ("dist/", ".artifacts/", "presentation*.pdf", ".slidev.pid"):
        if pattern not in ignored_patterns:
            suggestions.append(f"Add .ignore entry for generated Slidev artifact: {pattern}")
    return {
        "ok": True,
        "skill_md_lines": len(skill_text.splitlines()),
        "learned_recipe_count": len(_blocks()),
        "generated_cache_files": len(generated),
        "suggestions": suggestions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("learn")
    p.add_argument("--title", required=True)
    p.add_argument("--problem", required=True)
    p.add_argument("--fix", required=True)
    p.add_argument("--root-cause", default="")
    p.add_argument("--use-when", default="")
    p.add_argument("--command", action="append", default=[])
    p.add_argument("--file", action="append", default=[])
    p.add_argument("--tag", action="append", default=[])
    p.set_defaults(func=learn)
    p = sub.add_parser("search")
    p.add_argument("query", nargs="?", default="")
    p.add_argument("--limit", type=int, default=5)
    p.set_defaults(func=search)
    p = sub.add_parser("review")
    p.set_defaults(func=review)
    args = parser.parse_args()
    print(json.dumps(args.func(args), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
