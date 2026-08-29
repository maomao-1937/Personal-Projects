from __future__ import annotations

from uuid import uuid4

from app.domain.case_models import CaseSnapshot
from app.domain.rules import (
    InvalidTurnError,
    TurnLimitReachedError,
    can_submit_report,
    evaluate_turn,
    initial_session,
)
from app.domain.scoring import ReportInput, ScoreResult, score_report
from app.domain.types import GameSessionState, TurnEvaluation
from app.llm.provider import UnavailableLLMProvider
from app.repositories.cases import CaseRepository
from app.repositories.sessions import (
    ConcurrentSessionUpdateError,
    DuplicateTurnRequestError,
    SessionRepository,
)
from app.services.case_catalog import CaseCatalog
from app.services.responder import SuspectResponder


class GameError(Exception):
    code = "GAME_ERROR"
    status_code = 400
    user_message = "这次操作没有完成。"


class CaseNotFoundError(GameError):
    code = "CASE_NOT_FOUND"
    status_code = 404
    user_message = "没有找到这份案件档案。"


class SessionNotFoundError(GameError):
    code = "SESSION_NOT_FOUND"
    status_code = 404
    user_message = "没有找到这局审讯。"


class SessionForbiddenError(GameError):
    code = "SESSION_FORBIDDEN"
    status_code = 403
    user_message = "你无权访问这局审讯。"


class ReportLockedError(GameError):
    code = "REPORT_LOCKED"
    status_code = 409
    user_message = "当前证据条件还不足以提交结案报告。"


class InvalidReportError(GameError):
    code = "INVALID_REPORT"
    status_code = 422
    user_message = "结案报告包含无效或尚未发现的选项。"


class TurnRejectedError(GameError):
    code = "INVALID_TURN"
    status_code = 409
    user_message = "这次提问不符合当前审讯状态。"


class TurnLimitError(GameError):
    code = "TURN_LIMIT_REACHED"
    status_code = 409
    user_message = "8 次提问已经用完，请提交结案报告。"


class SessionConflictError(GameError):
    code = "SESSION_CONFLICT"
    status_code = 409
    user_message = "审讯记录刚刚在另一处更新，请刷新后重试。"


