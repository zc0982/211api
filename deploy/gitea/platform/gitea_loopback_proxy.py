#!/usr/bin/env python3

import argparse
import ipaddress
import select
import signal
import socket
import socketserver


PRIVATE_NETWORKS = tuple(
    ipaddress.ip_network(cidr) for cidr in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)


class ProxyHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        try:
            upstream = socket.create_connection(self.server.target, timeout=5)
        except OSError:
            return
        with upstream:
            upstream.settimeout(None)
            peers = {self.request: upstream, upstream: self.request}
            readers = set(peers)
            while readers:
                ready, _, _ = select.select(list(readers), [], [], 30)
                for source in ready:
                    destination = peers[source]
                    try:
                        data = source.recv(65536)
                    except OSError:
                        data = b""
                    if data:
                        try:
                            destination.sendall(data)
                        except OSError:
                            return
                    else:
                        readers.remove(source)
                        try:
                            destination.shutdown(socket.SHUT_WR)
                        except OSError:
                            pass


class LoopbackProxy(socketserver.ThreadingTCPServer):
    allow_reuse_address = False
    daemon_threads = True

    def handle_error(self, request, client_address) -> None:
        pass


def parse_port(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen-port", required=True, type=parse_port)
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--target-port", required=True, type=parse_port)
    args = parser.parse_args()

    target_ip = ipaddress.ip_address(args.target_host)
    if target_ip.version != 4 or not (
        target_ip.is_loopback or any(target_ip in network for network in PRIVATE_NETWORKS)
    ):
        parser.error("target host must be IPv4 loopback or RFC1918")

    with LoopbackProxy(("127.0.0.1", args.listen_port), ProxyHandler) as server:
        server.target = (str(target_ip), args.target_port)

        def stop(_signum, _frame) -> None:
            raise SystemExit(0)

        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)
        server.serve_forever(poll_interval=0.2)


if __name__ == "__main__":
    main()
