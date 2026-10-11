CODE_TTL = 6 * 3600
PAYER_WINDOW = 24 * 3600
MIN_JOB_SECONDS = 30 * 86400
MAX_JPEG = 150 * 1024
MAX_THUMB = 30 * 1024
MAX_ANCHOR = 30 * 1024
MAX_KEYS = 3
CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
# Fallback codes are two common words: models read words far more reliably than random strings.
CODE_WORDS = (
    "TREE", "BLUE", "FISH", "MOON", "STAR", "RAIN", "SAND", "WIND", "FIRE", "LEAF", "ROCK", "BIRD",
    "CORN", "GOAT", "DUCK", "BOAT", "DOOR", "ROAD", "SALT", "MILK", "BEAN", "LAMP", "KITE", "DRUM",
    "RING", "BELL", "CLAY", "WOOD", "IRON", "GOLD", "PINK", "GREY", "TEAK", "PALM", "RICE", "COW",
    "HEN", "SUN", "SKY", "HILL", "LAKE", "BEAR", "LION", "FROG", "SEED", "MAP", "KEY", "CUP",
    "PEN", "HAT", "EGG", "NET", "BOX", "BAG", "FAN", "JAR", "COIN", "BONE", "CAKE", "TENT",
    "FARM", "SHIP", "CART", "MANGO",
)
# Recovery timing. A passing result normally pays through a message that fires at finality. If that
# message ever fails, the stage would stay SETTLING and lock the job, so anyone may retry it after
# SETTLE_RETRY and, after SETTLE_FORCE (far past any appeal window), settle it directly.
# Stray value (sent by a transaction that errored, which keeps its value) may be reclaimed by the payer
# once the job has been closed for SURPLUS_DELAY. dev_mode jobs use short values so tests can reach them.
SETTLE_RETRY = 6 * 3600
SETTLE_FORCE = 7 * 86400
SURPLUS_DELAY = 3600
DEV_SETTLE_RETRY = 10
DEV_SETTLE_FORCE = 45
DEV_SURPLUS_DELAY = 30
BURN_ADDRESS = "0x000000000000000000000000000000000000dead"

S_OPEN = "OPEN"
S_SETTLING = "SETTLING"
S_PAID = "PAID"

J_CREATED = "CREATED"
J_ACTIVE = "ACTIVE"
J_CANCELLED = "CANCELLED"
J_EXPIRED = "EXPIRED"
J_DONE = "DONE"


def _fail(message):
    raise gl.vm.UserError(message)


def _as_address(value):
    """The runtime hands back an Address in some places and raw bytes in others."""
    return value if isinstance(value, Address) else Address(value)


def build_shot_message(contract_hex, stage_id, code, deadline, jpeg_sha_hex, thumb_sha_hex):
    """The exact bytes the Stagehold app signs (SHA256withECDSA, P-256) at capture."""
    return (
        "stagehold.v1|" + contract_hex.lower() + "|" + stage_id + "|" + code + "|" + str(deadline)
        + "|" + jpeg_sha_hex + "|" + thumb_sha_hex
    ).encode("ascii")


def derive_fallback_code(contract_hex, stage_id, attempts, request_at, now):
    seed = hashlib.sha256(
        (contract_hex.lower() + "|" + stage_id + "|" + str(attempts) + "|" + str(request_at) + "|" + str(now)).encode("ascii")
    ).digest()
    first = CODE_WORDS[seed[0] % len(CODE_WORDS)]
    second = CODE_WORDS[seed[1] % len(CODE_WORDS)]
    if second == first:
        second = CODE_WORDS[(seed[1] + 1) % len(CODE_WORDS)]
    return first + " " + second


def _valid_code(code):
    return (
        4 <= len(code) <= 16
        and all(c in CODE_CHARS for c in code)
        and code == code.strip()
        and "  " not in code
    )


def _b64(text, limit, label):
    if len(text) > (limit * 4) // 3 + 8:
        _fail(label + " is too large")
    try:
        raw = base64.b64decode(text, validate=True)
    except Exception:  # noqa: BLE001 - any decode failure is a clean revert
        _fail(label + " is not valid base64")
    if len(raw) == 0 or len(raw) > limit:
        _fail(label + " size out of range")
    return raw


def _parse_time(stamp):
    return int(datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp())


@allow_storage
@dataclass
class Stage:
    funded: u256
    status: str
    code: str
    code_deadline: u256
    request_at: u256
    attempts: u256
    attempt_ok: u256
    settle_at: u256


