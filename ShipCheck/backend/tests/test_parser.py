from app.services.case_generator import generate_checklist
from app.services.prd_parser import parse_prd
from app.services.prd_review import review_prd


def test_parse_prd_mock():
    fs = parse_prd("任意 PRD 文本")
    assert len(fs) == 3
    assert all("id" in f and "name" in f and "description" in f for f in fs)


def test_generate_checklist_mock():
    items = generate_checklist([{"id": "F1", "name": "x", "description": "y"}])
    assert len(items) == 3
    for it in items:
        assert "description" in it and "expected" in it
        assert it["destructive"] is False


def test_review_prd_mock():
    fs = review_prd("任意 PRD")
    assert len(fs) == 3
    for f in fs:
        assert f["severity"] in ("high", "medium", "low")
        assert f["message"] and f["suggestion"]
