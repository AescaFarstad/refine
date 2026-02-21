import type { RawNexusItemDefinition } from '../logic/NexusLib';

const nexusItems: Record<string, RawNexusItemDefinition> = {
  free_move_panel: {
    name: 'Favorable Glyph',
    description: 'No movement cost within vision.',
    price: 10,
    priceIncrease: [10],
    placableInstanceDescription: {
      passable: true,
      button: false,
      cells: [{ x: 0, y: 0 }],
      image: 'fast_forward',
      opacity: 0.5,
    },
  },
  refresher_panel: {
    name: 'Refresher Panel',
    description: 'Refreshes resources in it radius.',
    effectRadius: 7,
    limitRadius: 7,
    price: 100,
    priceIncrease: [10],
    placableInstanceDescription: { passable: true, button: true, cells: [{ x: 0, y: 0 }], image: 'recycle_2' },
  },
  doubler_panel: {
    name: 'Doubler Block',
    description: 'Doubles resources in its radius.',
    effectRadius: 5,
    limitRadius: 5,
    price: 100,
    priceIncrease: [10],
    glyph: 'x2',
    placableInstanceDescription: { passable: false, button: false, cells: [{ x: 0, y: 0 }], image: '' },
  },
  plus_one_panel: {
    name: 'Plus One Block',
    description: '+1 to all resources globally.',
    price: 100,
    priceIncrease: [10],
    glyph: '+1',
    placableInstanceDescription: {
      passable: false,
      button: false,
      cells: [{ x: 0, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }],
      image: '',
      glyphPlacement: 'center',
    },
  },

};

export default nexusItems;
