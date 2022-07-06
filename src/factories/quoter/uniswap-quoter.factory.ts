import BigNumber from "bignumber.js";
import {
  CallReturnContext,
  ContractCallContext,
  ContractCallResults,
} from "ethereum-multicall";
import { Subject } from "rxjs";
import { CoinGecko } from "../../coin-gecko";
import { UniswapError } from "../../common/errors/uniswap-error";
import { removeEthFromContractAddress } from "../../common/tokens/eth";
import { hexlify } from "../../common/utils/hexlify";
import { CustomMulticall } from "../../custom-multicall";
import { UniswapVersion } from "../../enums/uniswap-version";
import { uniswapContracts } from "../../uniswap-contract-context/get-uniswap-contracts";
import { UniswapContractContextV2 } from "../../uniswap-contract-context/uniswap-contract-context-v2";
import { UniswapContractContextV3 } from "../../uniswap-contract-context/uniswap-contract-context-v3";
import { TradeContext } from "../pair/models/trade-context";
import { AllPossibleRoutes } from "../router/models/all-possible-routes";
import { RouteContext } from "../router/models/route-context";
import { UniswapRouterFactory } from "../router/uniswap-router.factory";
import { percentToFeeAmount } from "../router/v3/enums/fee-amount-v3";
import { Token } from "../token/models/token";
import { BidAskQuote } from "./models/bid-ask-quote";
import { UniswapQuoterFactoryContext } from "./models/uniswap-quoter-factory-context";

export class UniswapQuoterFactory {
  private _uniswapRouterFactoryAtoB = new UniswapRouterFactory(
    this._coinGecko,
    this._uniswapQuoterFactoryContext.ethereumAddress,
    this._uniswapQuoterFactoryContext.tokenA,
    this._uniswapQuoterFactoryContext.tokenB,
    this._uniswapQuoterFactoryContext.settings,
    this._uniswapQuoterFactoryContext.ethersProvider
  );

  private _uniswapRouterFactoryBtoA = new UniswapRouterFactory(
    this._coinGecko,
    this._uniswapQuoterFactoryContext.ethereumAddress,
    this._uniswapQuoterFactoryContext.tokenB,
    this._uniswapQuoterFactoryContext.tokenA,
    this._uniswapQuoterFactoryContext.settings,
    this._uniswapQuoterFactoryContext.ethersProvider
  );

  private _multicall = new CustomMulticall(
    this._uniswapQuoterFactoryContext.ethersProvider.provider,
    this._uniswapQuoterFactoryContext.settings?.customNetwork?.multicallContractAddress
  );

  private _watchingBlocks = false;
  private _quoteChanged$: Subject<TradeContext> = new Subject<TradeContext>();
  private _allPossibleAtoBRoutes: AllPossibleRoutes | null = null;
  private _allPossibleBtoARoutes: AllPossibleRoutes | null = null;

  constructor(
    private _coinGecko: CoinGecko,
    private _uniswapQuoterFactoryContext: UniswapQuoterFactoryContext
  ) {}

  /**
   * TokenA
   */
  public get tokenA(): Token {
    return this._uniswapQuoterFactoryContext.tokenA;
  }

  /**
   * TokenB
   */
  public get tokenB(): Token {
    return this._uniswapQuoterFactoryContext.tokenB;
  }

  /**
   * Get the provider url
   */
  public get providerUrl(): string | undefined {
    return this._uniswapQuoterFactoryContext.ethersProvider.getProviderUrl();
  }

  /**
   * Destroy the trade instance watchers + subscriptions
   */
  private destroy(): void {
    for (let i = 0; i < this._quoteChanged$.observers.length; i++) {
      this._quoteChanged$.observers[i].complete();
    }
    this.unwatchTradePrice();
  }

  /**
   * Get the best bid and ask quotes
   * @param amounts The amounts to trade
   */
  public async getBestBidAskQuotes(amounts: string[]): Promise<BidAskQuote[]> {
    this.destroy();
    const bestBidAskQuotes = await this.getAllPossibleBidAskRoutesWithQuotes(
      amounts.map((amt) => new BigNumber(amt))
    );

    this.watchTradePrice();
    return bestBidAskQuotes;
  }

