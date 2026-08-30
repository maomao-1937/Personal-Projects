from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StyleOut(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    preview_url: Optional[str] = None
    sort_order: int

    class Config:
        from_attributes = True


class StyleDetail(StyleOut):
    prompt_template: str
    is_active: bool
    created_at: datetime
