"""
Conduit Runner — CLI entry point.

Registered as both `conduit` and `cdt` via pyproject.toml entry points.
"""

from __future__ import annotations

import logging

import typer

app = typer.Typer(
    name="conduit",
    help="Conduit Runner — data pipeline execution agent",
    no_args_is_help=True,
    rich_markup_mode="rich",
)

vault_app = typer.Typer(help="Manage integration credentials in the local vault")
app.add_typer(vault_app, name="vault")


def _setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


@app.command()
def start(
    api_url: str = typer.Option(
        "http://localhost:8000/api/v1", help="Control Plane API URL"
    ),
    poll_interval: int = typer.Option(5, help="Seconds between poll cycles"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging"),
):
    """Start the Conduit Runner daemon."""
    _setup_logging(verbose)

    from conduit.runner.main import RunnerDaemon

    daemon = RunnerDaemon(api_url=api_url, poll_interval=poll_interval)
    daemon.start()


@app.command()
def version():
    """Show the runner version."""
    typer.echo("conduit-runner 0.1.0")


# ── Vault Commands ──


@vault_app.command("add")
def vault_add(integration: str = typer.Argument(help="Integration name")):
    """Add credentials for an integration (interactive prompt)."""
    typer.echo(f"Configuring credentials for: {integration}")
    # TODO: Look up adapter type, prompt for vault_fields, encrypt & store
    typer.echo("(vault add — not yet implemented)")


@vault_app.command("list")
def vault_list():
    """List all locally configured integrations."""
    typer.echo("Configured integrations:")
    typer.echo("  (none)")


@vault_app.command("test")
def vault_test(integration: str = typer.Argument(help="Integration name to test")):
    """Test a connection using locally stored credentials."""
    typer.echo(f"Testing connection: {integration}")
    # TODO: Load creds from vault, instantiate adapter, call test()
    typer.echo("(vault test — not yet implemented)")


@vault_app.command("remove")
def vault_remove(integration: str = typer.Argument(help="Integration name to remove")):
    """Remove credentials for an integration."""
    typer.echo(f"Removing credentials for: {integration}")
    # TODO: Delete encrypted file from vault
    typer.echo("(vault remove — not yet implemented)")


if __name__ == "__main__":
    app()
