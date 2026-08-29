from app.main import create_app


# Startup restores the latest database snapshot before applying migrations.
app = create_app(migrate_on_startup=True)
