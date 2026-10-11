# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


class Sink(gl.Contract):
    """Accepts plain GEN transfers (a contract recipient)."""

    received: u256

    def __init__(self):
        self.received = u256(0)

    @gl.public.write.payable
    def __receive__(self):
        self.received = u256(int(self.received) + int(gl.message.value))

    @gl.public.view
    def get_received(self) -> str:
        return str(int(self.received))
