import { CoinGecko } from "../../coin-gecko";
import { ErrorCodes } from "../../common/errors/error-codes";
import { UniswapError } from "../../common/errors/uniswap-error";
import { getAddress } from "../../common/utils/get-address";
import { isAddress } from "../../common/utils/is-address";
import { ChainId } from "../../enums/chain-id";
import { EthersProvider } from "../../ethers-provider";
import { TokensFactory } from "../token/tokens.factory";
import {
  UniswapQuoterContextForChainId,
  UniswapQuoterContextForEthereumProvider,
  UniswapQuoterContextForProviderUrl,
} from "./models/uniswap-quoter-contexts";
import { UniswapQuoterFactoryContext } from "./models/uniswap-quoter-factory-context";
import { UniswapPairSettings } from "../pair/models/uniswap-pair-settings";
import { UniswapQuoterFactory } from "./uniswap-quoter.factory";

export class UniswapQuoter {
  private _ethersProvider: EthersProvider;

  constructor(
    private _uniswapQuoterContext:
      | UniswapQuoterContextForChainId
      | UniswapQuoterContextForProviderUrl
      | UniswapQuoterContextForEthereumProvider
  ) {
    if (!this._uniswapQuoterContext.tokenAContractAddress) {
      throw new UniswapError(
        "Must have a `tokenAContractAddress` on the context",
        ErrorCodes.tokenAContractAddressRequired
      );
    }

    if (!isAddress(this._uniswapQuoterContext.tokenAContractAddress)) {
      throw new UniswapError(
        "`tokenAContractAddress` is not a valid contract address",
        ErrorCodes.tokenAContractAddressNotValid
      );
    }

    this._uniswapQuoterContext.tokenAContractAddress = getAddress(
      this._uniswapQuoterContext.tokenAContractAddress,
      true
    );

    if (!this._uniswapQuoterContext.tokenBContractAddress) {
      throw new UniswapError(
        "Must have a `tokenBContractAddress` on the context",
        ErrorCodes.tokenBContractAddressRequired
      );
    }

    if (!isAddress(this._uniswapQuoterContext.tokenBContractAddress)) {
      throw new UniswapError(
        "`tokenBContractAddress` is not a valid contract address",
        ErrorCodes.tokenBContractAddressNotValid
      );
    }

    this._uniswapQuoterContext.tokenBContractAddress = getAddress(
      this._uniswapQuoterContext.tokenBContractAddress,
      true
    );

    if (!this._uniswapQuoterContext.ethereumAddress) {
      throw new UniswapError(
        "Must have a `ethereumAddress` on the context",
        ErrorCodes.ethereumAddressRequired
      );
    }

    if (!isAddress(this._uniswapQuoterContext.ethereumAddress)) {
      throw new UniswapError(
        "`ethereumAddress` is not a valid address",
        ErrorCodes.ethereumAddressNotValid
      );
    }

    this._uniswapQuoterContext.ethereumAddress = getAddress(
      this._uniswapQuoterContext.ethereumAddress
    );

    const chainId = (<UniswapQuoterContextForChainId>this._uniswapQuoterContext)
      .chainId;

    const providerUrl = (<UniswapQuoterContextForProviderUrl>(
      this._uniswapQuoterContext
    )).providerUrl;

    if (providerUrl && chainId) {
      this._ethersProvider = new EthersProvider({
        chainId,
        providerUrl,
        customNetwork: this._uniswapQuoterContext.settings?.customNetwork,
      });
      return;
    }

    if (chainId) {
      this._ethersProvider = new EthersProvider({ chainId });
      return;
    }

    const ethereumProvider = (<UniswapQuoterContextForEthereumProvider>(
      this._uniswapQuoterContext
    )).ethereumProvider;

    if (ethereumProvider) {
      this._ethersProvider = new EthersProvider({
        ethereumProvider,
        customNetwork: this._uniswapQuoterContext.settings?.customNetwork,
      });
      return;
    }

    throw new UniswapError(
      "Your must supply a chainId or a ethereum provider please look at types `UniswapQuoterContextForEthereumProvider`, `UniswapQuoterContextForChainId` and `UniswapQuoterContextForProviderUrl` to make sure your object is correct in what your passing in",
      ErrorCodes.invalidPairContext
    );
  }

  /**
   * Create factory to be able to call methods on the 2 tokens
   */
  public async createFactory(): Promise<UniswapQuoterFactory> {
    if (this._uniswapQuoterContext.settings?.customNetwork === undefined) {
      const chainId = this._ethersProvider.network().chainId;
      if (
        chainId !== ChainId.MAINNET &&
        chainId !== ChainId.ROPSTEN &&
        chainId !== ChainId.RINKEBY &&
        chainId !== ChainId.GÖRLI &&
        chainId !== ChainId.KOVAN
      ) {
        throw new UniswapError(
          `ChainId - ${chainId} is not supported. This lib only supports mainnet(1), ropsten(4), kovan(42), rinkeby(4), and görli(5)`,
          ErrorCodes.chainIdNotSupported
        );
      }
    }

    const tokensFactory = new TokensFactory(
      this._ethersProvider,
      this._uniswapQuoterContext.settings?.customNetwork
    );
    const tokens = await tokensFactory.getTokens([
      this._uniswapQuoterContext.tokenAContractAddress,
      this._uniswapQuoterContext.tokenBContractAddress,
    ]);

    const uniswapFactoryContext: UniswapQuoterFactoryContext = {
      tokenA: tokens.find(
        (t) =>
          t.contractAddress.toLowerCase() ===
          this._uniswapQuoterContext.tokenAContractAddress.toLowerCase()
      )!,
      tokenB: tokens.find(
        (t) =>
          t.contractAddress.toLowerCase() ===
          this._uniswapQuoterContext.tokenBContractAddress.toLowerCase()
      )!,
      ethereumAddress: this._uniswapQuoterContext.ethereumAddress,
      settings:
        this._uniswapQuoterContext.settings || new UniswapPairSettings(),
      ethersProvider: this._ethersProvider,
    };

    return new UniswapQuoterFactory(new CoinGecko(), uniswapFactoryContext);
  }
}
