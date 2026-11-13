// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

// A practice certificate NFT that cannot be transferred (soulbound).
contract SoulboundBadge is ERC721, AccessControl {
    // A "role" is a named permission. Only wallets with this role can issue.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 private _nextId = 1;

    // A custom error is cheaper than a text message and easy to test.
    error Soulbound();

    constructor() ERC721("Practice Badge", "BADGE") {
        // The deployer becomes the admin, who can grant and revoke roles.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Only an issuer can create a new badge for a student.
    function issue(address to) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        tokenId = _nextId++;
        _mint(to, tokenId);
    }

    // OpenZeppelin calls _update for every mint, transfer and burn.
    // We allow only minting (when the token has no owner yet).
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // Both parent contracts define this, so we must say how to combine them.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
