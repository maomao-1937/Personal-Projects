from app.catalog_presets import catalog_styles
from app.models.style import Style
from app.seed import seed_styles


def test_catalog_copy_changes_keep_style_ids_and_do_not_duplicate_rows(db_session_factory):
    preset = next(catalog_styles())
    with db_session_factory() as db:
        style = db.query(Style).filter(Style.preview_url == preset["preview_url"]).one()
        style_id = style.id
        style.name = "泡泡花裙"
        style.description = "旧描述"
        db.commit()

        seed_styles(db)
        seed_styles(db)

        current = db.query(Style).filter(Style.id == style_id).one()
        assert current.name == preset["name"]
        assert current.description == preset["description"]
        assert db.query(Style).filter(Style.is_active.is_(True)).count() == len(list(catalog_styles()))
        assert db.query(Style).filter(Style.name == "泡泡花裙").count() == 0


def test_catalog_has_one_explicit_reference_for_each_real_template():
    references = [style["preview_url"] for style in catalog_styles()]
    assert len(references) == 153
    assert len(set(references)) == len(references)
    assert all(reference.startswith('/meitu-templates/') for reference in references)
