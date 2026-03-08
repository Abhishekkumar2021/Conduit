"""
Conduit Dev CLI — Cross-platform developer tooling.

Registered as `conduit-dev` entry point.
Commands: setup, start, stop, test, migrate, lint
"""

from __future__ import annotations

import os
import platform
import socket
import subprocess
import sys
import time
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


def _create_venv(pkg_dir: Path) -> None:
    """Create a venv for a package if it doesn't exist."""
    venv_dir = pkg_dir / ".venv"
    if venv_dir.exists():
        console.print(f"  [dim]venv exists: {pkg_dir.name}[/dim]")
        return
    console.print(f"  Creating venv: [bold]{pkg_dir.name}[/bold]")
    _run([PYTHON, "-m", "venv", str(venv_dir)])


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
def start():
    """Start all services (server + runner + console)."""
    console.print("\n[bold magenta]Conduit — Starting services[/bold magenta]\n")

    processes = []

    # Server
    server_py = _venv_python(ROOT / "server")
    if server_py.exists():
        console.print("[cyan]Starting server...[/cyan]")
        p = subprocess.Popen(
            [
                str(server_py),
                "-m",
                "uvicorn",
                "app.main:app",
                "--reload",
                "--port",
                "8000",
                "--host",
                "0.0.0.0",
            ],
            cwd=ROOT / "server",
        )
        processes.append(("server", p))

    # Console
    console_dir = ROOT / "console"
    if (console_dir / "package.json").exists():
        console.print("[cyan]Starting console...[/cyan]")
        npm = "npm.cmd" if platform.system() == "Windows" else "npm"
        p = subprocess.Popen(
            [npm, "run", "dev"],
            cwd=console_dir,
        )
        processes.append(("console", p))

    if not processes:
        console.print(
            "[yellow]No services found to start. Run 'conduit-dev setup' first.[/yellow]"
        )
        return

    console.print(f"\n[bold green]✓ Started {len(processes)} service(s)[/bold green]")
    console.print("[dim]Press Ctrl+C to stop all services[/dim]\n")

    try:
        while True:
            time.sleep(1)
            for name, p in processes:
                if p.poll() is not None:
                    console.print(f"[red]{name} exited with code {p.returncode}[/red]")
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopping services...[/yellow]")
        for name, p in processes:
            p.terminate()
        for name, p in processes:
            p.wait(timeout=10)
        console.print("[bold green]✓ All services stopped[/bold green]")


@app.command()
def stop():
    """Stop all running services."""
    console.print(
        "[yellow]Use Ctrl+C in the terminal running 'conduit-dev start'[/yellow]"
    )


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
            table.add_row(name, "—", "[red]Not found[/red]")
        elif name == "console":
            has_modules = (path / "node_modules").exists()
            table.add_row(
                name,
                "n/a",
                (
                    "[green]Ready[/green]"
                    if has_modules
                    else "[yellow]npm install needed[/yellow]"
                ),
            )
        else:
            table.add_row(
                name,
                venv,
                (
                    "[green]Ready[/green]"
                    if venv == "✓"
                    else "[yellow]Setup needed[/yellow]"
                ),
            )

    console.print(table)


if __name__ == "__main__":
    app()
