"""
Conduit Dev CLI — Cross-platform developer tooling.

Registered as `conduit-dev` entry point.
Commands: setup, start, stop, test, migrate, lint
"""

from __future__ import annotations

import os
import platform
import signal
import socket
import subprocess
import sys
import time
from http.client import HTTPConnection
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="conduit-dev",
    help="Conduit developer CLI — manage the monorepo",
    no_args_is_help=True,
    rich_markup_mode="rich",
)
console = Console()

ROOT = Path(__file__).resolve().parent.parent
PYTHON = sys.executable
RUNTIME_DIR = ROOT / ".runtime"
LOG_DIR = RUNTIME_DIR / "logs"
PID_DIR = RUNTIME_DIR / "pids"


def _venv_python(pkg_dir: Path) -> Path:
    """Get path to Python in a package's venv."""
    if platform.system() == "Windows":
        return pkg_dir / ".venv" / "Scripts" / "python.exe"
    return pkg_dir / ".venv" / "bin" / "python"


def _run(
    cmd: list[str],
    cwd: Path | None = None,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    """Run a command with output streaming."""
    console.print(f"  [dim]→ {' '.join(cmd)}[/dim]")
    return subprocess.run(cmd, cwd=cwd or ROOT, check=check, env=env)


def _wait_for_port(host: str, port: int, timeout_sec: int = 60) -> None:
    """Wait until a TCP port is reachable."""
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return
        except OSError:
            time.sleep(1)
    raise TimeoutError(f"Timed out waiting for {host}:{port}")


def _is_port_open(host: str, port: int) -> bool:
    """Check whether a TCP port is accepting connections."""
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


def _create_venv(pkg_dir: Path) -> None:
    """Create a venv for a package if it doesn't exist."""
    venv_dir = pkg_dir / ".venv"
    if venv_dir.exists():
        console.print(f"  [dim]venv exists: {pkg_dir.name}[/dim]")
        return
    console.print(f"  Creating venv: [bold]{pkg_dir.name}[/bold]")
    _run([PYTHON, "-m", "venv", str(venv_dir)])


def _ensure_runtime_dirs() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    PID_DIR.mkdir(parents=True, exist_ok=True)


def _pid_file(name: str) -> Path:
    return PID_DIR / f"{name}.pid"


def _log_file(name: str) -> Path:
    return LOG_DIR / f"{name}.log"


def _read_pid(name: str) -> int | None:
    pid_path = _pid_file(name)
    if not pid_path.exists():
        return None
    try:
        return int(pid_path.read_text().strip())
    except (ValueError, OSError):
        return None


def _is_pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _stop_pid(name: str) -> bool:
    pid = _read_pid(name)
    if pid is None:
        return False

    if _is_pid_alive(pid):
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass

        for _ in range(20):
            if not _is_pid_alive(pid):
                break
            time.sleep(0.1)

        if _is_pid_alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass

    try:
        _pid_file(name).unlink(missing_ok=True)
    except OSError:
        pass
    return True


def _start_detached(
    name: str,
    cmd: list[str],
    cwd: Path,
    env: dict[str, str] | None = None,
    check_port: int | None = None,
) -> bool:
    existing = _read_pid(name)
    if existing and _is_pid_alive(existing):
        console.print(
            f"[yellow]{name} already running[/yellow] (pid={existing}, log={_log_file(name)})"
        )
        return False

    if check_port and _is_port_open("127.0.0.1", check_port):
        console.print(
            f"[yellow]{name} appears to be running[/yellow] "
            f"(port {check_port} is already in use)."
        )
        return False

    _pid_file(name).unlink(missing_ok=True)
    log_path = _log_file(name)
    with open(log_path, "a", encoding="utf-8") as log_file:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    _pid_file(name).write_text(str(proc.pid), encoding="utf-8")
    time.sleep(0.2)

    if proc.poll() is not None:
        console.print(
            f"[red]{name} failed to start[/red] (exit={proc.returncode}, log={log_path})"
        )
        _pid_file(name).unlink(missing_ok=True)
        return False

    console.print(f"[green]{name} started[/green] (pid={proc.pid}, log={log_path})")
    return True


def _http_status(host: str, port: int, path: str = "/", timeout_sec: int = 2) -> int | None:
    """Return HTTP status code for a simple GET probe, or None on failure."""
    conn = None
    try:
        conn = HTTPConnection(host, port, timeout=timeout_sec)
        conn.request("GET", path)
        return conn.getresponse().status
    except OSError:
        return None
    finally:
        if conn is not None:
            conn.close()


def _docker_service_running(service: str) -> bool | None:
    """Check whether a docker compose service is running.

    Returns:
        True/False when docker compose is available, otherwise None.
    """
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--status", "running", "--services", service],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, OSError):
        return None

    if result.returncode != 0:
        return None

    services = {line.strip() for line in result.stdout.splitlines() if line.strip()}
    return service in services


@app.command()
def setup():
    """First-time setup: create venvs and install all packages."""
    console.print("\n[bold magenta]Conduit — Setup[/bold magenta]\n")

    packages = [
        ("packages/domain", []),
        ("packages/engine", [str(ROOT / "packages" / "domain")]),
        (
            "server",
            [
                str(ROOT / "packages" / "domain"),
                str(ROOT / "packages" / "engine"),
            ],
        ),
        (
            "runner",
            [
                str(ROOT / "packages" / "domain"),
                str(ROOT / "packages" / "engine"),
            ],
        ),
    ]

    for pkg_path, extra_deps in packages:
        pkg_dir = ROOT / pkg_path
        if not pkg_dir.exists():
            continue

        console.print(f"\n[bold cyan]{pkg_path}[/bold cyan]")
        _create_venv(pkg_dir)

        py = str(_venv_python(pkg_dir))

        # Install cross-package dependencies FIRST without trying to resolve them from PyPI
        for dep in extra_deps:
            _run([py, "-m", "pip", "install", "-e", dep, "--no-deps", "-q"])

        # Install the package itself in editable mode
        _run([py, "-m", "pip", "install", "-e", f"{pkg_dir}[dev]", "-q"])

    console.print("\n[bold green]✓ Setup complete[/bold green]\n")


@app.command()
def start(
    with_infra: bool = typer.Option(
        True,
        "--with-infra/--no-infra",
        help="Start postgres/redis with docker compose before app services",
    ),
    migrate: bool = typer.Option(
        False,
        "--migrate",
        help="Run server Alembic migrations before launching app services",
    ),
):
    """Start services in detached mode with standardized runtime logs/pids."""
    console.print("\n[bold magenta]Conduit — Starting services[/bold magenta]\n")

    _ensure_runtime_dirs()
    started = 0

    if with_infra:
        console.print("[cyan]Starting infrastructure (postgres + redis)...[/cyan]")
        try:
            _run(["docker", "compose", "up", "-d", "postgres", "redis"], cwd=ROOT)
            _wait_for_port("127.0.0.1", 5432, timeout_sec=60)
            _wait_for_port("127.0.0.1", 6379, timeout_sec=60)
            console.print("[green]Infrastructure ready[/green]")
        except (subprocess.CalledProcessError, TimeoutError, FileNotFoundError) as exc:
            console.print(
                f"[red]Failed to start infrastructure:[/red] {exc}\n"
                "[yellow]Tip:[/yellow] run with [bold]--no-infra[/bold] if services are managed externally."
            )
            raise typer.Exit(1)

    if migrate:
        server_py = _venv_python(ROOT / "server")
        if not server_py.exists():
            console.print("[red]Server venv missing. Run 'conduit-dev setup' first.[/red]")
            raise typer.Exit(1)
        console.print("[cyan]Applying database migrations...[/cyan]")
        try:
            _run([str(server_py), "-m", "alembic", "upgrade", "head"], cwd=ROOT / "server")
        except subprocess.CalledProcessError as exc:
            console.print(f"[red]Migration failed:[/red] {exc}")
            raise typer.Exit(1)

    # Server
    server_py = _venv_python(ROOT / "server")
    if server_py.exists():
        console.print("[cyan]Starting server...[/cyan]")
        if _start_detached(
            "server",
            [
                str(server_py),
                "-m",
                "uvicorn",
                "app.main:app",
                "--port",
                "8000",
                "--host",
                "0.0.0.0",
            ],
            cwd=ROOT / "server",
            check_port=8000,
        ):
            started += 1

    # Console
    console_dir = ROOT / "console"
    if (console_dir / "package.json").exists():
        console.print("[cyan]Starting console...[/cyan]")
        npm = "npm.cmd" if platform.system() == "Windows" else "npm"
        if _start_detached(
            "console",
            [npm, "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"],
            cwd=console_dir,
            check_port=5173,
        ):
            started += 1

    # Runner
    runner_py = _venv_python(ROOT / "runner")
    if runner_py.exists():
        console.print("[cyan]Starting runner...[/cyan]")
        runner_env = os.environ.copy()
        runner_env["PYTHONPATH"] = (
            f"{ROOT / 'runner' / 'src'}:{ROOT / 'packages' / 'engine' / 'src'}:{ROOT / 'packages' / 'domain' / 'src'}"
        )
        if _start_detached(
            "runner",
            [
                str(runner_py),
                "-m",
                "conduit.runner.cli",
                "start",
                "--api-url",
                "http://127.0.0.1:8000/api/v1",
            ],
            cwd=ROOT,
            env=runner_env,
        ):
            started += 1

    if started == 0:
        console.print("[yellow]No new services started.[/yellow]")
        console.print("[dim]Use 'conduit-dev status' to inspect current state.[/dim]")
        return

    # Lightweight health verification for local loopback
    try:
        _wait_for_port("127.0.0.1", 8000, timeout_sec=20)
    except TimeoutError:
        console.print(
            f"[yellow]Server port 8000 not reachable yet.[/yellow] Check log: {_log_file('server')}"
        )

    try:
        _wait_for_port("127.0.0.1", 5173, timeout_sec=20)
    except TimeoutError:
        console.print(
            f"[yellow]Console port 5173 not reachable yet.[/yellow] Check log: {_log_file('console')}"
        )

    server_health = _http_status("127.0.0.1", 8000, "/health")
    console_http = _http_status("127.0.0.1", 5173, "/")

    console.print(f"\n[bold green]✓ Started {started} service(s)[/bold green]")
    console.print(f"[dim]Runtime: {RUNTIME_DIR}[/dim]")
    if server_health:
        console.print(f"[dim]Server /health: {server_health}[/dim]")
    if console_http:
        console.print(f"[dim]Console /: {console_http}[/dim]")
    console.print("[dim]Use 'conduit-dev stop' to stop services.[/dim]\n")


@app.command()
def stop(
    with_infra: bool = typer.Option(
        False,
        "--with-infra",
        help="Also stop postgres/redis docker compose services",
    ),
):
    """Stop detached services tracked in runtime pid files."""
    console.print("\n[bold magenta]Conduit — Stopping services[/bold magenta]\n")
    _ensure_runtime_dirs()

    stopped = 0
    for name in ("runner", "console", "server"):
        if _stop_pid(name):
            console.print(f"[green]Stopped {name}[/green]")
            stopped += 1
        else:
            if name == "server" and _is_port_open("127.0.0.1", 8000):
                console.print(
                    "[yellow]server is listening on :8000 but is not tracked by runtime pid files[/yellow]"
                )
            elif name == "console" and _is_port_open("127.0.0.1", 5173):
                console.print(
                    "[yellow]console is listening on :5173 but is not tracked by runtime pid files[/yellow]"
                )
            else:
                console.print(f"[dim]{name} not running[/dim]")

    if with_infra:
        console.print("[cyan]Stopping infrastructure (postgres + redis)...[/cyan]")
        _run(["docker", "compose", "stop", "postgres", "redis"], cwd=ROOT, check=False)

    if stopped == 0:
        console.print("\n[yellow]No tracked services were running.[/yellow]\n")
    else:
        console.print(f"\n[bold green]✓ Stopped {stopped} service(s)[/bold green]\n")


@app.command()
def test(
    package: str = typer.Argument(
        default="", help="Package to test: domain, engine, server, runner (empty = all)"
    ),
    unit: bool = typer.Option(False, "--unit", help="Run only unit tests"),
    with_docker: bool = typer.Option(
        False, "--with-docker", help="Start Docker Postgres for server tests"
    ),
):
    """Run tests for one or all packages."""
    console.print("\n[bold magenta]Conduit — Tests[/bold magenta]\n")

    pkg_map = {
        "domain": ROOT / "packages" / "domain",
        "engine": ROOT / "packages" / "engine",
        "server": ROOT / "server",
        "runner": ROOT / "runner",
    }

    targets = (
        [pkg_map[package]] if package and package in pkg_map else list(pkg_map.values())
    )

    total_failed = 0
    docker_started = False
    try:
        needs_server_tests = any(pkg_dir.name == "server" for pkg_dir in targets)
        if with_docker and needs_server_tests:
            console.print("\n[bold cyan]docker[/bold cyan]")
            _run(["docker", "compose", "up", "-d", "postgres"], cwd=ROOT)
            _wait_for_port("127.0.0.1", 5432, timeout_sec=60)
            docker_started = True
            console.print("[green]✓ Postgres is reachable on 127.0.0.1:5432[/green]")

        for pkg_dir in targets:
            if not pkg_dir.exists():
                continue

            py = _venv_python(pkg_dir)
            if not py.exists():
                console.print(
                    f"[yellow]Skipping {pkg_dir.name} — no venv. Run 'conduit-dev setup'.[/yellow]"
                )
                continue

            console.print(f"\n[bold cyan]{pkg_dir.name}[/bold cyan]")
            test_dir = pkg_dir / "tests"
            if unit:
                test_dir = test_dir / "unit"

            cmd_env: dict[str, str] | None = None
            if pkg_dir.name == "server":
                cmd_env = os.environ.copy()
                cmd_env.setdefault(
                    "CONDUIT_TEST_DB_URL",
                    "postgresql+asyncpg://conduit:conduit123@127.0.0.1:5432/conduit_test",
                )

            result = _run(
                [str(py), "-m", "pytest", str(test_dir), "-v", "--tb=short"],
                cwd=pkg_dir,
                check=False,
                env=cmd_env,
            )
            if result.returncode != 0:
                total_failed += 1
    finally:
        if docker_started:
            console.print("\n[bold cyan]docker[/bold cyan]")
            _run(["docker", "compose", "stop", "postgres"], cwd=ROOT, check=False)

    if total_failed:
        console.print(
            f"\n[bold red]✗ {total_failed} package(s) had test failures[/bold red]"
        )
        raise typer.Exit(1)
    else:
        console.print("\n[bold green]✓ All tests passed[/bold green]")


@app.command()
def migrate(
    message: str = typer.Option("", "-m", "--message", help="Migration message"),
    revision: bool = typer.Option(
        False, "--revision", help="Create a new revision instead of upgrading"
    ),
):
    """Run Alembic database migrations."""
    server_dir = ROOT / "server"
    py = _venv_python(server_dir)

    if not py.exists():
        console.print(
            "[red]Server venv not found. Run 'conduit-dev setup' first.[/red]"
        )
        raise typer.Exit(1)

    if revision:
        if not message:
            console.print(
                "[red]Revision requires a message: conduit-dev migrate --revision -m 'description'[/red]"
            )
            raise typer.Exit(1)
        _run(
            [str(py), "-m", "alembic", "revision", "--autogenerate", "-m", message],
            cwd=server_dir,
        )
    else:
        _run([str(py), "-m", "alembic", "upgrade", "head"], cwd=server_dir)


@app.command()
def lint():
    """Run ruff linter across all Python packages."""
    console.print("\n[bold magenta]Conduit — Lint[/bold magenta]\n")
    _run(
        [
            PYTHON,
            "-m",
            "ruff",
            "check",
            "packages/",
            "server/",
            "runner/",
            "--config",
            "ruff.toml",
        ]
    )
    console.print("\n[bold green]✓ Lint passed[/bold green]")


@app.command()
def status():
    """Show status of all packages and services."""
    table = Table(title="Conduit Status")
    table.add_column("Component", style="cyan")
    table.add_column("Venv", style="dim")
    table.add_column("Status")
    table.add_column("Runtime", style="dim")

    pkg_map = {
        "domain": ROOT / "packages" / "domain",
        "engine": ROOT / "packages" / "engine",
        "server": ROOT / "server",
        "runner": ROOT / "runner",
        "console": ROOT / "console",
    }

    for name, path in pkg_map.items():
        exists = path.exists()
        venv = "✓" if (path / ".venv").exists() else "—"
        if not exists:
            table.add_row(name, "—", "[red]Not found[/red]", "—")
        else:
            is_app_service = name in {"server", "runner", "console"}
            pid = _read_pid(name) if is_app_service else None
            running = bool(pid and _is_pid_alive(pid))

            if name == "console":
                has_modules = (path / "node_modules").exists()
                venv_display = "n/a"
                port_running = _is_port_open("127.0.0.1", 5173)
                status = (
                    "[green]Running[/green]"
                    if running or port_running
                    else (
                        "[green]Ready[/green]"
                        if has_modules
                        else "[yellow]npm install needed[/yellow]"
                    )
                )
            else:
                venv_display = venv
                port_running = _is_port_open("127.0.0.1", 8000) if name == "server" else False
                status = (
                    "[green]Running[/green]"
                    if running or port_running
                    else (
                        "[green]Ready[/green]"
                        if venv == "✓"
                        else "[yellow]Setup needed[/yellow]"
                    )
                )

            runtime = "n/a"
            if is_app_service:
                runtime = (
                    f"pid={pid} log={_log_file(name)}"
                    if running
                    else f"log={_log_file(name)}"
                )
                if not running:
                    if name == "server" and _is_port_open("127.0.0.1", 8000):
                        runtime = "external process on :8000 (not runtime-tracked)"
                    elif name == "console" and _is_port_open("127.0.0.1", 5173):
                        runtime = "external process on :5173 (not runtime-tracked)"
            table.add_row(name, venv_display, status, runtime)

    postgres_running = _docker_service_running("postgres")
    redis_running = _docker_service_running("redis")
    infra_status = {
        "postgres": postgres_running,
        "redis": redis_running,
    }
    for infra_name, running in infra_status.items():
        if running is None:
            status_text = "[yellow]Unknown (docker unavailable)[/yellow]"
        else:
            status_text = "[green]Running[/green]" if running else "[dim]Stopped[/dim]"
        table.add_row(infra_name, "docker", status_text, "docker compose")

    console.print(table)


if __name__ == "__main__":
    app()
