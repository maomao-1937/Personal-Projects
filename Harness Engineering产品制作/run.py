#!/usr/bin/env python3
"""
run.py — 一键启动器（s01–s17）

Mac 用户：双击「启动.command」即可（自动装依赖 + 引导填 key）
其他方式：
    python run.py              # 交互式菜单，选择章节运行
    python run.py list         # 列出全部章节
    python run.py 3            # 直接运行 s03
    python run.py s03          # 同上
    python run.py agent_loop   # 按目录关键词运行
    python run.py setkey        # 修改已保存的 API Key
    python run.py s16 demo     # 运行 s16 的 demo 模式（透传剩余参数）
    python run.py s17 "目标"    # 运行 s17 并直接提交一个目标

首次使用：
    依赖自动装进项目 .venv（不碰系统 Python）；DeepSeek API Key 首次引导粘贴并保存到 .env。
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
VENV_DIR = ROOT / ".venv"

# (编号, 目录名, 标题, 说明)
LESSONS = [
    ("s01", "s01_agent_loop",          "Agent Loop",        "一个循环 + Bash 就是一个 Agent"),
    ("s02", "s02_tool_use",            "Tool Use",          "新增工具 = 新增一个 handler"),
    ("s03", "s03_permission",          "Permission",        "先定边界，再给自由"),
    ("s04", "s04_hooks",               "Hooks",             "围绕循环挂扩展点，不改主循环"),
    ("s05", "s05_todo_write",          "TodoWrite",         "先列计划再执行"),
    ("s06", "s06_subagent",            "Subagent",          "给子任务一份全新 messages[]"),
    ("s07", "s07_skill_loading",       "Skill Loading",     "按需加载知识，而非一次性塞入"),
    ("s08", "s08_context_compact",     "Context Compact",   "上下文总会满——要有腾出空间的办法"),
    ("s09", "s09_memory",              "Memory",            "记住该记的，忘掉该忘的"),
    ("s10", "s10_task_system",         "Task System",       "大目标拆成小任务，落盘持久化"),
    ("s11", "s11_background_tasks",    "Background Tasks",  "慢操作进后台，Agent 继续思考"),
    ("s12", "s12_cron_scheduler",      "Cron Scheduler",    "按时间自动触发，无需人工"),
    ("s13", "s13_agent_teams",         "Agent Teams",       "太大就交给队友分工"),
    ("s14", "s14_mcp_plugin",          "MCP Plugin",        "能力不够？通过 MCP 外接工具"),
    ("s15", "s15_integrated_harness",  "Integrated Harness","多机制，一个循环"),
    ("s16", "s16_workflow_runtime",    "Workflow Runtime",  "固定编排形状写进代码（支持 demo/resume）"),
    ("s17", "s17_goal_loop",           "Goal Loop",         "由目标决定循环何时停止"),
]


def _c(text: str, code: str = "") -> str:
    """极简 ANSI 着色（自动降级到无颜色）。"""
    if not sys.stdout.isatty():
        return text
    return f"\033[{code}m{text}\033[0m" if code else text


def _cyan(text: str) -> str:
    return _c(text, "36")


def _yellow(text: str) -> str:
    return _c(text, "33")


def _green(text: str) -> str:
    return _c(text, "32")


def _red(text: str) -> str:
    return _c(text, "31")


def find_lesson(query: str):
    """按编号 / sXX / 目录名 / 标题关键词 查找章节。"""
    q = query.strip().lower()
    if not q:
        return None
    # 纯数字 -> s03（自动补零，3 -> s03，17 -> s17）
    if q.isdigit():
        q = f"s{int(q):02d}"
    # 去掉可能的 "s" 前缀之外的空格等
    for num, folder, title, desc in LESSONS:
        if q in (num.lower(), folder.lower(), title.lower()) or q == folder:
            return num, folder, title, desc
    # 模糊：目录名包含关键词
    for num, folder, title, desc in LESSONS:
        if q in folder.lower():
            return num, folder, title, desc
    return None


def read_env_value(key: str) -> Optional[str]:
    """从项目根目录 .env 读取指定变量（不依赖 dotenv）。"""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == key:
            val = v.strip().strip('"').strip("'")
            return val or None
    return None


_PLACEHOLDER_MARKERS = ("xxx", "在这里填", "your", "replace", "changeme", "example")


def is_placeholder(key: str) -> bool:
    low = key.lower()
    return any(m in low for m in _PLACEHOLDER_MARKERS)


def check_api_key() -> bool:
    """返回 True 表示 API key 已就绪（非占位符）。"""
    key = read_env_value("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
    return bool(key) and not is_placeholder(key)


def venv_python() -> Path:
    """返回项目 .venv 里的 python 路径。"""
    if os.name == "nt":  # Windows 兼容
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def venv_ready() -> bool:
    """venv 存在且三个依赖都已装好。"""
    vp = venv_python()
    if not vp.exists():
        return False
    ret = subprocess.call(
        [str(vp), "-c", "import anthropic, dotenv, yaml"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return ret == 0


def write_api_key(key: str) -> None:
    """把 key 写入项目根目录 .env（无 .env 时基于 .env.example 创建）。"""
    env_path = ROOT / ".env"
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8")
    else:
        template = ROOT / ".env.example"
        content = template.read_text(encoding="utf-8") if template.exists() else ""

    new_lines = []
    replaced = False
    for line in content.splitlines():
        if line.strip().startswith("ANTHROPIC_API_KEY"):
            new_lines.append(f"ANTHROPIC_API_KEY={key}")
            replaced = True
        else:
            new_lines.append(line)
    if not replaced:
        new_lines.insert(0, f"ANTHROPIC_API_KEY={key}")
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def prompt_for_key() -> bool:
    """交互式输入并保存 API key（重复调用会覆盖旧 key）。"""
    print(_cyan("\n请输入你的 DeepSeek API Key，然后回车（重新输入会覆盖旧的）："))
    try:
        key = input("key >> ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    if not key or is_placeholder(key):
        print(_red("Key 看起来不对，请重新输入。"))
        return False
    write_api_key(key)
    print(_green("✅ Key 已保存。"))
    return True


def ensure_deps() -> bool:
    """把依赖装进项目自己的 .venv（不碰系统 Python，避免冲突）。"""
    if venv_ready():
        return True
    print(_yellow("\n[!] 首次运行：正在创建隔离环境并安装依赖（需联网，约 1 分钟）...\n"))

    vp = venv_python()
    if not vp.exists():
        ret = subprocess.call([sys.executable, "-m", "venv", str(VENV_DIR)])
        if ret != 0 or not vp.exists():
            print(_red("\n创建环境失败。请手动执行下面命令后重试：\n"))
            print(_cyan(f"  {sys.executable} -m venv .venv"))
            print(_cyan("  .venv/bin/python -m pip install -r requirements.txt"))
            print()
            return False

    ret = subprocess.call([
        str(vp), "-m", "pip", "install", "-r", str(ROOT / "requirements.txt"),
        "-i", "https://pypi.tuna.tsinghua.edu.cn/simple",
    ])
    if ret == 0 and venv_ready():
        print(_green("✅ 环境准备完成。\n"))
        return True
    print(_red("\n自动安装失败。请手动执行下面命令后重试：\n"))
    print(_cyan("  .venv/bin/python -m pip install -r requirements.txt"))
    print()
    return False


def ensure_ready() -> bool:
    """确保依赖已装、key 已配置（key 缺失时交互式输入）。"""
    if not ensure_deps():
        return False
    if check_api_key():
        return True
    return prompt_for_key()


def run_lesson(num: str, folder: str, title: str, extra_args: list[str]) -> int:
    code_path = ROOT / folder / "code.py"
    if not code_path.exists():
        print(_red(f"找不到 {code_path}"))
        return 1

    print(_cyan(f"\n>>> 启动 {num} {title}  ({folder}/code.py)\n"))
    vp = venv_python()
    python = str(vp) if vp.exists() else sys.executable
    cmd = [python, str(code_path), *extra_args]
    # 关键：保持 cwd 为项目根目录，各章代码以 Path.cwd() 作为工作目录
    return subprocess.call(cmd, cwd=ROOT)


def show_menu():
    print(_cyan("=" * 60))
    print(_cyan("  learn-claude-code  ·  17 课 Agent Harness 教程"))
    print(_cyan("=" * 60))
    for num, folder, title, desc in LESSONS:
        print(f"  {_green(num):>12}  {title:<22} {desc}")
    print(_cyan("=" * 60))
    print("  输入编号(如 3)、s03 运行；输入 key 修改 API Key；q 退出程序。")
    print("  在课程里输入 q = 退出本节课，回到这个菜单。")
    print(_cyan("=" * 60))


def main(argv: list[str]) -> int:
    if argv and argv[0] in ("list", "ls", "-l", "--list"):
        show_menu()
        return 0

    if argv and argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0

    if argv and argv[0] in ("setkey", "key"):
        return 0 if prompt_for_key() else 1

    # 直接指定章节
    if argv:
        lesson = find_lesson(argv[0])
        if lesson is None:
            print(_red(f"未知章节: {argv[0]}"))
            show_menu()
            return 1
        num, folder, title, _desc = lesson
        if not ensure_ready():
            return 1
        return run_lesson(num, folder, title, argv[1:])

    # 交互式菜单：先确保依赖和 key 就绪
    if not ensure_ready():
        return 1
    show_menu()
    while True:
        try:
            choice = input(_cyan("run >> ")).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not choice:
            continue
        if choice.lower() in ("q", "quit", "exit"):
            print("bye")
            return 0
        if choice.lower() in ("list", "ls"):
            show_menu()
            continue
        if choice.lower() in ("key", "setkey"):
            prompt_for_key()
            continue
        lesson = find_lesson(choice)
        if lesson is None:
            print(_red(f"未知章节: {choice}（输入 list 查看，q 退出）"))
            continue
        num, folder, title, _desc = lesson
        code = run_lesson(num, folder, title, [])
        if code != 0:
            print(_red(f"\n{num} 退出码 {code}"))
        print(_green(f"\n↩ 已退出 {num}。"))
        show_menu()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
