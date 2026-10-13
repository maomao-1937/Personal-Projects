"""Real Meitu template names paired with their REA-observed sample images.

The local manifest retains the source URL, full content hash, source categories,
and REA evidence identifier. Generation treats the uploaded photo as the identity
reference and the chosen sample as a separate visual reference.
"""

import json
from pathlib import Path


CATALOG_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "public"
    / "meitu-templates"
    / "catalog.json"
)

CATEGORY_LABELS = (
    ("career", "证件职业"),
    ("children", "儿童写真"),
    ("men", "男性写真"),
    ("women", "女性写真"),
)


def catalog_manifest():
    """Read the reviewed manifest; missing samples are never replaced by a guess."""
    with CATALOG_PATH.open(encoding="utf-8") as source:
        return json.load(source)


def catalog_styles():
    for item in catalog_manifest()["items"]:
        category = next(
            (label for key, label in CATEGORY_LABELS if key in item["categories"]),
            "写真",
        )
        yield {
            "name": item["name"],
            "category": category,
            "description": "参考样片妆造与场景",
            "prompt_template": (
                "生成高质量真实人像写真。第一张参考图是用户本人照片，"
                "保留第一张图中的人物身份、面部特征、年龄与自然肤质。"
                f"第二张参考图是「{item['name']}」主题样片，"
                "仅参考第二张图的服装、妆造、背景、光线、姿态与构图，"
                "不要复制第二张图的人物身份或改变用户的面部特征。"
                "保持人物五官和身体结构自然，画面中只有一名人物。"
            ),
            "preview_url": item["preview_url"],
            "sort_order": item["sort_order"],
        }
