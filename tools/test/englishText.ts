import { setLanguage } from '../../src/core/text/language';

// Unit tests read the English catalog, as they did before the Estonian text (ft_0_18). A test of the Estonian text sets
// `setLanguage('et')` itself. The game's default is Estonian; the end-to-end tests open the page with `?lang=en`.
setLanguage('en');
