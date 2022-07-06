import { ChainId } from "../../../enums/chain-id";
import { UniswapPairSettings } from "../../pair/models/uniswap-pair-settings";

interface UniswapQuoterContextBase {
  tokenAContractAddress: string;
  tokenBContractAddress: string;
  ethereumAddress: string;
  settings?: UniswapPairSettings | undefined;
}

export interface UniswapQuoterContextForEthereumProvider
  extends UniswapQuoterContextBase {
  ethereumProvider: any;
}

export interface UniswapQuoterContextForChainId
  extends UniswapQuoterContextBase {
  chainId: ChainId | number;
}

export interface UniswapQuoterContextForProviderUrl
  extends UniswapQuoterContextForChainId {
  providerUrl: string;
}
