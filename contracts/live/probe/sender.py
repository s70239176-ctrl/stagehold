# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


class Sender(gl.Contract):
    """Holds a deposit and pays it out with emit_transfer, exactly as Stagehold's _pay does."""

    held: u256

    def __init__(self):
        self.held = u256(0)

    @gl.public.write.payable
    def deposit(self) -> str:
        self.held = u256(int(self.held) + int(gl.message.value))
        return str(int(self.held))

    @gl.public.write
    def pay(self, to_hex: str, amount: u256) -> str:
        if int(amount) > int(self.held):
            raise gl.vm.UserError("not enough held")
        self.held = u256(int(self.held) - int(amount))
        gl.get_contract_at(Address(to_hex)).emit_transfer(value=u256(amount))
        return "sent"
