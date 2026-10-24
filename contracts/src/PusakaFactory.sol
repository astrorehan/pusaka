// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {FaraidLib} from "./FaraidLib.sol";
import {EstateLib} from "./EstateLib.sol";
import {PusakaCore} from "./PusakaCore.sol";
import {PusakaVault} from "./PusakaVault.sol";

/// @title PusakaFactory
/// @notice Membuat brankas (klon PusakaVault) dan menyediakan kalkulator faraid untuk web.
contract PusakaFactory {
    IERC20 public immutable token;
    address public immutable vaultImplementation;
    mapping(address => address[]) internal _vaults;

    event VaultCreated(address indexed owner, address vault);

    error ZeroAddress();

    constructor(IERC20 token_, address vaultImplementation_) {
        if (address(token_) == address(0) || vaultImplementation_ == address(0)) revert ZeroAddress();
        token = token_;
        vaultImplementation = vaultImplementation_;
    }

    /// @notice Pemanggil menjadi pewaris. Data yang tidak valid atau belum didukung langsung ditolak.
    function createVault(
        PusakaCore.Heir[] calldata heirs,
        address[] calldata witnesses,
        PusakaCore.Bequest[] calldata bequests,
        PusakaCore.Config calldata cfg
    ) external returns (address vault) {
        vault = Clones.clone(vaultImplementation);
        PusakaVault(vault).initialize(msg.sender, address(token), heirs, witnesses, bequests, cfg);
        _vaults[msg.sender].push(vault);
        emit VaultCreated(msg.sender, vault);
    }

    function vaultsOf(address owner) external view returns (address[] memory) {
        return _vaults[owner];
    }

    /// @notice Bagian faraid per orang untuk komposisi keluarga tertentu.
    function previewFaraid(FaraidLib.Family calldata f, bool raddToSpouse)
        external
        pure
        returns (FaraidLib.Result memory)
    {
        return FaraidLib.compute(f, raddToSpouse);
    }

    /// @notice Kalkulator lengkap: harta bersama → wasiat → faraid, untuk saldo tertentu.
    /// @return jointAmount Bagian pasangan dari harta bersama.
    /// @return bequestAmounts Jumlah tiap wasiat.
    /// @return faraidPool Harta yang dibagi faraid; bagian per orang = faraidPool × num ÷ den di `result`.
    function previewEstate(
        uint256 balance,
        FaraidLib.Family calldata f,
        bool raddToSpouse,
        FaraidLib.Frac calldata joint,
        FaraidLib.Frac[] calldata bequests
    )
        external
        pure
        returns (
            uint256 jointAmount,
            uint256[] memory bequestAmounts,
            uint256 faraidPool,
            FaraidLib.Result memory result
        )
    {
        result = FaraidLib.compute(f, raddToSpouse);
        EstateLib.validate(joint, bequests, f);
        EstateLib.Plan memory p = EstateLib.plan(balance, joint, bequests, new FaraidLib.Frac[](0));
        return (p.jointAmount, p.bequestAmounts, p.faraidPool, result);
    }
}
