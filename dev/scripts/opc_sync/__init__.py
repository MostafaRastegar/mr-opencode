"""opc-sync package: stdlib-only OpenCode configuration sync tool."""

from .cli import build_parser, main
from .catalog import find_skills_config
from .config import deep_merge, strip_jsonc_comments, substitute_env
from .fs import atomic_write_text, collect_files, content_diff, file_hash
from .git import ensure_clone, run_git
from .sync import SyncTool

__all__ = [
    "build_parser",
    "main",
    "SyncTool",
    "deep_merge",
    "strip_jsonc_comments",
    "substitute_env",
    "atomic_write_text",
    "collect_files",
    "content_diff",
    "file_hash",
    "ensure_clone",
    "run_git",
    "find_skills_config",
]