  /**
   * Get all possible bid and ask routes with the quotes
   * @param amountToTrade The amounts to trade
   */
  private async getAllPossibleBidAskRoutesWithQuotes(
    amountsToTrade: BigNumber[]
  ): Promise<BidAskQuote[]> {
    const contractCallContext: ContractCallContext<RouteContext[]>[] = [];
    const routesAtoB = await this.getAllPossibleAtoBRoutes();
    const routesBtoA = await this.getAllPossibleBtoARoutes();

    for (const amountToTrade of amountsToTrade) {
      const tradeAmount = this.formatAmountToTrade(amountToTrade, this.tokenA);

      // Use both directions (one for ask, one for bid)
      if (
        this._uniswapQuoterFactoryContext.settings.uniswapVersions.includes(
          UniswapVersion.v2
        )
      ) {
        contractCallContext.push({
          reference: UniswapVersion.v2,
          contractAddress: uniswapContracts.v2.getRouterAddress(
            this._uniswapQuoterFactoryContext.settings
              .cloneUniswapContractDetails
          ),
          abi: UniswapContractContextV2.routerAbi,
          calls: [],
        });

        for (let i = 0; i < routesAtoB.v2.length; i++) {
          const routeCombo = routesAtoB.v2[i].route.map((c) => {
            return removeEthFromContractAddress(c.contractAddress);
          });

          contractCallContext[0].calls.push({
            reference: `route${i}-${amountToTrade.toString()}-bid`,
            methodName: "getAmountsOut",
            methodParameters: [tradeAmount, routeCombo],
          });
        }

        for (let i = 0; i < routesBtoA.v2.length; i++) {
          const routeCombo = routesBtoA.v2[i].route.map((c) => {
            return removeEthFromContractAddress(c.contractAddress);
          });

          contractCallContext[0].calls.push({
            reference: `route${i}-${amountToTrade.toString()}-ask`,
            methodName: "getAmountsIn",
            methodParameters: [tradeAmount, routeCombo],
          });
        }
      }

      if (
        this._uniswapQuoterFactoryContext.settings.uniswapVersions.includes(
          UniswapVersion.v3
        )
      ) {
        contractCallContext.push({
          reference: UniswapVersion.v3,
          contractAddress: uniswapContracts.v3.getQuoterAddress(
            this._uniswapQuoterFactoryContext.settings
              .cloneUniswapContractDetails
          ),
          abi: UniswapContractContextV3.quoterAbi,
          calls: [],
        });

        for (let i = 0; i < routesAtoB.v3.length; i++) {
          const routeCombo = routesAtoB.v3[i].route.map((c) => {
            return removeEthFromContractAddress(c.contractAddress);
          });

          const index =
            this._uniswapQuoterFactoryContext.settings.uniswapVersions.includes(
              UniswapVersion.v2
            )
              ? 1
              : 0;

          contractCallContext[index].calls.push({
            reference: `route${i}-${amountToTrade.toString()}-bid`,
            methodName: "quoteExactInputSingle",
            methodParameters: [
              routeCombo[0],
              routeCombo[1],
              percentToFeeAmount(routesAtoB.v3[i].liquidityProviderFee),
              tradeAmount,
              0,
            ],
          });
        }

        for (let i = 0; i < routesBtoA.v3.length; i++) {
          const routeCombo = routesBtoA.v3[i].route.map((c) => {
            return removeEthFromContractAddress(c.contractAddress);
          });

          const index =
            this._uniswapQuoterFactoryContext.settings.uniswapVersions.includes(
              UniswapVersion.v2
            )
              ? 1
              : 0;

          contractCallContext[index].calls.push({
            reference: `route${i}-${amountToTrade.toString()}-ask`,
            methodName: "quoteExactOutputSingle",
            methodParameters: [
              routeCombo[1],
              routeCombo[0],
              percentToFeeAmount(routesBtoA.v3[i].liquidityProviderFee),
              tradeAmount,
              0,
            ],
          });
        }
      }
    }

    const contractCallResults = await this._multicall.call(contractCallContext);
    return this.buildBestBidAskQuotesFromResults(contractCallResults);
  }

  private async getAllPossibleAtoBRoutes(): Promise<AllPossibleRoutes> {
    if (this._allPossibleAtoBRoutes != null) {
      return this._allPossibleAtoBRoutes;
    }

    this._allPossibleAtoBRoutes = await this._routesAtoB.getAllPossibleRoutes();
    return this._allPossibleAtoBRoutes;
  }

  private async getAllPossibleBtoARoutes(): Promise<AllPossibleRoutes> {
    if (this._allPossibleBtoARoutes != null) {
      return this._allPossibleBtoARoutes;
    }

    this._allPossibleBtoARoutes = await this._routesBtoA.getAllPossibleRoutes();
    return this._allPossibleBtoARoutes;
  }

  /**
   * Format amount to trade into callable formats
   * @param amountToTrade The amount to trade
   * @param direction The direction you want to get the quote from
   */
  private formatAmountToTrade(amountToTrade: BigNumber, token: Token): string {
    return hexlify(amountToTrade.shiftedBy(token.decimals));
  }

