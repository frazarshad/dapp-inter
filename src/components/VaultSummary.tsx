import { useMemo } from 'react';
import { useVaultStore } from 'store/vaults';
import { DisplayFunctions } from 'store/app';
import { calculateCurrentDebt } from '@agoric/inter-protocol/src/interest-math';
import {
  ceilMultiplyBy,
  makeRatioFromAmounts,
} from '@agoric/zoe/src/contractSupport';
import clsx from 'clsx';
import { AmountMath } from '@agoric/ertp';

export const SkeletonVaultSummary = () => (
  <div className="shadow-[0_28px_40px_rgba(116,116,116,0.25)] rounded-xl bg-white w-[580px]">
    <div className="flex justify-between mt-14 mx-8 mb-10 items-center">
      <div className="flex items-end gap-4">
        <div className="h-20 w-20 bg-gray-200 rounded-full transition animate-pulse" />
        <div className="flex flex-col gap-2 justify-end">
          <div className="h-[38px] w-32 bg-gray-200 rounded transition animate-pulse" />
          <div className="text-[#A3A5B9] h-3 w-6 bg-gray-200 rounded transition animate-pulse" />
        </div>
      </div>
      <div className="h-[38px] w-52 bg-gray-200 rounded transition animate-pulse" />
    </div>
    <div className="bg-[#F0F0F0] h-[1px] w-full" />
    <div className="mx-11 mt-5 mb-5">
      <div className="w-full rounded bg-gray-200 h-4 my-4 transition animate-pulse" />
      <div className="w-full rounded bg-gray-200 h-4 my-4 transition animate-pulse" />
      <div className="w-full rounded bg-gray-200 h-4 my-4 transition animate-pulse" />
    </div>
    <div className="flex justify-around gap-3 mx-[30px] mb-[30px]">
      <div className="h-[72px] flex-auto bg-gray-200 rounded-lg transition animate-pulse" />
      <div className="h-[72px] flex-auto bg-gray-200 rounded-lg transition animate-pulse" />
      <div className="h-[72px] flex-auto bg-gray-200 rounded-lg transition animate-pulse" />
    </div>
  </div>
);

const bigTextClasses = 'text-[32px] leading-[38px] font-semibold';

const subpanelClasses =
  'px-5 py-3 flex-auto bg-white flex flex-col content-between gap-1 text-center rounded-lg border-solid border-2 shadow-[0_10px_12px_-6px_#F0F0F0] text-sm';

type TableRowProps = {
  left: string;
  right: string;
  light?: boolean;
};

const TableRow = ({ left, right, light = false }: TableRowProps) => (
  <tr className={clsx('leading-7', light && 'text-[#A3A5B9]')}>
    <td className="text-left">{left}</td>
    <td className="text-right font-black">{right}</td>
  </tr>
);

type Props = {
  vaultKey: string;
  displayFunctions: DisplayFunctions;
};

