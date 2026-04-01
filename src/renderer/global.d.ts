import type { TGridApi } from '../shared/types';

declare global {
  interface Window {
    tgrid: TGridApi;
  }
}
