from __future__ import annotations

import secrets
from datetime import datetime, timezone

from backend.domain.models import Project, User
from backend.persistence.database import Database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


class UserRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create(self, *, status: str = "active") -> User:
        user = User(id=_new_id("usr"), status=status, created_at=_now())
        with self.database.transaction() as connection:
            connection.execute(
                "INSERT INTO users(id, status, created_at) VALUES (?, ?, ?)",
                (user.id, user.status, user.created_at),
            )
        return user


class ProjectRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create(self, owner_id: str, name: str) -> Project:
        now = _now()
        project = Project(
            id=_new_id("prj"),
            owner_id=owner_id,
            name=name,
            current_timeline_version_id=None,
            created_at=now,
            updated_at=now,
        )
        with self.database.transaction() as connection:
            connection.execute(
                """
                INSERT INTO projects(
                    id, owner_id, name, current_timeline_version_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    project.id,
                    project.owner_id,
                    project.name,
                    project.current_timeline_version_id,
                    project.created_at,
                    project.updated_at,
                ),
            )
        return project

    def get_for_owner(self, project_id: str, owner_id: str) -> Project | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM projects WHERE id = ? AND owner_id = ?",
                (project_id, owner_id),
            ).fetchone()
        return _project_from_row(row) if row is not None else None

    def list_for_owner(self, owner_id: str) -> list[Project]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM projects
                WHERE owner_id = ?
                ORDER BY updated_at DESC, id ASC
                """,
                (owner_id,),
            ).fetchall()
        return [_project_from_row(row) for row in rows]


class Repositories:
    def __init__(self, database: Database) -> None:
        self.users = UserRepository(database)
        self.projects = ProjectRepository(database)


def _project_from_row(row: object) -> Project:
    return Project(
        id=row["id"],
        owner_id=row["owner_id"],
        name=row["name"],
        current_timeline_version_id=row["current_timeline_version_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )

