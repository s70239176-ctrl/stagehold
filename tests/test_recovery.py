"""Logic tests of the money paths, run in-process against the generated contract with a fake runtime.

Covers what is hard to force on a live network: a payout message that never lands (the stage must not stay
SETTLING forever), a late or duplicate payout message (must not pay twice), stray value left by a failed
payable transaction, and the accounting identity balance = liabilities + surplus.   python tests/test_recovery.py
"""

import os
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ------------------------------------------------------------------ fake runtime
EVENTS = []          # transfers and emitted messages, in order
STATE = {"now": 1_800_000_000, "sender": "0x" + "11" * 20, "value": 0}


class Address:
    def __init__(self, v):
        if isinstance(v, (bytes, bytearray)):
            v = "0x" + bytes(v).hex()
        self.as_hex = v


class TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls


class UserError(Exception):
    pass


class _Msg:
    @property
    def sender_address(self):
        return Address(STATE["sender"])

    @property
    def value(self):
        return STATE["value"]


class _Emitter:
    def __init__(self, to):
        self.to = to

    def emit_transfer(self, value):
        EVENTS.append(("transfer", self.to.as_hex.lower(), int(value)))

    def emit(self, on=None):
        outer = self

        class _Call:
            def __getattr__(self, name):
                def call(*args):
                    EVENTS.append(("emit", on, name, args))
                return call
        return _Call()


class _W:
    def __call__(self, f):
        return f
    payable = staticmethod(lambda f: f)


gl = types.SimpleNamespace(
    Contract=object,
    public=types.SimpleNamespace(view=lambda f: f, write=_W()),
    vm=types.SimpleNamespace(UserError=UserError, Return=object),
    message=_Msg(),
    message_raw={},
    get_contract_at=lambda a: _Emitter(a),
    nondet=types.SimpleNamespace(),
)
stub = types.ModuleType("genlayer")
stub.TreeMap = TreeMap
stub.u256 = int
stub.Address = Address
stub.allow_storage = lambda c: c
stub.gl = gl
sys.modules["genlayer"] = stub

src = open(os.path.join(ROOT, "contracts", "stagehold.py"), encoding="utf-8").read()
ns = {}
exec(compile(src, "stagehold.py", "exec"), ns)
Stagehold = ns["Stagehold"]
Stage = ns["Stage"]

PAYER = "0x" + "11" * 20
BUILDER = "0x" + "22" * 20
STRANGER = "0x" + "33" * 20
SELF = "0x" + "99" * 20


def iso(ts):
    import datetime
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


def call(who, fn, *args, value=0):
    STATE["sender"] = who
    STATE["value"] = value
    gl.message_raw = {"datetime": iso(STATE["now"]), "contract_address": SELF}
    try:
        return True, fn(*args)
    except UserError as e:
        return False, str(e)


def new_job(dev=True):
    STATE["sender"] = PAYER
    gl.message_raw = {"datetime": iso(STATE["now"]), "contract_address": SELF}
    job = Stagehold(BUILDER, 10, 100_000 if dev else 30 * 86400, "", "", 0, dev, 3600, True)
    job.stages = TreeMap()
    job.keys = TreeMap()
    job.seen = TreeMap()
    job.log = TreeMap()
    job.balance = 0
    return job


def fund(job, stages, amounts):
    """Funds a job the way the contract does, without the image checks (those are covered elsewhere)."""
    for s, a in zip(stages, amounts):
        job.stages[s] = Stage(funded=a, status="OPEN", code="", code_deadline=0, request_at=0, attempts=0, attempt_ok=0, settle_at=0)
    job.status = "ACTIVE"
    job.balance += sum(amounts)


def settling(job, stage, at):
    st = job.stages[stage]
    st.status = "SETTLING"
    st.attempt_ok = 1
    st.attempts = 1
    st.settle_at = at
    job.settling = True


def transfers():
    return [(to, v) for k, to, v in [(e[0], e[1], e[2]) for e in EVENTS if e[0] == "transfer"]]


fails = 0


def check(label, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + label + (("  " + extra) if extra else ""))
    if not cond:
        fails += 1


# ------------------------------------------------------------------ settlement recovery
EVENTS.clear()
j = new_job()
fund(j, ["roof", "plaster"], [600, 400])
settling(j, "roof", STATE["now"])
ok, msg = call(STRANGER, j.recover_settlement, "roof")
check("recovery is refused while the payout is still expected", not ok and "too early" in msg, msg)

STATE["now"] += 11   # past DEV_SETTLE_RETRY, before DEV_SETTLE_FORCE
ok, msg = call(STRANGER, j.recover_settlement, "roof")
check("after the retry delay, anyone can re-emit the finalized payout", ok and msg == "payout retried", msg)
emits = [e for e in EVENTS if e[0] == "emit"]
check("the retry is the same finalize_stage call, for the same attempt, on finality", len(emits) == 1 and emits[0][1:] == ("finalized", "finalize_stage", ("roof", 1)), str(emits))
check("the retry itself moves no money", transfers() == [])
check("the stage is still SETTLING until the message lands", j.stages["roof"].status == "SETTLING" and j.settling)

