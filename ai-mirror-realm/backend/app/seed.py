from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.style import Style
from app.catalog_presets import catalog_styles

# 旧版 8 款和原创 48 款只为历史作品保留记录，不再出现在可选目录。
LEGACY_PREVIEW_URLS = (
    "/style-previews/guofeng.jpg",
    "/style-previews/zhichang.jpg",
    "/style-previews/hunsha.jpg",
    "/style-previews/rixi.jpg",
    "/style-previews/chaoku.jpg",
    "/style-previews/fugu.jpg",
    "/style-previews/yishu.jpg",
    "/style-previews/xianxia.jpg",
)

STYLES = list(catalog_styles())

def seed_styles(db: Session):
    """同步真实样片目录；旧主题仅下架，保留任务外键和历史名称。"""
    db.query(Style).filter(
        or_(
            Style.preview_url.in_(LEGACY_PREVIEW_URLS),
            Style.preview_url.like("catalog:%"),
        )
    ).update(
        {Style.is_active: False}, synchronize_session=False
    )
    for style_data in STYLES:
        existing = db.query(Style).filter(Style.preview_url == style_data["preview_url"]).first()
        if existing:
            existing.name = style_data["name"]
            existing.prompt_template = style_data["prompt_template"]
            existing.description = style_data["description"]
            existing.category = style_data["category"]
            existing.preview_url = style_data.get("preview_url", "")
            existing.sort_order = style_data["sort_order"]
            existing.is_active = True
        else:
            # 新增风格
            db.add(Style(**style_data))
    db.commit()
    total = db.query(Style).filter(Style.is_active.is_(True)).count()
    print(f"Styles initialized: {total} active styles in database")
