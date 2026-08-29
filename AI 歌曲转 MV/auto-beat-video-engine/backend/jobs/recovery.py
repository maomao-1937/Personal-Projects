from backend.jobs.service import JobService


class RecoveryService:
    def __init__(self, jobs: JobService) -> None:
        self.jobs = jobs

    async def run_once(self) -> int:
        return self.jobs.recover_expired()
