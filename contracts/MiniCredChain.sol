// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

// ERC-5192: the standard way to say "this NFT is soulbound (locked)".
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

// Practice version of CredChain (Day 1 + Day 2 scope):
// issuers, issue, batch issue, revoke, verify, soulbound.
contract MiniCredChain is ERC721URIStorage, AccessControl, IERC5192 {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    uint256 public constant MAX_BATCH = 50;

    enum Status { NotFound, Valid, Revoked, Expired }

    struct Credential {
        address issuer;
        uint64 issuedAt;
        uint64 expiresAt;   // 0 = never expires
        bytes32 docHash;    // SHA-256 of the original PDF
        bool revoked;
        string revokeReason;
    }

    // Everything the verifier page needs, in one answer.
    struct VerifyResult {
        Status status;
        address issuer;
        string issuerName;
        address holder;
        bytes32 docHash;
        string uri;
        uint64 issuedAt;
        uint64 expiresAt;
        bool issuerStillApproved;
        string revokeReason;
    }

    mapping(uint256 => Credential) public credentials;
    mapping(address => string) public issuerName;
    mapping(address => uint256[]) private _held;
    uint256 private _nextId = 1;

    event IssuerAdded(address indexed account, string name);
    event IssuerRemoved(address indexed account);
    event CredentialIssued(uint256 indexed tokenId, address indexed issuer, address indexed to, bytes32 docHash);
    event CredentialRevoked(uint256 indexed tokenId, address indexed by, string reason);

    error Soulbound();
    error ZeroAddress();
    error EmptyName();
    error InvalidExpiry();
    error TokenNotFound(uint256 tokenId);
    error NotAllowedToRevoke();
    error AlreadyRevoked(uint256 tokenId);
    error ReasonRequired();
    error EmptyBatch();
    error BatchTooLarge(uint256 size);
    error LengthMismatch();

    constructor() ERC721("CredChain Practice", "CRED") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ---------- Issuer management (admin only) ----------

    function addIssuer(address account, string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        _grantRole(ISSUER_ROLE, account);
        issuerName[account] = name;
        emit IssuerAdded(account, name);
    }

    function removeIssuer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ISSUER_ROLE, account);
        emit IssuerRemoved(account);
        // Existing credentials stay valid; the name stays for the verifier page.
    }

    // ---------- Issuing (issuers only) ----------

    function issue(address to, string calldata uri, bytes32 docHash, uint64 expiresAt)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 tokenId)
    {
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();
        tokenId = _issueOne(to, uri, docHash, expiresAt);
    }

    // Issue to many students at once (e.g. a whole class). All of them, or none.
    function batchIssue(
        address[] calldata to,
        string[] calldata uris,
        bytes32[] calldata docHashes,
        uint64 expiresAt
    ) external onlyRole(ISSUER_ROLE) returns (uint256[] memory tokenIds) {
        uint256 n = to.length;
        if (n == 0) revert EmptyBatch();
        if (n > MAX_BATCH) revert BatchTooLarge(n);
        if (uris.length != n || docHashes.length != n) revert LengthMismatch();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        tokenIds = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            tokenIds[i] = _issueOne(to[i], uris[i], docHashes[i], expiresAt);
        }
    }

    function _issueOne(address to, string calldata uri, bytes32 docHash, uint64 expiresAt)
        internal
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ZeroAddress();

        tokenId = _nextId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        credentials[tokenId] = Credential({
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            docHash: docHash,
            revoked: false,
            revokeReason: ""
        });
        _held[to].push(tokenId);

        emit CredentialIssued(tokenId, msg.sender, to, docHash);
        emit Locked(tokenId);
    }

    // ---------- Revoking (original issuer or admin) ----------

    // The certificate stays in the wallet (soulbound), but verify shows Revoked with the reason.
    function revoke(uint256 tokenId, string calldata reason) external {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotFound(tokenId);
        Credential storage c = credentials[tokenId];
        if (msg.sender != c.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAllowedToRevoke();
        if (c.revoked) revert AlreadyRevoked(tokenId);
        if (bytes(reason).length == 0) revert ReasonRequired();

        c.revoked = true;
        c.revokeReason = reason;
        emit CredentialRevoked(tokenId, msg.sender, reason);
    }

    // ---------- Reading (anyone) ----------

    function verify(uint256 tokenId) external view returns (VerifyResult memory r) {
        address holder = _ownerOf(tokenId);
        if (holder == address(0)) return r; // status = NotFound, everything else empty

        Credential storage c = credentials[tokenId];
        r.issuer = c.issuer;
        r.issuerName = issuerName[c.issuer];
        r.holder = holder;
        r.docHash = c.docHash;
        r.uri = tokenURI(tokenId);
        r.issuedAt = c.issuedAt;
        r.expiresAt = c.expiresAt;
        r.issuerStillApproved = hasRole(ISSUER_ROLE, c.issuer);
        r.revokeReason = c.revokeReason;

        if (c.revoked) r.status = Status.Revoked;
        else if (c.expiresAt != 0 && block.timestamp >= c.expiresAt) r.status = Status.Expired;
        else r.status = Status.Valid;
    }

    function tokensOf(address holder) external view returns (uint256[] memory) {
        return _held[holder];
    }

    function locked(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotFound(tokenId);
        return true;
    }

    // ---------- Soulbound rule ----------

    // Allow only minting. Any transfer or burn reverts.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }
}
