import type { RawNexusItemDefinition } from '../logic/NexusLib';

const nexusItems: Record<string, RawNexusItemDefinition> = {
  refresher_panel: {
    name: 'Refresher Panel',
    description: 'Refreshes resources in it radius.',
    effectRadius: 7,
    limitRadius: 7,
    price: 100,
    priceIncrease: [10],
    placableInstanceDescription: { passable: true, cells: [{ x: 0, y: 0 }], image: 'recycle_2' },
  },
  doubler_panel: {
    name: 'Doubler Block',
    description: 'Doubles resources in its radius.',
    effectRadius: 5,
    limitRadius: 5,
    price: 100,
    priceIncrease: [10],
    glyph: 'x2',
    placableInstanceDescription: { passable: false, cells: [{ x: 0, y: 0 }], image: '' },
  },

};

export default nexusItems;
