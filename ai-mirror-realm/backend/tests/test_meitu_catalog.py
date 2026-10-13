from collections import Counter
from hashlib import sha256

from app.catalog_presets import CATALOG_PATH, catalog_manifest, catalog_styles
from app.models.portrait import PortraitTask
from app.models.style import Style
from app.models.user import User
from app.seed import LEGACY_PREVIEW_URLS, seed_styles


def test_real_catalog_samples_keep_observed_names_and_verified_files():
    manifest = catalog_manifest()
    items = manifest["items"]
    assert len(items) == 153
    assert len({item["preview_url"] for item in items}) == 153
    assert len({item["source_url"] for item in items}) == 153
    assert manifest["provenance"]["evidence_id"] == (
        "ev_71f80ff60635b9c612e7462d4c24c703bbe4357cb3aaca697305cf6d6c322b0c"
    )
    assert manifest["provenance"]["source_url"] == "https://aiportrait.meitu.com/home"
    assert Counter(item["name"] for item in items)["美式证件照"] == 2
    public_directory = CATALOG_PATH.parent.parent
    for item in items:
        image = public_directory / item["preview_url"].lstrip("/")
        assert image.is_file()
        assert sha256(image.read_bytes()).hexdigest() == item["sha256"]
        assert image.stem == item["sha256"][:16]
        assert image.suffix in {".jpg", ".png", ".webp"}
        assert item["width"] > 0 and item["height"] > 0


def test_source_category_sequences_and_identity_reference_prompt_are_preserved():
    manifest = catalog_manifest()
    assert {category["key"]: category["count"] for category in manifest["source_categories"]} == {
        "hot": 61,
        "career": 42,
        "women": 138,
        "men": 15,
        "children": 8,
    }
    styles = list(catalog_styles())
    assert [style["preview_url"] for style in styles[:61]] == manifest["source_categories"][0]["preview_urls"]
    for style in styles:
        assert "第一张参考图是用户本人照片" in style["prompt_template"]
        assert "仅参考第二张图的服装" in style["prompt_template"]
        assert "不要复制第二张图的人物身份" in style["prompt_template"]
        assert style["description"] == "参考样片妆造与场景"


def test_seed_uses_sample_identity_even_when_real_templates_have_the_same_name(db_session_factory):
    with db_session_factory() as db:
        styles = db.query(Style).filter(Style.is_active.is_(True)).all()
        original_ids = {style.preview_url: style.id for style in styles}
        assert len(original_ids) == 153
        assert db.query(Style).filter(Style.name == "美式证件照").count() == 2
        styles[0].name = "旧文案"
        db.commit()
        seed_styles(db)
        seed_styles(db)
        current = db.query(Style).filter(Style.is_active.is_(True)).all()
        assert {style.preview_url: style.id for style in current} == original_ids
        assert db.query(Style).count() == 153
        assert "旧文案" not in {style.name for style in current}


def test_seed_retires_original_catalog_without_rewriting_historical_tasks(db_session_factory):
    with db_session_factory() as db:
        user = User(email="catalog-history@example.com", password_hash="unused", nickname="历史用户")
        original = Style(
            name="草原生命力旧目录",
            category="创意写真",
            description="保留历史描述",
            prompt_template="original historical prompt",
            preview_url="catalog:creative:4",
            is_active=True,
        )
        legacy = Style(
            name="旧八款主题",
            category="历史主题",
            prompt_template="legacy historical prompt",
            preview_url=LEGACY_PREVIEW_URLS[0],
            is_active=True,
        )
        db.add_all([user, original, legacy])
        db.flush()
        task = PortraitTask(
            user_id=user.id,
            style_id=original.id,
            selfie_url="/uploads/historical-selfie.jpg",
            result_url="/generated/historical-result.jpg",
            status="completed",
        )
        db.add(task)
        db.commit()
        original_id, legacy_id, task_id = original.id, legacy.id, task.id

        seed_styles(db)
        db.expire_all()
        original = db.get(Style, original_id)
        assert not original.is_active
        assert original.name == "草原生命力旧目录"
        assert original.description == "保留历史描述"
        assert original.prompt_template == "original historical prompt"
        assert not db.get(Style, legacy_id).is_active
        preserved_task = db.get(PortraitTask, task_id)
        assert preserved_task.style_id == original_id
        assert preserved_task.result_url == "/generated/historical-result.jpg"
        assert preserved_task.style.name == "草原生命力旧目录"
        assert db.query(Style).filter(Style.is_active.is_(True)).count() == 153
