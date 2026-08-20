from app.models.models import ChecklistItem, Job


def test_job_state_machine():
    j = Job(id="x", type="review", prd_text="t", status="pending")
    assert j.status == "pending"
    for s in ("running", "done", "failed"):
        j.status = s
        assert j.status == s


def test_checklist_item_state_machine():
    it = ChecklistItem(
        id="c1", job_id="x", seq=1, description="d", expected="e", status="pending"
    )
    assert it.status == "pending"
    for s in ("running", "passed", "failed", "skipped"):
        it.status = s
        assert it.status == s
