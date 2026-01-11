import type { LootRarity, RaidDefinition } from "./RaidLib";
import { parseRaidDefinitions } from "./RaidLib";
import type { GearDefinition } from './GearLib';
import { parseGearDefinitions } from './GearLib';
import type { GearCategoryDefinition } from './GearCategoryLib';
import { parseGearCategoryDefinitions } from './GearCategoryLib';
import type { QuestDefinition } from './QuestLib';
import { buildQuestMapFromSources } from './QuestLib';
import type { ItemDefinition } from "./ItemLib";
import { parseItemDefinitionsWithOrder } from "./ItemLib";
import type { SignatureDefinition } from './SignatureLib';
import { parseSignatureDefinitions } from './SignatureLib';
import type { MonsterDefinition } from './MonsterLib';
import { parseMonsterDefinitions } from './MonsterLib';
import monstersData from '../data/monsters';
import type { MazeDefinition } from './MazeLib';
import { buildOrderedMazeLevels, parseMazeDefinitions } from './MazeLib';
import raidsData from '../data/raids';
import questsShegolskoeData from '../data/quests/quests_shegolskoe';
import questsOzernoyeData from '../data/quests/quests_ozernoye';
import questsDyatlovskData from '../data/quests/quests_dyatlovsk';
import questsBirdmundshireData from '../data/quests/quests_birdmundshire';
import gearData from '../data/gear';
import gearCategoriesData from '../data/gear_categories';
import itemsData from '../data/items';
import signaturesData from '../data/signatures';
import signatureLayoutsData from '../data/signature_layouts';
import mazeData from '../data/maze';
import { ResearchLib } from "./ResearchLib";
import { researchArchetypes } from '../data/research_archetypes';
import { researchPane, researchPaneEmptyCells, researchPaneVoidCells } from '../data/research_pane';

export class Lib {

  public isLoaded: boolean = false;
  public raidSources: Map<string, RaidDefinition> = new Map();
  public raids: Map<string, RaidDefinition> = new Map();
  public quests: Map<string, QuestDefinition> = new Map();
  public gear: Map<string, GearDefinition> = new Map();
  public gearCategories: Map<string, GearCategoryDefinition> = new Map();
  public items: Map<string, ItemDefinition> = new Map();
  public signatures: Map<string, SignatureDefinition> = new Map();
  public monsters: Map<string, MonsterDefinition> = new Map();
  public mazes: Map<string, MazeDefinition> = new Map();
  // Ordered levels array (sorted by numeric prefix lN_)
  public mazeLevels: MazeDefinition[] = [];
  public research: ResearchLib = new ResearchLib();

  constructor() {
    this.loadAllDefinitions();
  }

  public getItem(id: string): ItemDefinition {
    return this.items.get(id)!;
  }

  public getSignature(id: string): SignatureDefinition {
    return this.signatures.get(id)!;
  }

  private _emptyItemPoolsByRarity(): Record<LootRarity, string[]> {
    return { common: [], uncommon: [], rare: [], legendary: [] };
  }

  public buildItemPoolsByRarity(ids?: string[]): Record<LootRarity, string[]> {
    if (!Array.isArray(ids) || ids.length === 0) return this._emptyItemPoolsByRarity();
    const pools: Record<LootRarity, string[]> = this._emptyItemPoolsByRarity();
    for (const id of ids) {
      const def = this.getItem(id);
      pools[def.rarity].push(id);
    }
    return pools;
  }

  private loadAllDefinitions(): void {
    if (this.isLoaded) {
      return;
    }

    try {
      const { raidSources, raids } = parseRaidDefinitions(raidsData);
      this.raidSources = raidSources;
      this.raids = raids;

      this.gearCategories = parseGearCategoryDefinitions(gearCategoriesData);
      this.gear = parseGearDefinitions(gearData);
      this.items = parseItemDefinitionsWithOrder(itemsData, this.raids.values());
      this.signatures = parseSignatureDefinitions(signaturesData, signatureLayoutsData);

      for (const raid of this.raidSources.values()) {
        raid.itemPoolsByRarity = this.buildItemPoolsByRarity(raid.items);
      }
      for (const raid of this.raids.values()) {
        raid.itemPoolsByRarity = this.buildItemPoolsByRarity(raid.items);
      }

      {
        this.quests = buildQuestMapFromSources([
          questsShegolskoeData,
          questsOzernoyeData,
          questsDyatlovskData,
          questsBirdmundshireData,
        ]);
      }

      this.monsters = parseMonsterDefinitions(monstersData);

      this.mazes = parseMazeDefinitions(mazeData);
      this.mazeLevels = buildOrderedMazeLevels(this.mazes);

      // Initialize research library with gear archetypes
      this.research.load(
        researchArchetypes,
        researchPane,
        researchPaneEmptyCells,
        researchPaneVoidCells,
        this.gear
      );

      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to process library definitions:", error);
      this.isLoaded = false;
    }
  }
}
