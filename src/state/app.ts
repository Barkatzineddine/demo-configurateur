// What the visitor keeps in this browser: saved designs and quote requests, validated on every load
// and shared live between tabs.
import { designSchema, requestSchema, stateSchema, type Config, type Design, type QuoteRequest, type State } from '../domain/schema';
import { clean, isEmail, isName, isPhoneFR, normPhone, randomId } from '../shared/security';
import { createPersistedStore } from '../shared/store';

export const STORE_KEY = 'lisiere:v1';
export const app = createPersistedStore<State>(STORE_KEY, stateSchema, () => ({ v: 1, designs: [], requests: [], seq: {} }));
export const useData = <T,>(selector: (s: State) => T): T => app.use((x) => selector(x.data));

const pad = (n: number) => String(n).padStart(2, '0');
export const localStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function saveDesign(name: string, config: Config, now = new Date()): Design | null {
  const design = { id: randomId('p'), name: clean(name, 60) || 'Projet', config, saved: localStamp(now) };
  if (!designSchema.safeParse(design).success) return null;
  app.update((s) => { s.designs = [design, ...s.designs].slice(0, 50); }, { type: 'design.saved', id: design.id });
  return design;
}

export function deleteDesign(id: string): void {
  app.update((s) => { s.designs = s.designs.filter((d) => d.id !== id); }, { type: 'design.deleted', id });
}

export interface RequestInput { name: string; email: string; phone: string; zip: string; message: string; consent: boolean }
export type RequestField = 'name' | 'email' | 'phone' | 'zip' | 'consent';

/** Field-level checks; the same rules a server would apply before storing the request. */
export function checkRequest(input: RequestInput): Partial<Record<RequestField, true>> {
  const errors: Partial<Record<RequestField, true>> = {};
  if (!isName(clean(input.name, 80))) errors.name = true;
  if (!isEmail(clean(input.email, 254))) errors.email = true;
  if (!isPhoneFR(clean(input.phone, 20))) errors.phone = true;
  if (!/^\d{5}$/.test(clean(input.zip, 5))) errors.zip = true;
  if (!input.consent) errors.consent = true;
  return errors;
}

export function sendRequest(input: RequestInput, config: Config, total: number, now = new Date()): QuoteRequest | null {
  if (Object.keys(checkRequest(input)).length) return null;
  const year = String(now.getFullYear());
  const n = (app.get().seq[year] ?? 0) + 1;
  const request = {
    id: randomId('r'), ref: `AL-${year}-${String(n).padStart(4, '0')}`, at: localStamp(now),
    name: clean(input.name, 80), email: clean(input.email, 254), phone: normPhone(clean(input.phone, 20)), zip: clean(input.zip, 5),
    message: clean(input.message, 1000, true), config, total,
  };
  if (!requestSchema.safeParse(request).success) return null;
  app.update((s) => { s.seq[year] = n; s.requests = [request, ...s.requests].slice(0, 200); }, { type: 'request.sent', id: request.id });
  return request;
}
