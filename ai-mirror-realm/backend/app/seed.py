from sqlalchemy.orm import Session

from app.models.style import Style

STYLES = [
    {
        "name": "国风雅韵",
        "category": "国风",
        "description": "古典中式美学，丝绸襦裙，工笔画意境",
        "prompt_template": "A stunning portrait of the same person with identical facial features, wearing elegant traditional Chinese hanfu with intricate gold and silk embroidery, hair styled in an elaborate traditional updo with jade hairpins and floral ornaments, standing in a serene misty bamboo garden with soft golden morning light, classical Chinese aesthetic, ink wash painting style, dreamy atmospheric background, high detail, professional photography, 8k resolution, ultra sharp, cinematic lighting, face consistency, preserve original face",
        "preview_url": "/style-previews/guofeng.jpg",
        "sort_order": 1,
    },
    {
        "name": "职场精英",
        "category": "职场",
        "description": "干练职业装，都市写字楼背景",
        "prompt_template": "A professional corporate portrait of the same person with identical facial features, wearing a perfectly tailored premium business suit, confident and authoritative expression, modern high-rise office background with floor-to-ceiling windows showing city skyline, soft professional studio lighting, magazine cover quality, sharp focus, business photography style, high detail, 8k resolution, ultra realistic, face consistency, preserve original face",
        "preview_url": "/style-previews/zhichang.jpg",
        "sort_order": 2,
    },
    {
        "name": "婚纱梦境",
        "category": "婚纱",
        "description": "白色婚纱，浪漫花海，梦幻光影",
        "prompt_template": "A breathtaking wedding portrait of the same person with identical facial features, wearing an exquisite designer white wedding gown with delicate lace and beadwork, flowing veil catching the light, standing in a romantic field of roses and peonies at golden hour sunset, soft dreamy bokeh background, ethereal glowing atmosphere, professional wedding photography, high detail, 8k resolution, ultra sharp, face consistency, preserve original face",
        "preview_url": "/style-previews/hunsha.jpg",
        "sort_order": 3,
    },
    {
        "name": "日系清新",
        "category": "日系",
        "description": "和服浴衣，樱花树下，清新文艺",
        "prompt_template": "A beautiful portrait of the same person with identical facial features, wearing a lovely Japanese yukata with delicate cherry blossom patterns, hair adorned with small flower kanzashi ornaments, standing under blooming pink cherry blossom trees, warm soft afternoon sunlight filtering through petals, Japanese aesthetic, light and airy atmosphere, soft focus background, film photography style, high detail, 8k resolution, face consistency, preserve original face",
        "preview_url": "/style-previews/rixi.jpg",
        "sort_order": 4,
    },
    {
        "name": "赛博朋克",
        "category": "潮酷",
        "description": "霓虹未来感，机能风穿搭，科幻城市",
        "prompt_template": "A futuristic cyberpunk portrait of the same person with identical facial features, wearing sleek tactical techwear with glowing LED accents and holographic details, standing in a neon-drenched rainy Tokyo street at night, vibrant purple pink and cyan neon lights reflecting in wet pavement, towering skyscrapers with holographic advertisements, Blade Runner aesthetic, cinematic composition, dramatic lighting, high detail, 8k resolution, ultra sharp, face consistency, preserve original face",
        "preview_url": "/style-previews/chaoku.jpg",
        "sort_order": 5,
    },
    {
        "name": "复古港风",
        "category": "复古",
        "description": "90年代港星风范，胶片质感",
        "prompt_template": "A vintage Hong Kong cinema style portrait of the same person with identical facial features, 1990s fashion aesthetic with stylish retro clothing, soft warm golden lighting, film grain texture, teal and orange color grading, Wong Kar-wai inspired moody atmosphere, neon signs softly blurred in background, cinematic composition, nostalgic feeling, analog film photography, high detail, 8k resolution, face consistency, preserve original face",
        "preview_url": "/style-previews/fugu.jpg",
        "sort_order": 6,
    },
    {
        "name": "油画质感",
        "category": "艺术",
        "description": "古典油画风格，伦勃朗光影",
        "prompt_template": "A classical fine art oil painting portrait of the same person with identical facial features, Renaissance master style, dramatic Rembrandt chiaroscuro lighting with deep shadows and warm highlights, rich and saturated color palette, wearing elegant classical attire, visible painterly brushstrokes, museum quality artwork, dark moody background, timeless and elegant, highly detailed, 8k resolution, face consistency, preserve original face features",
        "preview_url": "/style-previews/yishu.jpg",
        "sort_order": 7,
    },
    {
        "name": "仙侠幻境",
        "category": "仙侠",
        "description": "飘逸仙气，云雾缭绕，修仙意境",
        "prompt_template": "A majestic xianxia fantasy portrait of the same person with identical facial features, as an immortal cultivator wearing flowing ethereal white and silver robes billowing in celestial wind, long silky hair floating gracefully, standing on a misty mountain peak above a sea of clouds, glowing spiritual energy aura, floating jade talismans and mystical artifacts, Chinese fantasy art style, dreamy and otherworldly atmosphere, dramatic sky, high detail, 8k resolution, ultra sharp, face consistency, preserve original face",
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
