from backend.domain.errors import DomainError
from backend.domain.models import Project
from backend.persistence.repositories import ProjectRepository


class ProjectService:
    def __init__(self, projects: ProjectRepository) -> None:
        self.projects = projects

    def create(self, owner_id: str, name: str) -> Project:
        return self.projects.create(owner_id, name.strip())

    def get(self, owner_id: str, project_id: str) -> Project:
        project = self.projects.touch_for_owner(project_id, owner_id)
        if project is None:
            raise DomainError("project_not_found", "项目不存在。", status_code=404)
        return project

    def list(self, owner_id: str) -> list[Project]:
        return self.projects.list_for_owner(owner_id)