  private buildBestBidAskQuotesFromResults(
    contractCallResults: ContractCallResults
  ): BidAskQuote[] {
    const bestResults: Record<string, BidAskQuote> = {};

    for (const key in contractCallResults.results) {
      const contractCallReturnContext = contractCallResults.results[key];
      if (contractCallReturnContext) {
        for (
          let i = 0;
          i < contractCallReturnContext.callsReturnContext.length;
          i++
        ) {
          const callReturnContext =
            contractCallReturnContext.callsReturnContext[i];

          if (!callReturnContext.success) {
            continue;
          }

          const bidAskQuote = this.buildBestRouteQuote(
            callReturnContext,
            contractCallReturnContext.originalContractCallContext
              .reference as UniswapVersion
          );

          const amountStr = bidAskQuote.amount.toString();
          if (amountStr in bestResults) {
            // Check if bid
            if (
              bestResults[amountStr].bidPrice == null ||
              (bidAskQuote.bidPrice != null &&
                bidAskQuote.bidPrice > bestResults[amountStr].bidPrice)
            ) {
              bestResults[amountStr].bidPrice = bidAskQuote.bidPrice;
            }

            // Check if ask
            if (
              bestResults[amountStr].askPrice == null ||
              (bidAskQuote.askPrice != null &&
                bidAskQuote.askPrice < bestResults[amountStr].askPrice)
            ) {
              bestResults[amountStr].askPrice = bidAskQuote.askPrice;
            }
          } else {
            bestResults[amountStr] = bidAskQuote;
          }
        }
      }
    }

    return Object.values(bestResults);
  }

  private buildBestRouteQuote(
    callReturnContext: CallReturnContext,
    uniswapVersion: UniswapVersion
  ): BidAskQuote {
    const convertQuoteUnformatted = this.getConvertQuoteUnformatted(
      callReturnContext,
      uniswapVersion
    );
    const [_, amount, bidAsk] = callReturnContext.reference.split("-");
    const expectedConvertQuote = +convertQuoteUnformatted
      .shiftedBy(this.tokenB.decimals * -1)
      .toFixed(this.tokenB.decimals);

    const amountNum = +amount;
    const ret = {
      amount: amountNum,
    } as BidAskQuote;
    if (bidAsk == "ask") {
      ret.askPrice = expectedConvertQuote / amountNum;
    } else {
      ret.bidPrice = expectedConvertQuote / amountNum;
    }

    return ret;
  }

  /**
   * Get the convert quote unformatted from the call return context
   * @param callReturnContext The call return context
   * @param uniswapVersion The uniswap version
   */
  private getConvertQuoteUnformatted(
    callReturnContext: CallReturnContext,
    uniswapVersion: UniswapVersion
  ): BigNumber {
    const methodName = callReturnContext.methodName;
    switch (uniswapVersion) {
      case UniswapVersion.v2:
        if (methodName == "getAmountsIn") {
          return new BigNumber(callReturnContext.returnValues[0].hex);
        } else if (methodName == "getAmountsOut") {
          return new BigNumber(
            callReturnContext.returnValues[
              callReturnContext.returnValues.length - 1
            ].hex
          );
        }
      case UniswapVersion.v3:
        return new BigNumber(callReturnContext.returnValues[0].hex);
      default:
        throw new UniswapError("Invalid uniswap version", uniswapVersion);
    }
  }

  /**
   * Route getter
   */
  private get _routesAtoB(): UniswapRouterFactory {
    return this._uniswapRouterFactoryAtoB;
  }

  private get _routesBtoA(): UniswapRouterFactory {
    return this._uniswapRouterFactoryBtoA;
  }

  /**
   * Watch trade price move automatically emitting the stream if it changes
   */
  private watchTradePrice(): void {
    if (!this._watchingBlocks) {
      this._uniswapQuoterFactoryContext.ethersProvider.provider.on(
        "block",
        async () => {
          await this.handleNewBlock();
        }
      );
      this._watchingBlocks = true;
    }
  }

  /**
   * unwatch any block streams
   */
  private unwatchTradePrice(): void {
    this._uniswapQuoterFactoryContext.ethersProvider.provider.removeAllListeners(
      "block"
    );
    this._watchingBlocks = false;
  }

  /**
   * Handle new block for the trade price moving automatically emitting the stream if it changes
   */
  private async handleNewBlock(): Promise<void> {
    // if (this._quoteChanged$.observers.length > 0 && this._currentTradeContext) {
    //   const trade = await this.executeTradePath(
    //     new BigNumber(this._currentTradeContext.baseConvertRequest),
    //     this._currentTradeContext.quoteDirection
    //   );
    //   if (
    //     trade.fromToken.contractAddress ===
    //       this._currentTradeContext.fromToken.contractAddress &&
    //     trade.toToken.contractAddress ===
    //       this._currentTradeContext.toToken.contractAddress &&
    //     trade.transaction.from ===
    //       this._uniswapPairFactoryContext.ethereumAddress
    //   ) {
    //     if (
    //       trade.expectedConvertQuote !==
    //         this._currentTradeContext.expectedConvertQuote ||
    //       trade.routeText !== this._currentTradeContext.routeText ||
    //       trade.liquidityProviderFee !==
    //         this._currentTradeContext.liquidityProviderFee ||
    //       this._currentTradeContext.tradeExpires >
    //         this._uniswapRouterFactory.generateTradeDeadlineUnixTime()
    //     ) {
    //       this._currentTradeContext = this.buildCurrentTradeContext(trade);
    //       this._quoteChanged$.next(trade);
    //     }
    //   }
    // }
  }
}
