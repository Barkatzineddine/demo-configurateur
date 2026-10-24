import { useMemo } from 'react';
import { estimate } from '../domain/pricing';
import { useConfig } from '../state/config';

/** The current configuration, made buildable, laid out, cut and priced. */
export function useEstimate() {
  const requested = useConfig((s) => s.config);
  const e = useMemo(() => estimate(requested), [requested]);
  return { requested, e };
}
