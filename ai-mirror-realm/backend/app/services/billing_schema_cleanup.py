"""Remove the retired billing schema without touching portrait or account data."""

from sqlalchemy import Engine, inspect, text
from sqlalchemy.engine import Connection


def _remove_on_connection(connection: Connection) -> None:
    schema = inspect(connection)
    tables = set(schema.get_table_names())
    if "orders" in tables:
        connection.execute(text("DROP TABLE orders"))
    for table, column in (("users", "credits"), ("portrait_tasks", "credits_used")):
        if table in tables and column in {
            field["name"] for field in schema.get_columns(table)
        }:
            connection.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))


def remove_legacy_billing_schema(engine: Engine) -> None:
    """Idempotently delete historical orders and the two retired credit columns."""
    if engine.dialect.name == "sqlite":
        # Render may start multiple workers at once. Acquire the write lock before
        # inspecting schema so the second worker sees the migrated structure.
        with engine.connect() as connection:
            try:
                connection.exec_driver_sql("BEGIN IMMEDIATE")
                _remove_on_connection(connection)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
    else:
        with engine.begin() as connection:
            _remove_on_connection(connection)
