import { createContext } from 'react';

/** Set by the details drawer (018): inspectors inside it show "Close details" in their header. */
export const DrawerCloseContext = createContext<(() => void) | null>(null);
