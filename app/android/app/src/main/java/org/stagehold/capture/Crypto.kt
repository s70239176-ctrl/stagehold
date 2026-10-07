package org.stagehold.capture

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/** Hardware-backed signing key, attestation chain and capture signature. Matches contracts/src/body.py. */
object Crypto {
    private const val PROVIDER = "AndroidKeyStore"

    fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)
    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    private fun jobTag(contract: String, builder: String): ByteArray =
        "${contract.lowercase()}:${builder.lowercase()}".toByteArray(Charsets.US_ASCII)

    /** The attestation challenge the contract expects: sha256(contract_lower + ":" + builder_lower). */
    fun challengeFor(contract: String, builder: String): ByteArray = sha256(jobTag(contract, builder))

    fun aliasFor(contract: String, builder: String): String = "stagehold-" + hex(sha256(jobTag(contract, builder))).take(16)

    private fun keyStore(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

    private fun generate(alias: String, challenge: ByteArray, strongBox: Boolean) {
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setAttestationChallenge(challenge)
            .apply { if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) setIsStrongBoxBacked(true) }
            .build()
        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVIDER).apply { initialize(spec) }.generateKeyPair()
    }

    /**
     * Creates the signing key for this job (reuses it if it exists) and returns the attested
     * certificate chain as base64 DER strings, leaf first, plus whether StrongBox backed it.
     * The chain must be fetched right after creation: it carries the job-bound challenge.
     */
    fun createKeyAndChain(contract: String, builder: String): Pair<List<String>, Boolean> {
        val alias = aliasFor(contract, builder)
        val ks = keyStore()
        var strongBox = false
        if (!ks.containsAlias(alias)) {
            val challenge = challengeFor(contract, builder)
            try {
                generate(alias, challenge, strongBox = true)
                strongBox = true
            } catch (e: StrongBoxUnavailableException) {
                generate(alias, challenge, strongBox = false)
            }
        }
        val chain = ks.getCertificateChain(alias) ?: error("no certificate chain for $alias")
        return chain.map { Base64.encodeToString(it.encoded, Base64.NO_WRAP) } to strongBox
    }

    private fun fixed32(v: BigInteger): ByteArray {
        val raw = v.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
        require(raw.size <= 32)
        return ByteArray(32 - raw.size) + raw
    }

    /** key_id the contract derives: sha256(x || y), each 32 bytes big-endian. */
    fun keyId(contract: String, builder: String): String {
        val cert = keyStore().getCertificate(aliasFor(contract, builder)) ?: error("device key not created yet")
        val pub = cert.publicKey as ECPublicKey
        return hex(sha256(fixed32(pub.w.affineX) + fixed32(pub.w.affineY)))
    }

    /** SHA256withECDSA over the exact capture message; returns the DER signature. */
    fun sign(contract: String, builder: String, message: ByteArray): ByteArray {
        val key = keyStore().getKey(aliasFor(contract, builder), null) as PrivateKey
        return Signature.getInstance("SHA256withECDSA").run {
            initSign(key)
            update(message)
            sign()
        }
    }

    /** The exact ASCII message the contract verifies (contracts/src/body.py: build_shot_message). */
    fun shotMessage(contract: String, stage: String, code: String, deadline: Long, jpegSha: String, thumbSha: String): ByteArray =
        "stagehold.v1|${contract.lowercase()}|$stage|$code|$deadline|$jpegSha|$thumbSha".toByteArray(Charsets.US_ASCII)
}