const VaultSummary = ({ vaultKey, displayFunctions }: Props) => {
  const {
    vaults,
    errors,
    prices,
    priceErrors,
    vaultMetrics,
    vaultGovernedParams,
    vaultManagerLoadingErrors,
    managers,
  } = useVaultStore(state => ({
    vaults: state.vaults,
    vaultMetrics: state.vaultMetrics,
    vaultGovernedParams: state.vaultGovernedParams,
    errors: state.vaultErrors,
    prices: state.prices,
    priceErrors: state.priceErrors,
    vaultManagerLoadingErrors: state.vaultManagerLoadingErrors,
    managers: state.vaultManagers,
  }));

  const vault = vaults?.get(vaultKey);
  assert(vault, `Cannot render summary for nonexistent vault ${vaultKey}`);

  const metrics = vaultMetrics?.get(vault?.managerId ?? '');
  const params = vaultGovernedParams?.get(vault?.managerId ?? '');
  const brand = metrics?.totalCollateral?.brand;
  const price = brand && prices.get(brand);
  const manager = managers.get(vault?.managerId ?? '');
  const error =
    errors.get(vaultKey) ||
    (brand && priceErrors.get(brand)) ||
    vaultManagerLoadingErrors.get(vault?.managerId ?? '');

  return useMemo(() => {
    const {
      displayBrandPetname,
      displayBrandIcon,
      displayPrice,
      displayPriceTimestamp,
      displayAmount,
      displayPercent,
    } = displayFunctions;

    if (error) {
      return (
        <div className="text-lg text-red-500 p-8 shadow-[0_28px_40px_rgba(116,116,116,0.25)] rounded-xl bg-white w-[580px]">
          <p>Error: {error.toString()}</p>
        </div>
      );
    }

    if (vault.isLoading || !price || !metrics || !params || !manager) {
      return <SkeletonVaultSummary />;
    }

    const { locked, debtSnapshot } = vault;
    assert(locked && debtSnapshot, 'Vault must be loading still');

    const brandIcon = displayBrandIcon(locked.brand);
    const brandPetname = displayBrandPetname(locked.brand);

    const totalDebt = calculateCurrentDebt(
      debtSnapshot.debt,
      debtSnapshot.interest,
      manager.compoundedInterest,
    );

    const totalLockedValue = ceilMultiplyBy(
      locked,
      makeRatioFromAmounts(price.amountOut, price.amountIn),
    );

    const maximumLockedValueForLiquidation = ceilMultiplyBy(
      totalDebt,
      params.liquidationMargin,
    );

    const maximumLockedPriceForLiquidation = {
      amountIn: locked,
      amountOut: maximumLockedValueForLiquidation,
    };

    let netValueSignum;
    let netVaultValue;
    if (AmountMath.isGTE(totalLockedValue, totalDebt)) {
      netVaultValue = AmountMath.subtract(totalLockedValue, totalDebt);
    } else {
      netVaultValue = AmountMath.subtract(totalDebt, totalLockedValue);
      netValueSignum = '-';
    }

    // TODO: Update dynamically.
    const collateralLabel = 'ATOM';

    // TODO: Calculate and display total debt correctly.
    return (
      <div className="cursor-pointer shadow-[0_28px_40px_rgba(116,116,116,0.25)] rounded-xl bg-white w-[580px] transition hover:scale-105">
        <div className="flex justify-between mt-14 mx-8 mb-10 items-center flex-wrap">
          <div className="flex items-end gap-4">
            <img
              height="80"
              width="80"
              alt={brandPetname}
              src={brandIcon}
            ></img>
            <div className="flex flex-col justify-end">
              <div className={bigTextClasses}>{collateralLabel}</div>
              <div className="text-[#A3A5B9] text-sm">
                #{vault.indexWithinManager}
              </div>
            </div>
          </div>
          <div className={bigTextClasses}>
            {netValueSignum}${displayAmount(netVaultValue, 2)} USD
          </div>
        </div>
        <div className="bg-[#F0F0F0] h-[1px] w-full" />
        <div className="mx-11 mt-3 mb-5">
          <table className="w-full">
            <tbody>
              <TableRow
                left="Current Collateral Price"
                right={displayPrice(price)}
                light={true}
              />
              <TableRow
                left="Last Collateral Price Update"
                right={displayPriceTimestamp(price)}
                light={true}
              />
              <TableRow
                left="Liquidation Price"
                right={displayPrice(maximumLockedPriceForLiquidation)}
              />
            </tbody>
          </table>
        </div>
        <div className="flex justify-around gap-3 mx-[30px] mb-[30px]">
          <div className={subpanelClasses}>
            <span className="text-[#A3A5B9]">Int. Rate</span>
            <span className="font-extrabold">
              {displayPercent(params.interestRate, 2)}%
            </span>
          </div>
          <div className={subpanelClasses}>
            <span className="text-[#A3A5B9]">Debt</span>
            <span className="font-extrabold">
              {displayAmount(totalDebt, 2)}{' '}
              {displayBrandPetname(totalDebt.brand)}
            </span>
          </div>
          <div className={subpanelClasses}>
            <span className="text-[#A3A5B9]">Collat. Locked ($ value)</span>
            <span className="font-extrabold text-[#00B1A6]">
              ${displayAmount(totalLockedValue, 2)} USD
            </span>
          </div>
        </div>
      </div>
    );
  }, [displayFunctions, error, vault, price, metrics, params, manager]);
};

export default VaultSummary;
