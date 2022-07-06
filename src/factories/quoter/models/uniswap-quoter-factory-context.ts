import { EthersProvider } from "../../../ethers-provider";
import { Token } from "../../token/models/token";
import { UniswapPairSettings } from "../../pair/models/uniswap-pair-settings";

export interface UniswapQuoterFactoryContext {
  tokenA: Token;
  tokenB: Token;
  ethereumAddress: string;
  settings: UniswapPairSettings;
  ethersProvider: EthersProvider;
}
