// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MintableToken.sol";

/**
 * @title BatchMinter
 * @notice Contract for batch minting tokens to multiple addresses in a single transaction
 * @dev Requires MINTER_ROLE on the target MintableToken contract
 */
contract BatchMinter {
    event BatchMintExecuted(
        address indexed token,
        address indexed operator,
        uint256 totalRecipients,
        uint256 totalAmount
    );

    event MintFailed(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        string reason
    );

    struct MintRequest {
        address recipient;
        uint256 amount;
    }

    /**
     * @notice Execute batch mint to multiple addresses
     * @param token Address of the MintableToken to mint from
     * @param requests Array of mint requests (recipient, amount)
     * @return successCount Number of successful mints
     * @return failedIndices Array of indices that failed
     */
    function batchMint(
        address token,
        MintRequest[] calldata requests
    ) external returns (uint256 successCount, uint256[] memory failedIndices) {
        require(requests.length > 0, "Empty requests");
        require(requests.length <= 100, "Max 100 requests per batch");

        MintableToken mintableToken = MintableToken(token);

        // Verify caller has MINTER_ROLE on the token
        require(
            mintableToken.hasRole(mintableToken.MINTER_ROLE(), msg.sender),
            "Caller is not a minter"
        );

        uint256[] memory tempFailed = new uint256[](requests.length);
        uint256 failedCount = 0;
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < requests.length; i++) {
            try mintableToken.mint(requests[i].recipient, requests[i].amount) {
                successCount++;
                totalAmount += requests[i].amount;
            } catch Error(string memory reason) {
                tempFailed[failedCount] = i;
                failedCount++;
                emit MintFailed(token, requests[i].recipient, requests[i].amount, reason);
            } catch {
                tempFailed[failedCount] = i;
                failedCount++;
                emit MintFailed(token, requests[i].recipient, requests[i].amount, "Unknown error");
            }
        }

        // Copy failed indices to correctly sized array
        failedIndices = new uint256[](failedCount);
        for (uint256 i = 0; i < failedCount; i++) {
            failedIndices[i] = tempFailed[i];
        }

        emit BatchMintExecuted(token, msg.sender, successCount, totalAmount);
    }
}
