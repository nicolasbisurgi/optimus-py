"""OptimusPy CLI entry point."""
import argparse
import logging
import sys

from TM1py import TM1Service

from optimuspy.core import (
    APP_NAME,
    configure_logging,
    get_tm1_config,
    load_cube_config,
    validate_cube_config,
    main as run_optimize,
    resolve_config_path,
    set_current_directory,
    _execute_scan_mode,
)
from optimuspy.optimize_db import (
    format_plan,
    format_run_summary,
    optimize_db,
    read_json,
    restore_chores_for_plan,
)


def tm1_connector(config_ini_path: str, instance: str, password: str = None):
    """Return a zero-arg factory that opens a fresh TM1 service.

    A factory rather than a service: `optimize-db` reconnects mid-run after a
    dropped connection, so it needs to be able to build a new one.
    """
    config = get_tm1_config(config_ini_path)
    if instance not in config:
        raise ValueError(f"Instance '{instance}' not found in {config_ini_path}")
    tm1_args = dict(config[instance])
    tm1_args['session_context'] = APP_NAME
    if password:
        tm1_args['password'] = password
        tm1_args['decode_b64'] = False
    return lambda: TM1Service(**tm1_args)


def _run_optimize_db(parser, cmd_args, config_ini_path: str) -> int:
    if cmd_args.restore_chores_plan_id:
        if not cmd_args.instance:
            parser.error("--restore-chores requires --instance")
        connect = tm1_connector(config_ini_path, cmd_args.instance, cmd_args.password)
        restored = restore_chores_for_plan(connect, cmd_args.restore_chores_plan_id)
        print(f"\n  Re-activated {len(restored)} chore(s)\n")
        return 0

    if cmd_args.resume_plan_id:
        if not cmd_args.instance:
            parser.error("--resume requires --instance")
        connect = tm1_connector(config_ini_path, cmd_args.instance, cmd_args.password)
        logging.info(f"Starting OptimusPy v2.0. Mode: optimize-db (resume "
                     f"{cmd_args.resume_plan_id})")
        run = optimize_db(connect, resume_plan_id=cmd_args.resume_plan_id)
        print(format_run_summary(run))
        return 0 if run.get("status") in ("completed", "stopped_time_limit") else 1

    plan, config = None, None
    if cmd_args.plan_path:
        plan = read_json(cmd_args.plan_path)
        instance = plan["instance"]
    else:
        if not cmd_args.cube_config:
            parser.error("optimize-db mode requires an instructions JSON file "
                         "(or --plan / --resume / --restore-chores)")
        config = load_cube_config(cmd_args.cube_config)
        instance = config.get("instance")
        if not instance:
            parser.error("optimize-db instructions must specify 'instance'")

    logging.info(f"Starting OptimusPy v2.0. Mode: optimize-db, Instance: {instance}")
    connect = tm1_connector(config_ini_path, instance, cmd_args.password)

    try:
        result = optimize_db(connect, config=config, plan=plan, dry_run=cmd_args.dry_run)
    except (ValueError, KeyError, FileNotFoundError) as e:
        print(f"ERROR: {e}")
        return 1

    # A plan keeps its cubes as an ordered list; a run keys them by name.
    if isinstance(result.get("cubes"), list):
        print(format_plan(result))
        return 0
    print(format_run_summary(result))
    return 0 if result.get("status") in ("completed", "stopped_time_limit") else 1


def print_banner():
    S = "\033[38;2;108;172;228m"  # Sky blue
    G = "\033[38;2;255;184;28m"   # Gold
    W = "\033[97m"                # White
    D = "\033[90m"                # Dim gray
    I = "\033[3m"                 # Italic  # noqa: E741 — single-letter ANSI style code matches sibling vars (S/G/W/D/R)
    R = "\033[0m"                 # Reset

    print(f"""
{S} ██████╗ ██████╗ ████████╗██╗███╗   ███╗██╗   ██╗███████╗
██╔═══██╗██╔══██╗╚══██╔══╝██║████╗ ████║██║   ██║██╔════╝
██║   ██║██████╔╝   ██║   ██║██╔████╔██║██║   ██║███████╗
██║   ██║██╔═══╝    ██║   ██║██║╚██╔╝██║██║   ██║╚════██║
╚██████╔╝██║        ██║   ██║██║ ╚═╝ ██║╚██████╔╝███████║
 ╚═════╝ ╚═╝        ╚═╝   ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝{R}
              {G}██████╗ ██╗   ██╗
              ██╔══██╗╚██╗ ██╔╝
              ██████╔╝ ╚████╔╝
              ██╔═══╝   ╚██╔╝
              ██║        ██║
              ╚═╝        ╚═╝{R}

       {G}⚡{W} TM1 Cube Dimension Order Optimizer {G}⚡{R}

          {S}┌───┬───┬───┐      ┌───┬───┬───┐
          │{G} 3 {S}│{G} 1 {S}│{G} 4 {S}│      │{G} 1 {S}│{G} 2 {S}│{G} 3 {S}│
          ├───┼───┼───┤  ──▶  ├───┼───┼───┤
          │{G} 2 {S}│{G} 5 {S}│{G} 6 {S}│      │{G} 4 {S}│{G} 5 {S}│{G} 6 {S}│
          └───┴───┴───┘      └───┴───┴───┘{R}
           {D}   scrambled    ──▶    optimized{R}

          {I}{D}"Till all are optimized." — Optimus Py{R}

{W}                   CUBEWISE{R}
{S}                  #dogoodtm1{R}
{D}             https://cubewise.com{R}
""")


