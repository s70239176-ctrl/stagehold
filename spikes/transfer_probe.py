# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Transfer probe: does emit_transfer to a plain account show up in that account's balance?

No logic beyond a trivial deposit and one transfer. Throwaway, Studionet only.
"""

from genlayer import *


class TransferProbe(gl.Contract):
    held: u256

    def __init__(self):
        self.held = u256(0)

    @gl.public.write.payable
    def deposit(self) -> str:
        self.held = u256(int(self.held) + int(gl.message.value))
        return str(int(self.held))

    @gl.public.write
    def send_str(self, to_hex: str, amount: u256) -> str:
        """Pay using an Address built from a hex string (what Stagehold does)."""
        if int(amount) > int(self.held):
            raise gl.vm.UserError("not enough held")
        self.held = u256(int(self.held) - int(amount))
        gl.get_contract_at(Address(to_hex)).emit_transfer(value=amount)
        return "sent"

    @gl.public.view
    def get_held(self) -> str:
        return str(int(self.held))
