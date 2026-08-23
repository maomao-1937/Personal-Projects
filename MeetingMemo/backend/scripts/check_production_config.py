from app.core.config import Settings


def render_config_status(settings: Settings) -> str:
    missing = settings.missing_production_secrets()
    if not missing:
        return "ok"
    return "missing: " + ", ".join(sorted(missing))


def main() -> int:
    rendered = render_config_status(Settings())
    print(rendered)
    return 0 if rendered == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
