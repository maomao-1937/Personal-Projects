"""充值套餐配置"""

from typing import List, Dict, Optional


class Package:
    """充值套餐"""

    def __init__(
        self,
        id: str,
        name: str,
        credits: int,
        price: int,
        original_price: int,
        discount_text: Optional[str] = None,
        recommended: bool = False,
    ):
        self.id = id
        self.name = name
        self.credits = credits
        self.price = price  # 单位：分
        self.original_price = original_price  # 原价，单位：分
        self.discount_text = discount_text
        self.recommended = recommended

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "credits": self.credits,
            "price": self.price,
            "original_price": self.original_price,
            "discount_text": self.discount_text,
            "recommended": self.recommended,
        }


# 套餐列表
PACKAGES: List[Package] = [
    Package(
        id="basic",
        name="基础包",
        credits=10,
        price=990,  # ¥9.9
        original_price=990,
        discount_text=None,
        recommended=False,
    ),
    Package(
        id="advanced",
        name="进阶包",
        credits=30,
        price=2490,  # ¥24.9
        original_price=3300,  # 原价 ¥33.0（按 9.9/10 积分单价计算）
        discount_text="省 25%",
        recommended=True,
    ),
    Package(
        id="premium",
        name="豪华包",
        credits=100,
        price=6990,  # ¥69.9
        original_price=14880,  # 原价 ¥148.8
        discount_text="省 53%",
        recommended=False,
    ),
]

# 按 ID 索引
PACKAGE_MAP: Dict[str, Package] = {p.id: p for p in PACKAGES}


def get_package(package_id: str) -> Optional[Package]:
    """根据 ID 获取套餐"""
    return PACKAGE_MAP.get(package_id)


def get_all_packages() -> List[Package]:
    """获取所有套餐"""
    return PACKAGES
