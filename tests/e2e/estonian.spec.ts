import { expect, test } from '@playwright/test';
import { expectNoErrors, menuButton, menuLabels, openGame, sceneButton } from './helpers';

// ft_0_18: the students's game is in Estonian. The English game is covered by every other test, which opens with `?lang=en`.
test.describe('Estonian text (ft_0_18)', () => {
  test('ft_0_18.AC1 the menu opens in Estonian with no language switch @smoke', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', null);
    expect(await menuButton(page, 'Seaded')).toBeGreaterThanOrEqual(0); // the toolbar's settings gear, named in Estonian (d088)
    expect(await sceneButton(page, 'menu', '+ Uus lugu')).toBeGreaterThanOrEqual(0); // a staff-and-pencil picture whose label stays on the button; the one piece list (ft_1_12): no Harjutus / Mängi / Tee tabs
    expect(await menuLabels(page)).not.toContain('Harjutus');
    expectNoErrors(errors);
  });
});
