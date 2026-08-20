from app.services.prd_rewrite import rewrite_prd


def test_rewrite_mock_returns_full_prd():
    out = rewrite_prd(
        "# 登录页\n做一个登录页,响应要快。",
        "1. [high/missing] 未定义登录后行为 → 建议:补充跳转 dashboard\n2. [medium/ambiguous] 响应要快不可度量 → 建议:P95<500ms",
    )
    assert "产品目标" in out
    assert "失败路径" in out
    # 必须是 markdown 正文,不是 JSON
    assert out.strip().startswith("# ")