STATE["now"] += 40   # past DEV_SETTLE_FORCE
ok, msg = call(STRANGER, j.recover_settlement, "roof")
check("after the force delay the stage is settled directly", ok and msg == "settled directly", msg)
check("the builder is paid exactly the stage amount, once", transfers() == [(BUILDER, 600)], str(transfers()))
check("the lock is released", j.settling is False and j.stages["roof"].status == "PAID" and int(j.stages["roof"].funded) == 0)
check("the job stays ACTIVE while another stage is unpaid", j.status == "ACTIVE")

# the original message finally arrives after the direct settlement: it must not pay again
ok, msg = call(SELF, j.finalize_stage, "roof", 1)
check("a late finalize message is rejected (no double payment)", not ok, msg)
check("still exactly one payout", transfers() == [(BUILDER, 600)])
ok, msg = call(STRANGER, j.recover_settlement, "roof")
check("recovery on a paid stage is refused", not ok and "not settling" in msg, msg)

# the normal path still pays only for the right sender and attempt
EVENTS.clear()
j2 = new_job()
fund(j2, ["roof"], [500])
settling(j2, "roof", STATE["now"])
ok, msg = call(STRANGER, j2.finalize_stage, "roof", 1)
check("finalize_stage refuses anyone but the contract itself", not ok)
ok, msg = call(SELF, j2.finalize_stage, "roof", 2)
check("finalize_stage refuses a different attempt", not ok)
ok, msg = call(SELF, j2.finalize_stage, "roof", 1)
check("finalize_stage pays the builder and closes the job when everything is paid", ok and transfers() == [(BUILDER, 500)] and j2.status == "DONE", msg)
ok, msg = call(SELF, j2.finalize_stage, "roof", 1)
check("a duplicate finalize message is rejected", not ok and transfers() == [(BUILDER, 500)])

# while a stage is stuck SETTLING, the exits are blocked; after recovery they work again
EVENTS.clear()
j3 = new_job()
fund(j3, ["roof", "plaster"], [600, 400])
settling(j3, "roof", STATE["now"])
ok, msg = call(PAYER, j3.cancel)
check("cancel is blocked while a payout is pending", not ok)
STATE["now"] += 200_000
ok, msg = call(PAYER, j3.expire)
check("expire is blocked while a payout is pending", not ok)
ok, msg = call(STRANGER, j3.recover_settlement, "roof")
ok2, msg2 = call(PAYER, j3.expire)
check("after recovery the job can expire and refund the unpaid stage", ok and ok2 and (PAYER, 400) in transfers() and (BUILDER, 600) in transfers(), str(transfers()))

# production timing is long
jp = new_job(dev=False)
fund(jp, ["roof"], [100])
settling(jp, "roof", STATE["now"])
STATE["now"] += 3600
ok, msg = call(STRANGER, jp.recover_settlement, "roof")
check("a production job does not allow recovery after one hour", not ok, msg)
STATE["now"] += 6 * 3600
ok, msg = call(STRANGER, jp.recover_settlement, "roof")
check("a production job allows a retry after six hours", ok and msg == "payout retried", msg)
STATE["now"] += 7 * 86400
EVENTS.clear()
ok, msg = call(STRANGER, jp.recover_settlement, "roof")
check("and a direct settlement after seven days", ok and msg == "settled directly" and transfers() == [(BUILDER, 100)], msg)

# ------------------------------------------------------------------ stray value
EVENTS.clear()
j4 = new_job()
fund(j4, ["roof"], [500])
j4.builder_credits = 30
j4.balance += 30                      # credits
check("accounting: balance equals what is owed before any stray value", int(j4.balance) == j4._liabilities() == 530)

j4.balance += 777                     # a failed payable transaction left this in the contract
ok, msg = call(PAYER, j4.reclaim_surplus)
check("surplus cannot be reclaimed while the job is open", not ok, msg)

ok, msg = call(PAYER, j4.cancel)
ok, msg = call(BUILDER, j4.cancel)
check("both parties cancel", j4.status == "CANCELLED")
j4.balance -= 500                     # the refund transfer lands
EVENTS.clear()
ok, msg = call(PAYER, j4.reclaim_surplus)
check("surplus cannot be reclaimed straight after closing", not ok and "too early" in msg, msg)
STATE["now"] += 31
ok, msg = call(STRANGER, j4.reclaim_surplus)
check("only the payer can reclaim surplus", not ok, msg)
ok, msg = call(PAYER, j4.reclaim_surplus)
check("the payer reclaims exactly the stray 777", ok and msg == "777" and transfers() == [(PAYER, 777)], f"{msg} {transfers()}")
j4.balance -= 777
check("afterwards balance equals liabilities (the builder's 30 credits)", int(j4.balance) == j4._liabilities() == 30)
ok, msg = call(PAYER, j4.reclaim_surplus)
check("a second reclaim finds nothing", not ok and "no unaccounted" in msg, msg)

# surplus can never touch credits or stage money
j5 = new_job()
fund(j5, ["roof"], [500])
j5.builder_credits = 40
j5.balance += 40
j5.status = "EXPIRED"
j5.closed_at = STATE["now"] - 100
ok, msg = call(PAYER, j5.reclaim_surplus)
check("with the books balanced there is no surplus to take", not ok, msg)
j5.stages["roof"].funded = 0
j5.balance = 40
ok, msg = call(PAYER, j5.reclaim_surplus)
check("credits are never treated as surplus", not ok, msg)

print("\nFAILURES:", fails)
raise SystemExit(1 if fails else 0)