@allow_storage
@dataclass
class DeviceKey:
    pub_x: str
    pub_y: str
    registered_at: u256


class Stagehold(gl.Contract):
    payer: Address
    builder: Address
    app_package: str
    app_sig_digest: str
    dev_mode: bool
    software_keys: bool
    fee: u256
    expires_at: u256
    payer_window: u256
    align_min: u256
    anchor_b64: str
    anchor_hash: str
    status: str
    settling: bool
    payer_cancel: bool
    builder_cancel: bool
    closed_at: u256
    payer_deposit: u256
    builder_credits: u256
    key_count: u256
    stages: TreeMap[str, Stage]
    keys: TreeMap[str, DeviceKey]
    seen: TreeMap[str, str]
    log: TreeMap[str, str]

    def __init__(
        self,
        builder: str,
        fee: u256,
        expires_in: u256,
        app_package: str,
        app_sig_digest_hex: str,
        align_min_permille: u256,
        dev_mode: bool,
        payer_window_s: u256,
        software_keys: bool,
    ):
        if not builder.startswith("0x") or len(builder) != 42:
            _fail("builder must be a 20-byte hex address")
        if int(fee) < 1:
            _fail("fee must be positive")
        # Production jobs: fixed 30-day minimum and a fixed 24 h payer window.
        # dev_mode jobs may shorten both so the time-based paths can be tested live.
        if not dev_mode and int(expires_in) < MIN_JOB_SECONDS:
            _fail("expires_in must be at least 30 days")
        if int(expires_in) < 30:
            _fail("expires_in is too small")
        if dev_mode and int(payer_window_s) < 1:
            _fail("payer_window_s must be positive in dev mode")
        # software_keys is the WEB mode: any browser-made key may sign shots, so a photo's SOURCE is not
        # authenticated. It is a public, visible property of the job. Attested jobs (the Android app,
        # on the roadmap before mainnet) must name the app package and signing digest.
        if not dev_mode and not software_keys:
            if app_package == "" or len(app_sig_digest_hex) != 64:
                _fail("app package and signing digest are required unless dev_mode or software_keys")
            bytes.fromhex(app_sig_digest_hex)
        if int(align_min_permille) > 1000:
            _fail("align_min_permille out of range")
        self.payer = gl.message.sender_address
        self.builder = Address(builder)
        self.app_package = app_package
        self.app_sig_digest = app_sig_digest_hex.lower()
        self.dev_mode = dev_mode
        self.software_keys = software_keys
        self.fee = fee
        self.expires_at = u256(self._now() + int(expires_in))
        self.payer_window = u256(int(payer_window_s) if dev_mode else PAYER_WINDOW)
        self.align_min = align_min_permille
        self.anchor_b64 = ""
        self.anchor_hash = ""
        self.status = J_CREATED
        self.settling = False
        self.payer_cancel = False
        self.builder_cancel = False
        self.closed_at = u256(0)
        self.payer_deposit = u256(0)
        self.builder_credits = u256(0)
        self.key_count = u256(0)

    # ----------------------------------------------------------- internals
    def _now(self):
        return _parse_time(gl.message_raw["datetime"])

    def _sender_hex(self):
        s = gl.message.sender_address
        return (s if isinstance(s, Address) else Address(s)).as_hex.lower()

    def _self_hex(self):
        return _as_address(gl.message_raw["contract_address"]).as_hex.lower()

    def _only_payer(self):
        if self._sender_hex() != self.payer.as_hex.lower():
            _fail("only the payer")

    def _only_builder(self):
        if self._sender_hex() != self.builder.as_hex.lower():
            _fail("only the builder")

    def _stage(self, stage_id):
        if stage_id not in self.stages:
            _fail("stage is not funded")
        return self.stages[stage_id]

    def _pay(self, to_hex, amount):
        if amount > 0:
            gl.get_contract_at(Address(to_hex)).emit_transfer(value=u256(amount))

    def _refund_unpaid(self):
        total = 0
        for stage_id in STAGE_ORDER:
            if stage_id in self.stages:
                st = self.stages[stage_id]
                if st.status == S_OPEN:
                    total += int(st.funded)
                    st.funded = u256(0)
        self._pay(self.payer.as_hex, total)

    def _liabilities(self):
        """Everything the contract owes: deposits, attempt credits and unpaid stage money."""
        total = int(self.payer_deposit) + int(self.builder_credits)
        for stage_id in STAGE_ORDER:
            if stage_id in self.stages:
                st = self.stages[stage_id]
                if st.status != S_PAID:
                    total += int(st.funded)
        return total

    def _close(self, status):
        self.status = status
        self.closed_at = u256(self._now())

    def _settle(self, stage_id, st):
        """Pay a stage that passed. The only place a passing stage is paid; idempotent by its status."""
        amount = int(st.funded)
        st.status = S_PAID
        st.funded = u256(0)
        self.settling = False
        self._pay(self.builder.as_hex, amount)
        done = True
        for sid in STAGE_ORDER:
            if sid in self.stages and self.stages[sid].status != S_PAID:
                done = False
        if done:
            self._close(J_DONE)

    # ----------------------------------------------------------- money in and out
    # Payable methods are deliberately trivial: a transaction that errors KEEPS its attached
    # value in the contract (observed on Studionet), so nothing that can fail may be payable.
    # Value enters here, is tracked in storage, and every other method works from storage.
    @gl.public.write.payable
    def deposit(self) -> str:
        self._only_payer()
        if self.status != J_CREATED:
            _fail("job is already funded")
        self.payer_deposit = u256(int(self.payer_deposit) + int(gl.message.value))
        return str(int(self.payer_deposit))

    @gl.public.write
    def withdraw_deposit(self) -> str:
        self._only_payer()
        if self.status != J_CREATED:
            _fail("job is already funded")
        amount = int(self.payer_deposit)
        self.payer_deposit = u256(0)
        self._pay(self.payer.as_hex, amount)
        return str(amount)

    @gl.public.write.payable
    def deposit_credits(self) -> str:
        self._only_builder()
        self.builder_credits = u256(int(self.builder_credits) + int(gl.message.value))
        return str(int(self.builder_credits))

    @gl.public.write
    def withdraw_credits(self) -> str:
        self._only_builder()
        amount = int(self.builder_credits)
        self.builder_credits = u256(0)
        self._pay(self.builder.as_hex, amount)
        return str(amount)

    # ----------------------------------------------------------- funding
    @gl.public.write
    def fund(self, stage_ids: list[str], amounts: list[str], anchor_b64: str) -> str:
        self._only_payer()
        if self.status != J_CREATED:
            _fail("job is already funded")
        if len(stage_ids) == 0 or len(stage_ids) != len(amounts):
            _fail("stage_ids and amounts must be the same non-zero length")
        total = 0
        seen = []
        for sid, amt in zip(stage_ids, amounts):
            if sid not in STAGE_WORDING or sid in seen:
                _fail("unknown or duplicate stage")
            if not amt.isdigit() or int(amt) < 1:
                _fail("amounts must be positive integers")
            seen.append(sid)
            total += int(amt)
        if int(self.payer_deposit) != total:
            _fail("deposit must equal the sum of stage amounts")
        raw = _b64(anchor_b64, MAX_ANCHOR, "anchor")
        if raw[:8] != b"\x89PNG\r\n\x1a\n":
            _fail("anchor must be a PNG")
        try:
            alignment_permille(raw, raw)  # proves the runtime can decode it
        except Exception:  # noqa: BLE001
            _fail("anchor PNG cannot be decoded")
        self.anchor_b64 = anchor_b64
        self.anchor_hash = hashlib.sha256(raw).hexdigest()
        for sid, amt in zip(stage_ids, amounts):
            self.stages[sid] = Stage(
                funded=u256(int(amt)), status=S_OPEN, code="", code_deadline=u256(0),
                request_at=u256(0), attempts=u256(0), attempt_ok=u256(0), settle_at=u256(0),
            )
        self.payer_deposit = u256(0)
        self.status = J_ACTIVE
        return self.anchor_hash

    # ----------------------------------------------------------- devices
    @gl.public.write
    def register_device(self, chain_b64: list[str]) -> str:
        self._only_builder()
        if self.status != J_ACTIVE:
            _fail("job is not active")
        if int(self.key_count) >= MAX_KEYS:
            _fail("too many registered devices")
        try:
            chain = [base64.b64decode(c, validate=True) for c in chain_b64]
            anchors = [base64.b64decode(r) for r in ROOTS]
        except Exception:  # noqa: BLE001
            _fail("certificate chain is not valid base64")
        # The attestation challenge binds the key to this job and this builder.
        challenge = hashlib.sha256((self._self_hex() + ":" + self.builder.as_hex.lower()).encode("ascii")).digest()
        package = None
        digest = None
        if not self.dev_mode and self.app_package != "":
            package = self.app_package
            digest = bytes.fromhex(self.app_sig_digest)
        ok, reason, kd = verify_attestation(
            chain, anchors, now=self._now(), challenge=challenge, package=package, signature_digest=digest
        )
        if not ok:
            _fail("attestation rejected: " + reason)
        pub = parse_cert(chain[0])["pub"]
        key_id = hashlib.sha256(pub["x"].to_bytes(32, "big") + pub["y"].to_bytes(32, "big")).hexdigest()
        if key_id in self.keys:
            _fail("device already registered")
        self.keys[key_id] = DeviceKey(pub_x=format(pub["x"], "x"), pub_y=format(pub["y"], "x"), registered_at=u256(self._now()))
        self.key_count = u256(int(self.key_count) + 1)
        return key_id

    @gl.public.write
    def register_software_key(self, pub_x_hex: str, pub_y_hex: str) -> str:
        """WEB MODE. Registers a P-256 key made in the browser, with NO attestation. Reverts unless the job
        was created with software_keys. The signature still binds the shot to this stage, code, deadline and
        these exact bytes; it does not prove where the pixels came from."""
        self._only_builder()
        if not self.software_keys:
            _fail("this job requires an attested device key")
        if self.status != J_ACTIVE:
            _fail("job is not active")
        if int(self.key_count) >= MAX_KEYS:
            _fail("too many registered devices")
        try:
            x = int(pub_x_hex, 16)
            y = int(pub_y_hex, 16)
        except ValueError:
            _fail("key coordinates must be hex")
        if not _on_curve("1.2.840.10045.3.1.7", x, y):
            _fail("point is not on P-256")
        key_id = hashlib.sha256(x.to_bytes(32, "big") + y.to_bytes(32, "big")).hexdigest()
        if key_id in self.keys:
            _fail("device already registered")
        self.keys[key_id] = DeviceKey(pub_x=format(x, "x"), pub_y=format(y, "x"), registered_at=u256(self._now()))
        self.key_count = u256(int(self.key_count) + 1)
        return key_id

    # ----------------------------------------------------------- codes
    @gl.public.write
    def issue_code(self, stage_id: str, code: str) -> str:
        self._only_payer()
        st = self._stage(stage_id)
        if self.status != J_ACTIVE or self.settling or st.status != S_OPEN:
            _fail("stage cannot take a code now")
        if not _valid_code(code):
            _fail("code must be 4 to 16 characters: capital letters, digits and single spaces")
        now = self._now()
        st.code = code
        st.code_deadline = u256(now + CODE_TTL)
        st.request_at = u256(0)
        return code

    @gl.public.write
    def request_code(self, stage_id: str) -> str:
        self._only_builder()
        st = self._stage(stage_id)
        if self.status != J_ACTIVE or self.settling or st.status != S_OPEN:
            _fail("stage cannot take a code now")
        now = self._now()
        if int(st.code_deadline) > now:
            _fail("a valid code already exists")
        if int(st.request_at) != 0:
            _fail("a request is already open")
        st.request_at = u256(now)
        return "requested"

    @gl.public.write
    def trigger_fallback_code(self, stage_id: str) -> str:
        self._only_builder()
        st = self._stage(stage_id)
        if self.status != J_ACTIVE or self.settling or st.status != S_OPEN:
            _fail("stage cannot take a code now")
        now = self._now()
        if int(st.request_at) == 0:
            _fail("request a code first")
        if now < int(st.request_at) + int(self.payer_window):
            _fail("the payer still has time to issue a code")
        if int(st.code_deadline) > now:
            _fail("a valid code already exists")
        code = derive_fallback_code(self._self_hex(), stage_id, int(st.attempts), int(st.request_at), now)
        st.code = code
        st.code_deadline = u256(now + CODE_TTL)
        st.request_at = u256(0)
        return code

    # ----------------------------------------------------------- the shot
    @gl.public.write
    def submit(self, stage_id: str, key_id: str, jpeg_b64: str, thumb_b64: str, signature_hex: str) -> str:
        self._only_builder()
        now = self._now()
        if self.status != J_ACTIVE or self.settling:
            _fail("job cannot take a submission now")
        if now >= int(self.expires_at):
            _fail("job has expired")
        st = self._stage(stage_id)
        if st.status != S_OPEN:
            _fail("stage is not open")
        code = str(st.code)
        deadline = int(st.code_deadline)
        if code == "" or now > deadline:
            _fail("no valid code for this stage")
        if int(self.builder_credits) < int(self.fee):
            _fail("not enough attempt credits; call deposit_credits first")
        if key_id not in self.keys:
            _fail("device key is not registered")

        jpeg = _b64(jpeg_b64, MAX_JPEG, "frame")
        thumb = _b64(thumb_b64, MAX_THUMB, "thumbnail")
        if jpeg[:3] != b"\xff\xd8\xff":
            _fail("frame must be a JPEG")
        if thumb[:8] != b"\x89PNG\r\n\x1a\n":
            _fail("thumbnail must be a PNG")

        jpeg_sha = hashlib.sha256(jpeg).hexdigest()
        thumb_sha = hashlib.sha256(thumb).hexdigest()
        shot_id = hashlib.sha256((stage_id + jpeg_sha + thumb_sha).encode("ascii")).hexdigest()
        if shot_id in self.seen:
            _fail("this shot was already submitted")

        # 1. capture signature (deterministic; the panel never sees a picture that fails this)
        k = self.keys[key_id]
        pub = {"kind": "ec", "curve": "1.2.840.10045.3.1.7", "x": int(k.pub_x, 16), "y": int(k.pub_y, 16)}
        message = build_shot_message(self._self_hex(), stage_id, code, deadline, jpeg_sha, thumb_sha)
        try:
            sig = bytes.fromhex(signature_hex)
        except ValueError:
            _fail("signature is not hex")
        if not verify_shot_signature(pub, hashlib.sha256(message).digest(), sig):
            _fail("capture signature is invalid")

        # 1b. the thumbnail must be a small copy of this very frame (deterministic)
        same, why, _mad = thumb_matches(jpeg, thumb)
        if not same:
            _fail(why)

        # 2. site alignment against the stored anchor (deterministic)
        try:
            score = alignment_permille(base64.b64decode(self.anchor_b64), thumb)
        except Exception:  # noqa: BLE001
            _fail("thumbnail cannot be decoded")
        aligned = int(self.align_min) == 0 or score >= int(self.align_min)
        if not aligned:
            _fail("frame does not match the anchor")

        # 3. the panel: copy to plain memory first; nondet blocks cannot touch storage
        wording_prompt = build_prompt(stage_id, code)

        def leader_fn():
            raw = gl.nondet.exec_prompt(wording_prompt, images=[jpeg], response_format="json")
            return parse_answers(raw)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            mine = leader_fn()
            theirs = leader_res.calldata
            return (
                isinstance(theirs, dict)
                and mine["stage_met"] == theirs.get("stage_met")
                and mine["code_visible"] == theirs.get("code_visible")
            )

        answers = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        answers = parse_answers(answers)  # re-validate whatever consensus returned

        # 4. effects
        self.seen[shot_id] = "1"
        st.attempts = u256(int(st.attempts) + 1)
        self.builder_credits = u256(int(self.builder_credits) - int(self.fee))
        self._pay(BURN_ADDRESS, int(self.fee))  # the fee is burned: no party profits from a failed attempt
        passed = passes(answers)
        result = {
            "stage_met": answers["stage_met"],
            "code_visible": answers["code_visible"],
            "site_aligned": True,
            "paid": passed,
            "attempt": int(st.attempts),
        }
        if passed:
            st.status = S_SETTLING
            st.attempt_ok = st.attempts
            st.settle_at = u256(now)
            self.settling = True
            # Payment happens only after the decision is final (past the appeal window).
            gl.get_contract_at(_as_address(gl.message_raw["contract_address"])).emit(on="finalized").finalize_stage(
                stage_id, st.attempts
            )
        text = json.dumps(result)
        self.log[stage_id + ":" + str(int(st.attempts))] = text
        return text

    @gl.public.write
    def finalize_stage(self, stage_id: str, attempt_no: u256) -> str:
        if self._sender_hex() != self._self_hex():
            _fail("only the contract itself, after finality")
        st = self._stage(stage_id)
        if st.status != S_SETTLING or int(st.attempt_ok) != int(attempt_no):
            _fail("stage is not settling for this attempt")
        self._settle(stage_id, st)
        return "paid"

    @gl.public.write
    def recover_settlement(self, stage_id: str) -> str:
        """If a passing stage is still SETTLING long after it passed (the payout message failed), anyone may
        retry it, and later settle it directly. It can only pay the builder what the stage holds, and only
        for a stage the panel already passed, so it is safe for any caller."""
        st = self._stage(stage_id)
        if st.status != S_SETTLING:
            _fail("stage is not settling")
        age = self._now() - int(st.settle_at)
        retry = DEV_SETTLE_RETRY if self.dev_mode else SETTLE_RETRY
        force = DEV_SETTLE_FORCE if self.dev_mode else SETTLE_FORCE
        if age >= force:
            self._settle(stage_id, st)
            return "settled directly"
        if age >= retry:
            gl.get_contract_at(_as_address(gl.message_raw["contract_address"])).emit(on="finalized").finalize_stage(
                stage_id, st.attempt_ok
            )
            return "payout retried"
        _fail("too early to recover; the payout normally lands at finality")

    @gl.public.write
    def reclaim_surplus(self) -> str:
        """Value sent by a transaction that then errored stays in the contract but is in nobody's balance.
        Once the job has been closed for a while (so no refund or payout is still on its way), the payer
        may take back exactly the unaccounted amount: the balance minus everything the contract owes."""
        self._only_payer()
        if self.status not in (J_DONE, J_CANCELLED, J_EXPIRED) or self.settling:
            _fail("the job is not closed")
        wait = DEV_SURPLUS_DELAY if self.dev_mode else SURPLUS_DELAY
        if self._now() < int(self.closed_at) + wait:
            _fail("too early: wait for pending refunds and payouts to land")
        surplus = int(self.balance) - self._liabilities()
        if surplus <= 0:
            _fail("no unaccounted value")
        self._pay(self.payer.as_hex, surplus)
        return str(surplus)

    # ----------------------------------------------------------- exits
    @gl.public.write
    def cancel(self) -> str:
        if self.status != J_ACTIVE or self.settling:
            _fail("cannot cancel now")
        who = self._sender_hex()
        if who == self.payer.as_hex.lower():
            self.payer_cancel = True
        elif who == self.builder.as_hex.lower():
            self.builder_cancel = True
        else:
            _fail("only the payer or the builder")
        if self.payer_cancel and self.builder_cancel:
            self._refund_unpaid()
            self._close(J_CANCELLED)
            return "cancelled"
        return "cancel recorded; the other party must also cancel"

    @gl.public.write
    def expire(self) -> str:
        if self.status != J_ACTIVE or self.settling:
            _fail("cannot expire now")
        if self._now() < int(self.expires_at):
            _fail("job has not expired")
        self._refund_unpaid()
        self._close(J_EXPIRED)
        return "expired"

    # ----------------------------------------------------------- views
    @gl.public.view
    def get_snapshot(self) -> str:
        stages = {}
        for sid in STAGE_ORDER:
            if sid in self.stages:
                st = self.stages[sid]
                stages[sid] = {
                    "status": st.status, "funded": str(int(st.funded)), "attempts": int(st.attempts),
                    "code": st.code, "code_deadline": int(st.code_deadline), "request_at": int(st.request_at),
                    "settle_at": int(st.settle_at),
                }
        return json.dumps({
            "status": self.status, "settling": self.settling,
            "payer": self.payer.as_hex, "builder": self.builder.as_hex,
            "fee": str(int(self.fee)), "expires_at": int(self.expires_at), "payer_window": int(self.payer_window),
            "dev_mode": self.dev_mode, "software_keys": self.software_keys,
            "capture_attested": not self.software_keys, "alignment_enforced": int(self.align_min) > 0,
            "anchor_hash": self.anchor_hash, "keys": int(self.key_count), "stages": stages,
            "payer_deposit": str(int(self.payer_deposit)), "builder_credits": str(int(self.builder_credits)),
            "closed_at": int(self.closed_at),
            "surplus": str(max(0, int(self.balance) - self._liabilities())),
            "settle_retry": DEV_SETTLE_RETRY if self.dev_mode else SETTLE_RETRY,
            "settle_force": DEV_SETTLE_FORCE if self.dev_mode else SETTLE_FORCE,
            "surplus_delay": DEV_SURPLUS_DELAY if self.dev_mode else SURPLUS_DELAY,
        })

    @gl.public.view
    def get_accounting(self) -> str:
        bal = int(self.balance)
        owed = self._liabilities()
        return json.dumps({"balance": str(bal), "liabilities": str(owed), "surplus": str(max(0, bal - owed))})

    @gl.public.view
    def get_anchor(self) -> str:
        return self.anchor_b64

    @gl.public.view
    def get_attempt(self, stage_id: str, n: u256) -> str:
        key = stage_id + ":" + str(int(n))
        return self.log[key] if key in self.log else ""
