"""Command-line interface for opc-sync (stdlib only)."""

import argparse
import sys

from .sync import SyncTool

DEFAULT_REPO = "."
# DEFAULT_TARGET = "~/.config/opencode"
# DEFAULT_AGENTS_TARGET = "~/.agents"
DEFAULT_TARGET = "./.opencode"
DEFAULT_AGENTS_TARGET = "./.opencode"
DEFAULT_STAGING = "~/.cache/opc-sync"


def build_parser():
    p = argparse.ArgumentParser(prog="opc-sync", description="OpenCode config sync (stdlib only)")
    p.add_argument("--repo", default=DEFAULT_REPO)
    p.add_argument("--target", default=DEFAULT_TARGET,
                   help="opencode config target dir (default ~/.config/opencode)")
    p.add_argument("--agents-target", default=DEFAULT_AGENTS_TARGET,
                   help="shared agents dir (default ~/.agents)")
    p.add_argument("--staging", default=DEFAULT_STAGING)
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("pull")
    sp.set_defaults(func=lambda t: t.cmd_pull())

    sp = sub.add_parser("status")
    sp.add_argument("--list", action="store_true")
    sp.add_argument("--diff", action="store_true")
    sp.add_argument("--json", action="store_true", help="machine-readable JSON output")
    sp.set_defaults(func=lambda t, a: t.cmd_status(list_items=a.list, diff=a.diff, json_out=a.json))

    sp = sub.add_parser("clean")
    sp.add_argument("--yes", action="store_true")
    sp.set_defaults(func=lambda t, a: t.cmd_clean(yes=a.yes))

    sp = sub.add_parser("verify")
    sp.add_argument("--dry-run", action="store_true", help="show what would be verified without running")
    sp.set_defaults(func=lambda t, a: t.cmd_verify(dry_run=a.dry_run))

    sp = sub.add_parser("doctor")
    sp.set_defaults(func=lambda t: t.cmd_doctor())

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    tool = SyncTool(repo_url=args.repo, target=args.target,
                    agents_target=args.agents_target, staging=args.staging,
                    force=args.force, dry_run=args.dry_run, verbose=args.verbose)
    if args.cmd == "pull":
        return tool.cmd_pull()
    if args.cmd == "status":
        return tool.cmd_status(list_items=args.list, diff=args.diff, json_out=args.json)
    if args.cmd == "clean":
        return tool.cmd_clean(yes=args.yes)
    if args.cmd == "verify":
        return tool.cmd_verify(dry_run=args.dry_run)
    if args.cmd == "doctor":
        return tool.cmd_doctor()
    return 2


if __name__ == "__main__":
    sys.exit(main())
