from sqlalchemy import Engine, inspect, text


def ensure_portrait_schema(engine: Engine) -> None:
    """保留旧写真记录，兼容添加描述、多图引用及档案名称快照；旧记录留空。"""
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "portrait_tasks" not in inspector.get_table_names():
            return
        columns = {column["name"] for column in inspector.get_columns("portrait_tasks")}
        if "user_prompt" not in columns:
            connection.execute(text("ALTER TABLE portrait_tasks ADD COLUMN user_prompt TEXT"))
        if "selfie_urls" not in columns:
            connection.execute(text("ALTER TABLE portrait_tasks ADD COLUMN selfie_urls JSON"))
        if "profile_name" not in columns:
            connection.execute(text("ALTER TABLE portrait_tasks ADD COLUMN profile_name VARCHAR(30)"))


def ensure_profile_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "face_profiles" not in inspector.get_table_names():
            return
        columns = {column["name"] for column in inspector.get_columns("face_profiles")}
        if "selfie_urls" not in columns:
            connection.execute(text("ALTER TABLE face_profiles ADD COLUMN selfie_urls JSON"))
