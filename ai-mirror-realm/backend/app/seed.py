from sqlalchemy.orm import Session

from app.models.style import Style

# 8 种写真风格 —— 基于 Seedream 图生图能力优化
# 参考：awesome-seedream-5.0-pro-prompts 社区最佳实践
# 通用结构：主体 + 服装 + 构图 + 环境 + 光线 + 风格质感 + 质量词
# 所有 prompt 均强调 "preserve original facial features" 以保证面部一致性

STYLES = [
    {
        "name": "国风雅韵",
        "category": "国风",
        "description": "古典中式美学，襦裙金饰，工笔意境",
        "prompt_template": (
            "Ultra-realistic portrait of the same person, preserving original facial features, "
            "wearing elegant traditional Chinese hanfu with intricate gold silk embroidery and flowing sheer fabric, "
            "hair styled in a traditional updo with jade hairpins and delicate floral ornaments, "
            "standing in a serene misty bamboo garden with ancient pavilion architecture, "
            "soft golden morning light filtering through bamboo leaves, ethereal atmospheric haze, "
            "Chinese classical aesthetic, ink wash painting inspired color palette, "
            "medium full shot, three-quarter pose, graceful and composed expression, "
            "professional fashion photography, 8k ultra detailed, cinematic lighting, "
            "shallow depth of field, dreamy bokeh background"
        ),
        "preview_url": "/style-previews/guofeng.jpg",
        "sort_order": 1,
    },
    {
        "name": "职场精英",
        "category": "职场",
        "description": "干练职业装，都市写字楼，杂志封面质感",
        "prompt_template": (
            "Professional corporate portrait of the same person, preserving original facial features, "
            "wearing a perfectly tailored premium business suit with crisp lines, "
            "confident and authoritative expression, direct eye contact, "
            "modern high-rise office interior with floor-to-ceiling windows showing city skyline, "
            "soft professional studio lighting with subtle rim light, "
            "magazine cover quality, sharp focus on face, "
            "medium close-up shot, slightly low angle, "
            "corporate photography style, 8k ultra realistic, "
            "clean composition, power pose, sophisticated and capable aura"
        ),
        "preview_url": "/style-previews/zhichang.jpg",
        "sort_order": 2,
    },
    {
        "name": "婚纱梦境",
        "category": "婚纱",
        "description": "白色婚纱，浪漫花海，黄金时刻",
        "prompt_template": (
            "Breathtaking wedding portrait of the same person, preserving original facial features, "
            "wearing an exquisite designer white wedding gown with delicate lace, beadwork and flowing veil, "
            "holding a soft bouquet of white roses and peonies, "
            "standing in a romantic flower garden at golden hour sunset, "
            "warm glowing sunlight creating lens flare and halo effect, "
            "soft dreamy bokeh background with blooming flowers, "
            "ethereal and glowing atmosphere, "
            "full body shot, gentle smile, candid joyful expression, "
            "professional wedding photography, 8k ultra sharp, "
            "romantic color grading, shallow depth of field"
        ),
        "preview_url": "/style-previews/hunsha.jpg",
        "sort_order": 3,
    },
    {
        "name": "日系清新",
        "category": "日系",
        "description": "樱花和服，清新文艺，胶片质感",
        "prompt_template": (
            "Beautiful Japanese-style portrait of the same person, preserving original facial features, "
            "wearing a lovely pastel-colored yukata with delicate cherry blossom patterns, "
            "hair adorned with small flower kanzashi ornaments and dangling pins, "
            "standing under blooming pink cherry blossom trees in full bloom, "
            "warm soft afternoon sunlight filtering through flower petals, "
            "light and airy atmosphere, pastel color palette, "
            "film photography style with soft grain, slightly overexposed highlights, "
            "medium shot, gentle tilted head, natural soft smile, "
            "Japanese aesthetic, 8k high detail, "
            "shallow depth of field, dreamy petal bokeh"
        ),
        "preview_url": "/style-previews/rixi.jpg",
        "sort_order": 4,
    },
    {
        "name": "赛博朋克",
        "category": "潮酷",
        "description": "霓虹未来感，机能风潮服，科幻都市",
        "prompt_template": (
            "Futuristic cyberpunk portrait of the same person, preserving original facial features, "
            "wearing sleek black tactical techwear with glowing neon LED accents and holographic details, "
            "standing in a neon-drenched rainy Tokyo street at night, "
            "vibrant magenta, cyan and purple neon lights reflecting in wet pavement, "
            "towering skyscrapers with holographic advertisements and flying cars, "
            "Blade Runner aesthetic, dramatic chiaroscuro lighting, "
            "medium shot, confident pose, intense gaze, "
            "cinematic composition, high contrast, "
            "8k ultra detailed, atmospheric fog and rain particles, "
            "neon color grading, gritty and futuristic mood"
        ),
        "preview_url": "/style-previews/chaoku.jpg",
        "sort_order": 5,
    },
    {
        "name": "复古港风",
        "category": "复古",
        "description": "90年代港星风范，胶片质感，王家卫色调",
        "prompt_template": (
            "Vintage 1990s Hong Kong cinema style portrait of the same person, preserving original facial features, "
            "wearing stylish retro fashion with bold silhouettes and classic 90s aesthetics, "
            "soft warm golden lighting with deep teal shadows, Wong Kar-wai color grading, "
            "neon signs softly blurred in background, rainy night street scene, "
            "film grain texture, slight halation around light sources, "
            "medium close-up, moody contemplative expression, looking away, "
            "cinematic composition, nostalgic atmosphere, "
            "analog film photography aesthetic, 8k high detail, "
            "teal and orange color palette, shallow depth of field"
        ),
        "preview_url": "/style-previews/fugu.jpg",
        "sort_order": 6,
    },
    {
        "name": "油画质感",
        "category": "艺术",
        "description": "古典油画风格，伦勃朗光影，博物馆级",
        "prompt_template": (
            "Classical fine art oil painting portrait of the same person, preserving original facial features, "
            "Renaissance master style, wearing elegant dark classical attire with rich fabric texture, "
            "dramatic Rembrandt chiaroscuro lighting with deep shadows and warm golden highlights, "
            "single light source creating sculpted facial features, "
            "dark moody background with subtle atmospheric perspective, "
            "visible painterly brushstrokes, rich and saturated color palette, "
            "bust portrait, three-quarter view, serene and noble expression, "
            "museum quality artwork, timeless and elegant, "
            "8k ultra detailed, classical composition, "
            "oil on canvas texture, varnished finish"
        ),
        "preview_url": "/style-previews/yishu.jpg",
        "sort_order": 7,
    },
    {
        "name": "仙侠幻境",
        "category": "仙侠",
        "description": "飘逸仙气，云雾缭绕，御剑乘风",
        "prompt_template": (
            "Majestic xianxia fantasy portrait of the same person, preserving original facial features, "
            "as an immortal cultivator wearing flowing ethereal white and silver robes billowing in celestial wind, "
            "long silky hair floating gracefully with jade hair ornaments, "
            "standing on a misty mountain peak above a sea of clouds, "
            "glowing spiritual energy aura surrounding the figure, "
            "floating jade talismans, mystical artifacts and glowing lotus flowers, "
            "dramatic sky with golden sunlight piercing through clouds, "
            "Chinese fantasy xianxia art style, dreamy and otherworldly atmosphere, "
            "full body shot, elegant and powerful stance, "
            "8k ultra detailed, cinematic wide shot, "
            "epic scale, volumetric light rays, atmospheric perspective"
        ),
        "preview_url": "/style-previews/xianxia.jpg",
        "sort_order": 8,
    },
]


def seed_styles(db: Session):
    """初始化风格数据，如果已存在则更新 prompt_template"""
    for style_data in STYLES:
        existing = db.query(Style).filter(Style.name == style_data["name"]).first()
        if existing:
            existing.prompt_template = style_data["prompt_template"]
            existing.description = style_data["description"]
            existing.category = style_data["category"]
            existing.preview_url = style_data.get("preview_url", "")
            existing.sort_order = style_data["sort_order"]
        else:
            # 新增风格
            db.add(Style(**style_data))
    db.commit()
    total = db.query(Style).count()
    print(f"Styles initialized: {total} styles in database")
