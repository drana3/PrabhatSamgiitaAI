"""Show which sign-in settings this server has, and which are missing. Prints no values.

Run it where the server runs (same environment variables):

    cd apps/api && python scripts/check_sign_in_setup.py

Exit code 0 = everything the app needs is set, 1 = something is missing (docs/sign-in-setup.md).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.services.provider_tokens import sign_in_setup_report  # noqa: E402

NAMES = {"google": "Google", "apple": "Apple", "aad": "Microsoft (optional)"}


def main() -> int:
    settings = get_settings()
    problems = 0
    print("Sign-in settings on this server (values are never printed)\n")

    secret = (settings.member_session_secret or "").strip()
    if len(secret) >= 32:
        print("  OK       MEMBER_SESSION_SECRET (signs the session tokens)")
    else:
        problems += 1
        print(
            "  MISSING  MEMBER_SESSION_SECRET: 32+ random characters, or secure sign-in stays off"
        )

    for provider, row in sign_in_setup_report(settings).items():
        label = f"{row['setting']} ({NAMES[provider]})"
        if row["configured"]:
            print(f"  OK       {label}: {row['count']} id(s)")
        elif provider == "aad":
            print(f"  not set  {label}: Microsoft sign-in is off on this server")
        else:
            problems += 1
            print(f"  MISSING  {label}")

    print()
    if problems:
        print("Something is missing: see docs/sign-in-setup.md, part 'Which value goes where'.")
        return 1
    print("All set.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
