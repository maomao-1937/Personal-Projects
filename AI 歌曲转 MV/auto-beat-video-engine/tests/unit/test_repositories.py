from backend.persistence.database import Database
from backend.persistence.repositories import Repositories


def test_project_repository_scopes_reads_to_owner(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    owner_a = repositories.users.create()
    owner_b = repositories.users.create()

    project = repositories.projects.create(owner_a.id, "MV")

    assert repositories.projects.get_for_owner(project.id, owner_a.id) == project
    assert repositories.projects.get_for_owner(project.id, owner_b.id) is None


def test_project_repository_lists_only_owned_projects(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    owner_a = repositories.users.create()
    owner_b = repositories.users.create()
    repositories.projects.create(owner_a.id, "A")
    repositories.projects.create(owner_b.id, "B")

    assert [project.name for project in repositories.projects.list_for_owner(owner_a.id)] == ["A"]
