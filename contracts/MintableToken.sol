// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MintableToken
 * @notice ERC20 token with access-controlled minting capability
 * @dev Uses OpenZeppelin v5 contracts for ERC20, ERC20Capped, and AccessControl
 */
contract MintableToken is ERC20, ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    bool public immutable hasCap;
    uint8 private immutable _decimals;

    /**
     * @notice Deploys a new MintableToken
     * @param name Token name (e.g., "RewardToken")
     * @param symbol Token symbol (e.g., "RWD")
     * @param decimals_ Number of decimals (typically 18)
     * @param cap Maximum supply (0 = unlimited)
     * @param initialSupply Initial tokens to mint (0 = none)
     * @param initialHolder Address to receive initial supply (required if initialSupply > 0)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 cap,
        uint256 initialSupply,
        address initialHolder
    ) ERC20(name, symbol) ERC20Capped(cap == 0 ? type(uint256).max : cap) {
        _decimals = decimals_;
        hasCap = cap > 0;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        if (initialSupply > 0) {
            require(initialHolder != address(0), "Initial holder is zero address");
            _mint(initialHolder, initialSupply);
        }
    }

    /**
     * @notice Returns the number of decimals for the token
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mints new tokens to an address
     * @param to Recipient address
     * @param amount Amount to mint (in smallest units)
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
