#!/usr/bin/env python3
"""One-shot migration: hardcoded slate/white Tailwind colors -> semantic tokens.

The UI baked dark colors (bg-slate-800, text-white, border-slate-700, ...) into
every component, so the data-theme accent swap could never produce a light UI.
This rewrites those utilities to the semantic tokens (bg-card, text-foreground,
border-border, ...) that globals.css drives per theme. Opacity suffixes
(/60) and variant prefixes (hover:, focus:, lg:) are preserved.

Special cases (scrims, shadows, the inbox doodle hex) are fixed by hand after
this runs — they are intentionally excluded here.
"""

import re
import sys
from pathlib import Path

# (utility-prefix, slate-shade) -> replacement utility (no shade).
MAPPING = {
    # text
    ("text", "50"): "text-foreground",
    ("text", "100"): "text-foreground",
    ("text", "200"): "text-foreground",
    ("text", "300"): "text-foreground",
    ("text", "400"): "text-muted-foreground",
    ("text", "500"): "text-muted-foreground",
    ("text", "600"): "text-muted-foreground",
    ("text", "700"): "text-muted-foreground",
    # backgrounds
    ("bg", "950"): "bg-background",
    ("bg", "900"): "bg-card",
    ("bg", "800"): "bg-secondary",
    ("bg", "700"): "bg-muted",
    ("bg", "600"): "bg-muted",
    ("bg", "500"): "bg-muted",
    # borders
    ("border", "600"): "border-border",
    ("border", "700"): "border-border",
    ("border", "800"): "border-border",
    ("border", "900"): "border-border",
    ("border-l", "500"): "border-l-muted-foreground",
    # rings
    ("ring", "700"): "ring-border",
    ("ring-offset", "900"): "ring-offset-background",
    ("ring-offset", "950"): "ring-offset-background",
    # svg / misc
    ("fill", "400"): "fill-muted-foreground",
    ("fill", "500"): "fill-muted-foreground",
    ("placeholder", "500"): "placeholder-muted-foreground",
    ("divide", "800"): "divide-border",
}

# Files / utilities we handle by hand (excluded from the bulk pass).
SKIP_SUBSTRINGS = ("shadow-slate",)


def replace_in_text(text: str) -> str:
    for (prefix, shade), repl in MAPPING.items():
        # Match the utility token plus an optional /opacity suffix, ensuring we
        # don't clip a longer shade (e.g. -900 must not match inside -9000).
        pattern = re.compile(
            rf"{re.escape(prefix)}-slate-{shade}(?P<op>/[0-9.]+)?(?![0-9])"
        )

        def _sub(m: re.Match) -> str:
            return repl + (m.group("op") or "")

        text = pattern.sub(_sub, text)

    # text-white -> text-foreground, but keep opacity variants (text-white/60)
    # which sit on the primary-colored surfaces and must stay white.
    text = re.sub(r"text-white(?![/\w-])", "text-foreground", text)
    return text


def main() -> int:
    root = Path("src")
    changed = 0
    for path in root.rglob("*.tsx"):
        original = path.read_text()
        if any(s in original for s in SKIP_SUBSTRINGS):
            # Still migrate the rest of the file; just leave the skipped token.
            pass
        updated = replace_in_text(original)
        if updated != original:
            path.write_text(updated)
            changed += 1
    print(f"Updated {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
