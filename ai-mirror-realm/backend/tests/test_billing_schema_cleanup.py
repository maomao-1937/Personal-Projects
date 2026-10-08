from sqlalchemy import create_engine, inspect, text

from app.services.billing_schema_cleanup import remove_legacy_billing_schema


def test_removes_only_historical_billing_schema(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id TEXT PRIMARY KEY, nickname TEXT, credits INTEGER NOT NULL)"))
        connection.execute(text("CREATE TABLE portrait_tasks (id TEXT PRIMARY KEY, status TEXT, credits_used INTEGER)"))
        connection.execute(text("CREATE TABLE orders (id TEXT PRIMARY KEY, user_id TEXT, amount INTEGER)"))
        connection.execute(text("CREATE TABLE invitation_tokens (id TEXT PRIMARY KEY)"))
        connection.execute(text("INSERT INTO users VALUES ('u1', 'mirror-user', 3)"))
        connection.execute(text("INSERT INTO portrait_tasks VALUES ('p1', 'completed', 1)"))
        connection.execute(text("INSERT INTO orders VALUES ('o1', 'u1', 100)"))
        connection.execute(text("INSERT INTO invitation_tokens VALUES ('i1')"))

    remove_legacy_billing_schema(engine)
    remove_legacy_billing_schema(engine)

    schema = inspect(engine)
    assert "orders" not in schema.get_table_names()
    assert "credits" not in {column["name"] for column in schema.get_columns("users")}
    assert "credits_used" not in {column["name"] for column in schema.get_columns("portrait_tasks")}
    with engine.connect() as connection:
        assert connection.execute(text("SELECT id, nickname FROM users")).one() == ("u1", "mirror-user")
        assert connection.execute(text("SELECT id, status FROM portrait_tasks")).one() == ("p1", "completed")
        assert connection.execute(text("SELECT id FROM invitation_tokens")).scalar_one() == "i1"
