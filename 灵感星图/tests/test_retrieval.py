from app.retrieval import MaterialRetriever


def test_search_returns_relevant_materials_for_same_user(
    repository, material_factory
) -> None:
    cooking = repository.add_material(
        material_factory(
            user_id="user-a",
            summary="做饭时需要免手操作",
            topics=["做饭", "语音"],
        )
    )
    repository.add_material(
        material_factory(user_id="user-a", summary="记录每月支出", topics=["财务"])
    )
    repository.add_material(
        material_factory(
            user_id="user-b",
            summary="做饭时需要免手操作",
            topics=["做饭", "语音"],
        )
    )

    results = MaterialRetriever(repository).search("user-a", "做饭时免手操作", limit=5)

    assert [item.id for item in results] == [cooking.id]


def test_search_falls_back_to_ready_materials_when_query_has_no_overlap(
    repository, material_factory
) -> None:
    first = repository.add_material(material_factory(summary="收藏从来不回看"))
    second = repository.add_material(material_factory(summary="滑动筛选很轻松"))

    results = MaterialRetriever(repository).search("user-a", "给我一个周末项目")

    assert {item.id for item in results} == {first.id, second.id}


def test_specific_unrelated_query_does_not_fall_back_to_arbitrary_materials(
    repository, material_factory
) -> None:
    repository.add_material(material_factory(summary="税务记账", topics=["财务"]))
    repository.add_material(material_factory(summary="花园灌溉", topics=["园艺"]))

    results = MaterialRetriever(repository).search("user-a", "量子小提琴")

    assert results == []


def test_search_uses_ai_organized_material_text(repository, material_factory) -> None:
    refined = repository.add_material(
        material_factory(
            summary="一次家庭活动",
            organized_text="为亲子露营建立角色分工清单和完成打卡流程",
            topics=[],
        )
    )

    results = MaterialRetriever(repository).search("user-a", "亲子露营分工打卡")

    assert [item.id for item in results] == [refined.id]


def test_search_from_seed_keeps_seed_first_and_fills_other_ready_materials(
    repository, material_factory
) -> None:
    seed = repository.add_material(
        material_factory(summary="家庭露营装备容易遗漏", topics=["家庭露营"])
    )
    related = repository.add_material(
        material_factory(summary="家庭露营角色分工", topics=["家庭露营"])
    )
    unrelated = repository.add_material(
        material_factory(summary="收藏文章不回看", topics=["收藏"])
    )

    results = MaterialRetriever(repository).search_from_seed("user-a", seed, limit=3)

    assert [item.id for item in results] == [seed.id, related.id, unrelated.id]
