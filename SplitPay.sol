// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SplitPay
/// @notice Splits a single ERC-20 (USDC) payment among multiple recipients in one transaction,
///         using basis-point shares (1 basis point = 0.01%; 10 000 basis points = 100%).
/// @dev Permissionless and stateless — no owner, no admin, no stored recipient lists.
///      The inherited ReentrancyGuard uses a regular persistent storage slot (SSTORE/SLOAD)
///      to hold the entered/not-entered flag between the start and end of each call.
///      It does NOT use EIP-1153 transient storage (TSTORE/TLOAD); that variant is
///      ReentrancyGuardTransient, which is a separate contract in OpenZeppelin v5.
///
///      IMPORTANT (token blocklist): If any recipient address is blocklisted by the token
///      contract (e.g. USDC's built-in blocklist), their individual transfer will revert and
///      the entire transaction will fail. Remove blocklisted addresses from the recipient list
///      before calling. This is an inherent limitation of push-payment designs with USDC.
contract SplitPay is ReentrancyGuard {
    // ─────────────────────────────────────── Events ────────────────────────────────────────

    /// @notice Emitted after every successful split.
    /// @param initiator  The account that initiated the split (paid the USDC).
    /// @param usdcToken  The ERC-20 token address used for the split.
    /// @param totalAmount The total amount that was distributed.
    /// @param recipients The recipient addresses in the order supplied.
    /// @param amounts    The final per-recipient amounts in the same order.
    event Split(
        address indexed initiator,
        address usdcToken,
        uint256 totalAmount,
        address[] recipients,
        uint256[] amounts
    );

    // ─────────────────────────────────────── Errors ────────────────────────────────────────

    error ZeroTokenAddress();
    error ZeroTotalAmount();
    error InvalidRecipientCount(uint256 count);
    error ArrayLengthMismatch(uint256 recipientsLength, uint256 basisPointsLength);
    error ZeroRecipient(uint256 index);
    error RecipientIsContract(uint256 index);
    error InvalidBasisPointsEntry(uint256 index, uint256 value);
    error BasisPointsSumMustBe10000(uint256 actualSum);
    error ERC20TransferFromFailed();
    error ERC20TransferFailed(uint256 index, address recipient, uint256 amount);

    // ─────────────────────────────────────── Constants ─────────────────────────────────────

    /// @dev 10 000 basis points = 100.00 %
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MIN_RECIPIENTS  = 1;
    uint256 private constant MAX_RECIPIENTS  = 20;

    // ─────────────────────────────────────── Core ──────────────────────────────────────────

    /// @notice Distributes `totalAmount` of an ERC-20 token from the caller to `recipients`
    ///         according to `basisPoints` shares.
    ///
    /// @dev Steps:
    ///      1. Validate all inputs.
    ///      2. Pull `totalAmount` from caller via `transferFrom` (caller must approve first).
    ///      3. Push each share to its recipient using integer arithmetic.
    ///         The LAST recipient receives `totalAmount − Σ(previous shares)` so that every
    ///         token unit is always forwarded (no rounding dust left behind).
    ///
    /// @param usdcToken   ERC-20 token address (must not be the zero address or this contract).
    ///                    WARNING: This function accepts any ERC-20 address — it does not
    ///                    restrict callers to USDC. The official frontend always passes the
    ///                    canonical Arc USDC address (0x3600000000000000000000000000000000000000).
    ///                    Calling this contract directly with an untrusted token address is
    ///                    at the caller's own risk.
    /// @param recipients  Destination addresses (1–20 entries; no zero address; no this contract).
    /// @param basisPoints Parallel share list; each entry must be 1–9 999; entries must sum to
    ///                    exactly 10 000.
    /// @param totalAmount Total token units to distribute (must be > 0).
    function split(
        address usdcToken,
        address[] calldata recipients,
        uint256[] calldata basisPoints,
        uint256 totalAmount
    ) external nonReentrant {
        // ── 1. Input validation ──────────────────────────────────────────────────────────
        if (usdcToken == address(0)) revert ZeroTokenAddress();
        if (totalAmount == 0) revert ZeroTotalAmount();

        uint256 recipientCount = recipients.length;
        if (recipientCount != basisPoints.length) {
            revert ArrayLengthMismatch(recipientCount, basisPoints.length);
        }
        if (recipientCount < MIN_RECIPIENTS || recipientCount > MAX_RECIPIENTS) {
            revert InvalidRecipientCount(recipientCount);
        }

        uint256 bpsSum;
        for (uint256 i = 0; i < recipientCount; ++i) {
            if (recipients[i] == address(0)) revert ZeroRecipient(i);
            // Reject this contract itself as a recipient to avoid tokens being locked.
            if (recipients[i] == address(this)) revert RecipientIsContract(i);

            uint256 bps = basisPoints[i];
            // Each share must be at least 1 bps and at most 10 000 bps.
            // The sum == 10 000 check below is the true invariant.
            if (bps == 0 || bps > BPS_DENOMINATOR) revert InvalidBasisPointsEntry(i, bps);

            bpsSum += bps;
        }

        if (bpsSum != BPS_DENOMINATOR) revert BasisPointsSumMustBe10000(bpsSum);

        // ── 2. Pull funds from caller ────────────────────────────────────────────────────
        IERC20 token = IERC20(usdcToken);

        // transferFrom returns false on failure for some non-reverting tokens; check it.
        if (!token.transferFrom(msg.sender, address(this), totalAmount)) {
            revert ERC20TransferFromFailed();
        }

        // ── 3. Push funds to each recipient ──────────────────────────────────────────────
        uint256[] memory amounts = new uint256[](recipientCount);
        uint256 distributed;

        for (uint256 i = 0; i < recipientCount; ++i) {
            uint256 amount;

            if (i == recipientCount - 1) {
                // Last recipient absorbs any integer-division dust so the full
                // totalAmount is always distributed.
                amount = totalAmount - distributed;
            } else {
                amount = (totalAmount * basisPoints[i]) / BPS_DENOMINATOR;
                distributed += amount;
            }

            amounts[i] = amount;

            if (!token.transfer(recipients[i], amount)) {
                revert ERC20TransferFailed(i, recipients[i], amount);
            }
        }

        emit Split(msg.sender, usdcToken, totalAmount, recipients, amounts);
    }
}
