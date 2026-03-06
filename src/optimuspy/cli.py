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
    set_current_directory,
    _execute_scan_mode,
)


def main():
    # Only change CWD for frozen exe — pip/script users expect CWD-relative paths
    if getattr(sys, 'frozen', False):
        set_current_directory()

    configure_logging()

    parser = argparse.ArgumentParser(description="OptimusPy v2.0 — TM1 Cube Dimension Order Optimizer")
    parser.add_argument('mode', choices=['optimize', 'set', 'scan'],
                        help="Run mode: 'optimize' benchmarks orders, 'set' applies a specific order, "
                             "'scan' discovers optimization candidates")
    parser.add_argument('cube_config', nargs='?', default=None,
                        help="Path to cube JSON configuration file (required for optimize/set)")
    parser.add_argument('--config', dest='config_ini', default='config/config.ini',
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

    cmd_args = parser.parse_args()

    if cmd_args.mode == 'scan':
        if not cmd_args.instance:
            parser.error("scan mode requires --instance")

        logging.info(f"Starting OptimusPy v2.0. Mode: scan, Instance: {cmd_args.instance}")

        config = get_tm1_config(cmd_args.config_ini)
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
            config_ini_path=cmd_args.config_ini,
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
