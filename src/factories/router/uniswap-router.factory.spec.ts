import BigNumber from 'bignumber.js';
import { ChainId, ErrorCodes, UniswapError, WETH } from '../..';
import { UniswapVersion } from '../../enums/uniswap-version';
import { EthersProvider } from '../../ethers-provider';
import { MOCKAAVE } from '../../mocks/aave-token.mock';
import { MOCKFUN } from '../../mocks/fun-token.mock';
import { MOCKREP } from '../../mocks/rep-token.mock';
import { MOCKUNI } from '../../mocks/uni-token.mock';
import { UniswapRouterFactory } from './uniswap-router.factory';

describe('UniswapRouterFactory', () => {
  const ethersProvider = new EthersProvider(ChainId.MAINNET);

  describe('erc20 > erc20', () => {
    const fromToken = MOCKAAVE();
    const toToken = MOCKUNI();

    const uniswapRouterFactory = new UniswapRouterFactory(
      fromToken,
      toToken,
      false,
      [UniswapVersion.v2, UniswapVersion.v3],
      ethersProvider
    );

    describe('getAllPossibleRoutes', () => {
      describe('v2', () => {
        it('should get all possible routes', async () => {
          const result = await uniswapRouterFactory.getAllPossibleRoutes();
          expect(result.v2.length > 0).toEqual(true);
          expect(
            result.v2.filter((c) => c.route.length > 2).length > 0
          ).toEqual(true);
        });

        it('should only return direct routes (in this case return nothing as there is no direct route)', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            true,
            [UniswapVersion.v2, UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.getAllPossibleRoutes();
          expect(
            result.v2.filter((c) => c.route.length > 2).length === 0
          ).toEqual(true);
        });
      });

      describe('v3', () => {
        it('should get all possible routes', async () => {
          const result = await uniswapRouterFactory.getAllPossibleRoutes();
          expect(result.v3.length > 0).toEqual(true);
        });

        it('should only return direct routes (in this case return nothing as there is no direct route)', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            true,
            [UniswapVersion.v2, UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.getAllPossibleRoutes();
          expect(
            result.v3.filter((c) => c.route.length > 2).length === 0
          ).toEqual(true);
        });
      });
    });

    describe('getAllPossibleRoutesWithQuotes', () => {
      it('should get all possible routes with quote', async () => {
        const result =
          await uniswapRouterFactory.getAllPossibleRoutesWithQuotes(
            new BigNumber(1)
          );
        expect(result.length > 0).toEqual(true);
      });

      it('should only return direct routes (in this case return nothing as there is no direct route)', async () => {
        const factory = new UniswapRouterFactory(
          fromToken,
          toToken,
          true,
          [UniswapVersion.v2, UniswapVersion.v3],
          ethersProvider
        );

        const result = await factory.getAllPossibleRoutesWithQuotes(
          new BigNumber(1)
        );
        expect(
          result.filter((c) => c.routePathArray.length > 2).length === 0
        ).toEqual(true);
      });
    });

    describe('findBestRoute', () => {
      describe('v2', () => {
        it('should find best route', async () => {
          const factory = new UniswapRouterFactory(
            MOCKFUN(),
            MOCKREP(),
            false,
            [UniswapVersion.v2],
            ethersProvider
          );

          const result = await factory.findBestRoute(new BigNumber(10000));
          expect(result.bestRouteQuote.routeText).toEqual('FUN > WETH > REP');
        });
      });

      describe('v3', () => {
        it('should find best route', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            false,
            [UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.findBestRoute(new BigNumber(100));
          expect(result.bestRouteQuote.routeText).toEqual('AAVE > UNI');
        });
      });

      it('should find best route', async () => {
        const result = await uniswapRouterFactory.findBestRoute(
          new BigNumber(100)
        );
        expect(result.bestRouteQuote.routeText).toEqual('AAVE > UNI');
      });

      it('should throw an error as there is no best route with disableMultihops turned on', async () => {
        const factory = new UniswapRouterFactory(
          MOCKFUN(),
          MOCKREP(),
          true,
          [UniswapVersion.v2],
          ethersProvider
        );

        await expect(
          factory.findBestRoute(new BigNumber(100))
        ).rejects.toThrowError(
          new UniswapError(
            `No routes found for ${MOCKFUN().contractAddress} > ${
              MOCKREP().contractAddress
            }`,
            ErrorCodes.noRoutesFound
          )
        );
      });
    });
  });

  describe('erc20 > eth', () => {
    const fromToken = MOCKAAVE();
    const toToken = WETH.MAINNET();

    const uniswapRouterFactory = new UniswapRouterFactory(
      fromToken,
      toToken,
      false,
      [UniswapVersion.v2, UniswapVersion.v3],
      ethersProvider
    );

    describe('getAllPossibleRoutes', () => {
      describe('v2', () => {
        it('should get all possible routes', async () => {
          const result = await uniswapRouterFactory.getAllPossibleRoutes();
          expect(result.v2.length > 0).toEqual(true);
          expect(
            result.v2.filter((c) => c.route.length > 2).length > 0
          ).toEqual(true);
        });

        it('should only return direct routes', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            true,
            [UniswapVersion.v2],
            ethersProvider
          );

          const result = await factory.getAllPossibleRoutes();
          expect(result.v2.length === 1).toEqual(true);
          expect(result.v2[0].route[0]).toEqual(fromToken);
          expect(result.v2[0].route[1]).toEqual(toToken);
          expect(
            result.v2.filter((c) => c.route.length > 2).length > 0
          ).toEqual(false);
        });
      });

      describe('v3', () => {
        it('should get all possible routes', async () => {
          const result = await uniswapRouterFactory.getAllPossibleRoutes();
          expect(result.v3.length > 0).toEqual(true);
        });

        it('should only return direct routes', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            true,
            [UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.getAllPossibleRoutes();
          expect(result.v3[0].route[0]).toEqual(fromToken);
          expect(result.v3[0].route[1]).toEqual(toToken);
          expect(
            result.v3.filter((c) => c.route.length > 2).length > 0
          ).toEqual(false);
        });
      });
    });

    describe('getAllPossibleRoutesWithQuotes', () => {
      it('should get all possible routes with quote', async () => {
        const result =
          await uniswapRouterFactory.getAllPossibleRoutesWithQuotes(
            new BigNumber(1)
          );
        expect(result.length > 0).toEqual(true);
      });

      it('should only return direct routes', async () => {
        const factory = new UniswapRouterFactory(
          fromToken,
          toToken,
          true,
          [UniswapVersion.v2, UniswapVersion.v3],
          ethersProvider
        );

        const result = await factory.getAllPossibleRoutesWithQuotes(
          new BigNumber(1)
        );
        expect(
          result.filter((c) => c.routePathArray.length > 2).length > 0
        ).toEqual(false);
      });
    });

    describe('findBestRoute', () => {
      describe('v2', () => {
        it('should find best route', async () => {
          const factory = new UniswapRouterFactory(
            MOCKFUN(),
            toToken,
            false,
            [UniswapVersion.v2],
            ethersProvider
          );

          const result = await factory.findBestRoute(new BigNumber(10000000));
          expect(result.bestRouteQuote.routeText).toEqual('FUN > WETH');
        });
      });

      describe('v2', () => {
        it('should find best route', async () => {
          const factory = new UniswapRouterFactory(
            MOCKAAVE(),
            toToken,
            false,
            [UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.findBestRoute(new BigNumber(100));
          expect(result.bestRouteQuote.routeText).toEqual('AAVE > WETH');
        });
      });

      it('should find best route', async () => {
        const result = await uniswapRouterFactory.findBestRoute(
          new BigNumber(100)
        );
        expect(result.bestRouteQuote.routeText).toEqual('AAVE > WETH');
      });

      it('should return best route', async () => {
        const factory = new UniswapRouterFactory(
          fromToken,
          toToken,
          true,
          [UniswapVersion.v2, UniswapVersion.v3],
          ethersProvider
        );

        const result = await factory.findBestRoute(new BigNumber(100));

        expect(result.bestRouteQuote.routeText).toEqual('AAVE > WETH');
        expect(
          result.triedRoutesQuote.filter((c) => c.routePathArray.length > 2)
            .length > 0
        ).toEqual(false);
      });
    });
  });

  describe('eth > erc20', () => {
    const fromToken = WETH.MAINNET();
    const toToken = MOCKAAVE();

    const uniswapRouterFactory = new UniswapRouterFactory(
      fromToken,
      toToken,
      false,
      [UniswapVersion.v2, UniswapVersion.v3],
      ethersProvider
    );

    describe('getAllPossibleRoutes', () => {
      describe('v2', () => {
        it('should get all possible routes', async () => {
          const result = await uniswapRouterFactory.getAllPossibleRoutes();
          expect(result.v2.length > 0).toEqual(true);
          expect(
            result.v2.filter((c) => c.route.length > 2).length > 0
          ).toEqual(true);
        });

        it('should only return direct routes', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            true,
            [UniswapVersion.v2],
            ethersProvider
          );

          const result = await factory.getAllPossibleRoutes();
          expect(result.v2.length === 1).toEqual(true);
          expect(result.v2[0].route[0]).toEqual(fromToken);
          expect(result.v2[0].route[1]).toEqual(toToken);
          expect(
            result.v2.filter((c) => c.route.length > 2).length === 0
          ).toEqual(true);
        });
      });

      describe('v3', () => {
        it('should get all possible routes', async () => {
          const result = await uniswapRouterFactory.getAllPossibleRoutes();
          expect(result.v3.length > 0).toEqual(true);
        });

        it('should only return direct routes', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            true,
            [UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.getAllPossibleRoutes();
          expect(result.v3[0].route[0]).toEqual(fromToken);
          expect(result.v3[0].route[1]).toEqual(toToken);
          expect(
            result.v3.filter((c) => c.route.length > 2).length === 0
          ).toEqual(true);
        });
      });
    });

    describe('getAllPossibleRoutesWithQuotes', () => {
      it('should get all possible routes with quote', async () => {
        const result =
          await uniswapRouterFactory.getAllPossibleRoutesWithQuotes(
            new BigNumber(1)
          );
        expect(result.length > 0).toEqual(true);
      });

      it('should only return direct routes', async () => {
        const factory = new UniswapRouterFactory(
          fromToken,
          toToken,
          true,
          [UniswapVersion.v2, UniswapVersion.v3],
          ethersProvider
        );

        const result = await factory.getAllPossibleRoutesWithQuotes(
          new BigNumber(1)
        );
        expect(
          result.filter((c) => c.routePathArray.length > 2).length > 0
        ).toEqual(false);
      });
    });

    describe('findBestRoute', () => {
      describe('v2', () => {
        it('should find best route', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            MOCKFUN(),
            false,
            [UniswapVersion.v2],
            ethersProvider
          );

          const result = await factory.findBestRoute(new BigNumber(100));
          expect(result.bestRouteQuote.routeText).toEqual('WETH > FUN');
        });
      });

      describe('v3', () => {
        it('should find best route', async () => {
          const factory = new UniswapRouterFactory(
            fromToken,
            toToken,
            false,
            [UniswapVersion.v3],
            ethersProvider
          );

          const result = await factory.findBestRoute(new BigNumber(100));
          expect(result.bestRouteQuote.routeText).toEqual('WETH > AAVE');
        });
      });

      it('should find best route', async () => {
        const result = await uniswapRouterFactory.findBestRoute(
          new BigNumber(100)
        );
        expect(result.bestRouteQuote.routeText).toEqual('WETH > AAVE');
      });

      it('should return best route', async () => {
        const factory = new UniswapRouterFactory(
          fromToken,
          toToken,
          false,
          [UniswapVersion.v2, UniswapVersion.v3],
          ethersProvider
        );

        const result = await factory.findBestRoute(new BigNumber(100));

        expect(result.bestRouteQuote.routeText).toEqual('WETH > AAVE');
      });
    });
  });
});
