import { AdventureScene } from './AdventureScene';
import { SCENE_LIVES } from './sceneLife';
import { SCENES } from './scenesData';

/** One `AdventureScene` for every scene in `content/scenes/`, each keyed by its id (ft_1_24.AC1); a scene without a picture life is an error. */
export function adventureScenes(): AdventureScene[] {
  return [...SCENES.values()].map((scene) => {
    const life = SCENE_LIVES[scene.picture];
    if (!life) throw new Error(`the scene ${scene.id} has no picture life for ${scene.picture} (src/game/adventure/sceneLife.ts)`);
    return new AdventureScene(scene, life);
  });
}