class GameService:
    def __init__(
        self,
        repository: SessionRepository,
        case_catalog: CaseCatalog | None = None,
        responder: SuspectResponder | None = None,
    ) -> None:
        self.repository = repository
        self.case_catalog = case_catalog or CaseCatalog(
            CaseRepository(repository.database)
        )
        self.responder = responder or SuspectResponder(UnavailableLLMProvider())

    def get_case_snapshot(self, case_id: str) -> CaseSnapshot:
        case = self.case_catalog.get(case_id)
        if case is None:
            raise CaseNotFoundError
        return case

    def get_public_case(self, case_id: str) -> dict:
        return self.get_case_snapshot(case_id).public_payload()

    def create_session(
        self,
        case_id: str,
        owner_id: str = "local-development",
    ) -> GameSessionState:
        case = self.get_case_snapshot(case_id)
        state = initial_session(f"ses_{uuid4().hex}", case=case)
        return self.repository.create(state, owner_id=owner_id)

    def get_session(
        self,
        session_id: str,
        owner_id: str = "local-development",
    ) -> GameSessionState:
        self._assert_session_owner(session_id, owner_id)
        state = self.repository.get(session_id, owner_id=owner_id)
        if state is None:
            raise SessionNotFoundError
        return state

    def submit_turn(
        self,
        session_id: str,
        message: str,
        tactic: str,
        evidence_id: str | None,
        request_id: str | None = None,
        *,
        owner_id: str = "local-development",
    ) -> TurnEvaluation:
        self._assert_session_owner(session_id, owner_id)
        if request_id:
            replay = self.repository.get_turn_replay(
                session_id,
                request_id,
                owner_id=owner_id,
            )
            if replay is not None:
                return replay
        state, revision = self.repository.get_versioned(
            session_id,
            owner_id=owner_id,
        )
        if state is None:
            raise SessionNotFoundError
        claimed_request = False
        if request_id:
            claimed_request = self.repository.claim_turn_request(
                session_id,
                request_id,
                owner_id=owner_id,
            )
            if not claimed_request:
                replay = self.repository.wait_for_turn_replay(
                    session_id,
                    request_id,
                    owner_id=owner_id,
                )
                if replay is not None:
                    return replay
                raise SessionConflictError
        case = self.get_case_snapshot(state.case_id)
        try:
            outcome = evaluate_turn(
                state,
                message,
                tactic,
                evidence_id,
                case=case,
            )
        except TurnLimitReachedError as exc:
            if claimed_request and request_id:
                self.repository.release_turn_request(
                    session_id, request_id, owner_id=owner_id
                )
            raise TurnLimitError from exc
        except InvalidTurnError as exc:
            if claimed_request and request_id:
                self.repository.release_turn_request(
                    session_id, request_id, owner_id=owner_id
                )
            raise TurnRejectedError from exc
        except Exception:
            if claimed_request and request_id:
                self.repository.release_turn_request(
                    session_id, request_id, owner_id=owner_id
                )
            raise
        try:
            outcome = self.responder.apply(case, state, outcome, message)
            self.repository.save(
                outcome.state,
                expected_revision=revision,
                owner_id=owner_id,
                turn_replay=(request_id, outcome) if request_id else None,
            )
        except (ConcurrentSessionUpdateError, DuplicateTurnRequestError) as exc:
            if request_id:
                replay = self.repository.get_turn_replay(
                    session_id,
                    request_id,
                    owner_id=owner_id,
                )
                if replay is not None:
                    return replay
            if claimed_request and request_id:
                self.repository.release_turn_request(
                    session_id, request_id, owner_id=owner_id
                )
            raise SessionConflictError from exc
        except Exception:
            if claimed_request and request_id:
                self.repository.release_turn_request(
                    session_id, request_id, owner_id=owner_id
                )
            raise
        return outcome

    def submit_report(
        self,
        session_id: str,
        report: ReportInput,
        owner_id: str = "local-development",
    ) -> ScoreResult:
        self._assert_session_owner(session_id, owner_id)
        persisted = self.repository.get_report(session_id, owner_id=owner_id)
        if persisted is not None:
            return ScoreResult.model_validate(persisted)
        state, revision = self.repository.get_versioned(
            session_id,
            owner_id=owner_id,
        )
        if state is None:
            raise SessionNotFoundError
        if not can_submit_report(state) and state.stage != "report_required":
            raise ReportLockedError
        case = self.get_case_snapshot(state.case_id)
        evidence_by_id = {item.id: item for item in case.evidence}
        valid_ids = {
            "verdict": {item.id for item in case.truth_options},
            "motive": {item.id for item in case.motive_options},
            "method": {item.id for item in case.method_options},
        }
        if (
            report.verdict_id not in valid_ids["verdict"]
            or report.motive_id not in valid_ids["motive"]
            or report.method_id not in valid_ids["method"]
            or any(item not in state.discovered_evidence_ids for item in report.evidence_ids)
            or any(item not in evidence_by_id for item in report.evidence_ids)
        ):
            raise InvalidReportError
        result = score_report(state, report, case=case)
        state.stage = "completed"
        state.report_result = result.model_dump(by_alias=True, mode="json")
        try:
            self.repository.save(
                state,
                expected_revision=revision,
                owner_id=owner_id,
                report_result=state.report_result,
            )
        except ConcurrentSessionUpdateError as exc:
            persisted = self.repository.get_report(session_id, owner_id=owner_id)
            if persisted is not None:
                return ScoreResult.model_validate(persisted)
            raise SessionConflictError from exc
        return result

    def _assert_session_owner(self, session_id: str, owner_id: str) -> None:
        persisted_owner_id = self.repository.get_owner_id(session_id)
        if persisted_owner_id is None:
            raise SessionNotFoundError
        if persisted_owner_id != owner_id:
            raise SessionForbiddenError
