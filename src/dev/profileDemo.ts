import { t } from '../core/text/strings';
import { appConfig } from '../appConfig';
import { bundledPieceSources } from '../game/content';
import { PieceCatalogue } from '../game/pieceCatalogue';
import { createProfileService } from '../profileSetup';

/** Dev-only page (`?demo=profile`): see the active player's progress and export or import it as JSON (a backup, or a move to another device). */
export async function startProfileDemo(): Promise<void> {
  document.body.style.cssText = 'margin:0;background:#1b1b2f;color:#eee;font:14px monospace;padding:16px';
  const { service, persistent } = await createProfileService(new PieceCatalogue({
    ...bundledPieceSources(), ownPieces: () => [], showDrafts: appConfig.flags.showDraftContent,
  }));

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] => Object.assign(document.createElement(tag), { textContent: text });
  const summary = el('pre');
  const box = Object.assign(el('textarea'), { rows: 14, cols: 90 });
  box.style.cssText = 'display:block;margin:8px 0;background:#11111f;color:#eee;font:12px monospace';
  const message = el('p');
  const exportButton = el('button', 'Export this player');
  const importNew = el('button', 'Import as a new player');
  const importReplace = el('button', 'Import and replace the player with the same id');

  const refresh = () => {
    const p = service.progress;
    summary.textContent = [
      `Player: ${service.profile.name}  (id ${service.profile.id})`,
      `${t('menu.level', { level: p.level.level })}, ${p.totalXp} XP, ${service.profile.attempts.length} attempt(s)`,
      `Players on this device: ${service.profiles.map((x) => x.name).join(', ')}`,
      persistent ? 'Saved in this browser (localStorage).' : t('menu.noSave'),
    ].join('\n');
  };

  // A click handler cannot return a promise to anyone, so each one shows its own failure instead of dropping it.
  // `.then(ok).catch(failed)`, not `.then(ok, failed)`: the two-argument form misses an error thrown inside `ok`.
  const failed = (e: unknown) => {
    message.textContent = `Failed: ${e instanceof Error ? e.message : String(e)}`;
  };
  exportButton.addEventListener('click', () => {
    service.exportActive().then((text) => {
      box.value = text;
      message.textContent = 'Exported. Copy the text and keep it somewhere safe.';
    }).catch(failed);
  });
  const doImport = (mode: 'new' | 'replace') => () => {
    service.importPlayer(box.value, mode).then((result) => {
      message.textContent = result.ok ? 'Imported. This player is now active.' : `Could not import: ${result.errors.join('; ')}`;
      refresh();
    }).catch(failed);
  };
  importNew.addEventListener('click', doImport('new'));
  importReplace.addEventListener('click', doImport('replace'));

  document.body.replaceChildren(el('h2', 'Player progress (dev)'), summary, exportButton, ' ', importNew, ' ', importReplace, box, message);
  refresh();
}
