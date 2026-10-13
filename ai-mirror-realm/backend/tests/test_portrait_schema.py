from __future__ import annotations

from sqlalchemy import create_engine, inspect, text

from app.services.portrait_schema import ensure_portrait_schema, ensure_profile_schema


def test_adds_nullable_prompt_without_changing_historic_tasks(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy-portraits.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE portrait_tasks (id VARCHAR PRIMARY KEY, prompt_used TEXT, status VARCHAR)"))
        connection.execute(
            text("INSERT INTO portrait_tasks (id, prompt_used, status) VALUES (:id, :prompt, :status)"),
            {"id": "historic-task", "prompt": "combined legacy prompt", "status": "completed"},
        )

    ensure_portrait_schema(engine)
    ensure_portrait_schema(engine)

    columns = {column["name"]: column for column in inspect(engine).get_columns("portrait_tasks")}
    assert columns["user_prompt"]["nullable"] is True
    assert columns["selfie_urls"]["nullable"] is True
    assert columns["profile_name"]["nullable"] is True
    with engine.connect() as connection:
        row = connection.execute(text("SELECT id, prompt_used, status, user_prompt, profile_name FROM portrait_tasks")).one()
        assert tuple(row) == ("historic-task", "combined legacy prompt", "completed", None, None)


def test_adds_profile_photo_group_without_changing_existing_archive(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy-profiles.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE face_profiles (id VARCHAR PRIMARY KEY, selfie_url TEXT)"))
        connection.execute(text("INSERT INTO face_profiles (id, selfie_url) VALUES ('old', '/uploads/selfies/old.jpg')"))
    ensure_profile_schema(engine)
    ensure_profile_schema(engine)
    with engine.connect() as connection:
        assert tuple(connection.execute(text("SELECT id, selfie_url, selfie_urls FROM face_profiles")).one()) == ('old', '/uploads/selfies/old.jpg', None)
