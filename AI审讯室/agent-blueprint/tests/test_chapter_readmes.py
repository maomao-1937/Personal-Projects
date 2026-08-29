import py_compile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = sorted(ROOT.glob("s[0-9][0-9]_*"))


def _has_chinese(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def test_every_chapter_has_a_single_chinese_readme() -> None:
    assert len(CHAPTERS) == 17

    for chapter in CHAPTERS:
        assert (chapter / "README.md").is_file()
        assert not (chapter / "README.zh.md").exists()
        assert not (chapter / "README.en.md").exists()
        assert not (chapter / "README.ja.md").exists()


def test_chapter_readmes_are_written_in_chinese() -> None:
    for chapter in CHAPTERS:
        text = (chapter / "README.md").read_text(encoding="utf-8")
        assert _has_chinese(text), f"{chapter.name}/README.md 应为中文"


def test_every_chapter_script_compiles_on_python_311() -> None:
    for chapter in CHAPTERS:
        _ = py_compile.compile(str(chapter / "code.py"), doraise=True)