def main():
    # Only change CWD for frozen exe — pip/script users expect CWD-relative paths
    if getattr(sys, 'frozen', False):
        set_current_directory()

    print_banner()
    configure_logging()

    parser = argparse.ArgumentParser(description="OptimusPy v2.0 — TM1 Cube Dimension Order Optimizer")
    parser.add_argument('mode', choices=['optimize', 'set', 'scan', 'optimize-db'],
                        help="Run mode: 'optimize' benchmarks orders, 'set' applies a specific order, "
                             "'scan' discovers optimization candidates, 'optimize-db' applies the "
                             "heuristic order to every cube in an instance under a time limit")
    parser.add_argument('cube_config', nargs='?', default=None,
                        help="Path to cube JSON configuration file (required for optimize/set)")
    parser.add_argument('--config', dest='config_ini', default=None,
                        help="Path to TM1 connection config.ini (default: config/config.ini)")
    parser.add_argument('-p', '--password', dest='password', default=None,
                        help="TM1 password (overrides config.ini)")
    parser.add_argument('--no-resume', dest='no_resume', action='store_true', default=False,
                        help="Ignore existing checkpoint and start fresh (optimize only)")
    parser.add_argument('--tm1-checkpoint', dest='tm1_checkpoint', action='store_true', default=False,
                        help="Store checkpoint as TM1 blob instead of local file "
                             "(for stateless environments like Atmosphere)")
    parser.add_argument('--instance', dest='instance', default=None,
                        help="TM1 instance name from config.ini (scan only)")
    parser.add_argument('--ram-percent', dest='ram_percent', type=int, default=60,
                        help="RAM threshold percentage — include cubes accounting for up to this %% "
                             "of total model RAM (scan only, default: 60)")
    parser.add_argument('--output', dest='output_dir', default=None,
                        help="Output directory for generated JSON config files (scan only)")
    parser.add_argument('--dry-run', dest='dry_run', action='store_true', default=False,
                        help="Build and print the plan without touching the server (optimize-db only)")
    parser.add_argument('--plan', dest='plan_path', default=None,
                        help="Execute a plan file produced by --dry-run (optimize-db only)")
    parser.add_argument('--resume', dest='resume_plan_id', default=None,
                        help="Resume an interrupted run by plan id, against its original "
                             "deadline (optimize-db only)")
    parser.add_argument('--restore-chores', dest='restore_chores_plan_id', default=None,
                        help="Re-activate the chores a crashed run left disabled, by plan id "
                             "(optimize-db only)")

    cmd_args = parser.parse_args()

    try:
        config_location = resolve_config_path(cmd_args.config_ini)
    except FileNotFoundError as e:
        print(f"ERROR: config.ini not found: {e}")
        sys.exit(1)

    if cmd_args.mode == 'optimize-db':
        try:
            return _run_optimize_db(parser, cmd_args, config_location.path)
        except (ValueError, FileNotFoundError) as e:
            print(f"ERROR: {e}")
            return 1

    if cmd_args.mode == 'scan':
        if not cmd_args.instance:
            parser.error("scan mode requires --instance")

        logging.info(f"Starting OptimusPy v2.0. Mode: scan, Instance: {cmd_args.instance}")

        config = get_tm1_config(config_location.path)
        tm1_args = dict(config[cmd_args.instance])
        tm1_args['session_context'] = APP_NAME
        if cmd_args.password:
            tm1_args['password'] = cmd_args.password
            tm1_args['decode_b64'] = False

        with TM1Service(**tm1_args) as tm1:
            success = _execute_scan_mode(
                tm1, cmd_args.instance, cmd_args.ram_percent, cmd_args.output_dir)
    else:
        if not cmd_args.cube_config:
            parser.error(f"'{cmd_args.mode}' mode requires a cube config file")

        logging.info(f"Starting OptimusPy v2.0. Mode: {cmd_args.mode}, Config: {cmd_args.cube_config}")

        cube_config = load_cube_config(cmd_args.cube_config)
        validate_cube_config(cube_config, cmd_args.mode)

        success = run_optimize(
            mode=cmd_args.mode,
            cube_config=cube_config,
            config_ini_path=config_location.path,
            password=cmd_args.password,
            no_resume=cmd_args.no_resume,
            tm1_checkpoint=cmd_args.tm1_checkpoint)

    if success:
        logging.info("Finished successfully")
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())
