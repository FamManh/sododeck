import type { ReactNode } from 'react';

import { DeckServicesContext } from '../editor/deck-services';
import { useWebDeckServices } from '../routes/web-deck-services';

/** Gives a component under test the web app's library services (needs a router, or a mocked `useNavigate`). */
export function WebDeckServicesProvider({ children }: { children: ReactNode }) {
  return <DeckServicesContext value={useWebDeckServices()}>{children}</DeckServicesContext>;
}
