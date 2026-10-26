"""Tests must never reach external services such as Oriflame (OR-007)."""

import socket

import httpx
import pytest
from pytest_socket import SocketConnectBlockedError

EXTERNAL_HOST = ("203.0.113.10", 443)  # TEST-NET-3, never routable

# pytest-socket warns on every blocked attempt; these tests make them on purpose.
pytestmark = pytest.mark.filterwarnings("ignore:A test tried to use socket:UserWarning")


def test_raw_socket_to_external_host_is_blocked() -> None:
    with pytest.raises(SocketConnectBlockedError):
        socket.create_connection(EXTERNAL_HOST, timeout=1)


def test_httpx_request_to_external_host_is_blocked() -> None:
    with pytest.raises(SocketConnectBlockedError):
        httpx.get("https://203.0.113.10/", timeout=1)
