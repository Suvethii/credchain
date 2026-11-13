// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract IssuerList {
    // The admin is the wallet that deployed the contract
    address public admin;

    // Who is an approved issuer, and their display name
    mapping(address => bool) public isIssuer;
    mapping(address => string) public issuerName;

    // Announcements (logs) that websites can listen for
    event IssuerAdded(address indexed account, string name);
    event IssuerRemoved(address indexed account);

    constructor() {
        admin = msg.sender;
    }

    function addIssuer(address account, string calldata name) external {
        require(msg.sender == admin, "Only admin");
        require(account != address(0), "Zero address");
        require(!isIssuer[account], "Already an issuer");
        require(bytes(name).length > 0, "Name required");

        isIssuer[account] = true;
        issuerName[account] = name;
        emit IssuerAdded(account, name);
    }

    function removeIssuer(address account) external {
        require(msg.sender == admin, "Only admin");
        require(isIssuer[account], "Not an issuer");

        isIssuer[account] = false;
        emit IssuerRemoved(account);
    }
}
