import { startApplication, showUnavailable } from './application.ts';
import { webKitTransport } from './transport.ts';
try { void startApplication(webKitTransport(window)).catch(showUnavailable); } catch(error) { showUnavailable(error); }
