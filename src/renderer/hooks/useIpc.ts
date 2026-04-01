import { useEffect } from 'react';
import type { PushChannel, IpcPushEvents } from '../../shared/types';

export function useIpcEvent<K extends PushChannel>(
  channel: K,
  handler: (payload: IpcPushEvents[K]) => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    const unsub = window.tgrid.on(channel, handler as (payload: unknown) => void);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, ...deps]);
}
