# Stats System Documentation

## Overview

The Stats system provides a reactive, interconnected approach to managing numerical values throughout the game. It enables automatic propagation of changes through defined relationships, making it ideal for complex game mechanics where one value affects many others.

## Core Architecture

### Base Classes

**`Stat`** - Abstract base class for all stat types
- `name: string` - Unique identifier
- `value: number` - Current computed value (readonly)
- `independent: boolean` - Whether this stat can be modified directly

**`IndependentStat`** - Stats that can be modified directly
- Extends `Stat` with `independent = true`
- Can be changed via `modifyStat()` or `setIndependentStat()`
- Examples: character levels, resource amounts, skill points

**`Parameter`** - Derived stats using additive and multiplicative components
- Formula: `value = add * multiCache`
- `add: number` - Additive component
- `multi: string[]` - Names of stats providing multiplicative factors
- `divSources: string[]` - Names of stats providing divisor factors
- `multiCache: number` - Cached product of all multipliers and divisors
- Examples: resource maximums, derived attributes

**`FormulaStat`** - Stats calculated using custom formulas
- Takes a single `argument` value and applies a `StatFormula` function
- `formula: StatFormula` - Function that takes a number and returns a number
- `argument: number` - Input value for the formula
- Examples: complex calculations with curves or thresholds

**`FormulaParameter`** - Stats calculated from multiple named inputs
- `formula: FormulaParameterFormula` - Function taking `Record<string, number>` and returning number
- `inputs: Record<string, number>` - Named input values
- Ideal for complex calculations like skill proficiencies
- Example: `(inputs) => inputs.attributeLevel * 2 + inputs.skillLevel * 3`

**`GateParameter`** - Conditional stats that output input value only when threshold is met
- `baseValue: number` - Added to input before threshold comparison
- `threshold: number` - Comparison value
- `inputValue: number` - The value to output when gate is open
- `isAboveThreshold: boolean` - True for `>=`, false for `<=`
- Outputs `inputValue` when condition is met, 0 otherwise

## Connection System

### Connection Types

**`ConnectionType.ADD`** - Adds source value to target's `add` component
**`ConnectionType.SUB`** - Subtracts source value from target's `add` component  
**`ConnectionType.MULTY`** - Multiplies target's `multiCache` by source value
**`ConnectionType.DIV`** - Divides target's `multiCache` by source value (protects against division by zero)
**`ConnectionType.FORMULA`** - Sets source value as target FormulaStat's `argument`
**`ConnectionType.NAMED_INPUT`** - Sets source value as named input in target FormulaParameter
**`ConnectionType.GATE_THRESHOLD`** - Sets source value as threshold for target GateParameter
**`ConnectionType.GATE_VALUE`** - Sets source value as input value for target GateParameter

### Connection Management

**`Connections`** - Central manager for all stats and their relationships
- `connectablesByName: Map<string, Stat>` - Registry of all stats by name
- `establishedConnections: Map<string, Connection[]>` - Outgoing connections from each stat

**`Connection`** - Represents a single relationship between stats
- `target: string` - Name of the target stat
- `type: ConnectionType` - How the connection affects the target
- `inputName?: string` - For NAMED_INPUT connections, specifies which input to update

## Usage Patterns

### Creating Stats

```typescript
// Create an independent stat (character level)
const characterLevel = Stats.createStat('characterLevel', 1, connections);

// Create a parameter (max health = base + bonuses)
const maxHealth = Stats.createParameter('maxHealth', connections);
Stats.modifyParameterADD(maxHealth, 100, connections); // base value

// Create a formula stat (experience needed = level^2 * 100)
const xpNeeded = Stats.createFormulaStat('xpNeeded', 
  (level) => level * level * 100, connections);

// Create a formula parameter (skill proficiency from multiple sources)
const proficiency = Stats.createFormulaParameter('swordProficiency',
  (inputs) => inputs.strength * 2 + inputs.skillLevel * 5, connections);
```

### Establishing Connections

```typescript
// Character level affects XP requirement
Stats.connectStr('characterLevel', 'xpNeeded', ConnectionType.FORMULA, connections);

// Strength and skill level affect proficiency
Stats.connectStr('strength', 'swordProficiency', ConnectionType.NAMED_INPUT, connections, 'strength');
Stats.connectStr('swordSkillLevel', 'swordProficiency', ConnectionType.NAMED_INPUT, connections, 'skillLevel');

// Equipment bonus affects max health
Stats.connectStr('equipmentHealthBonus', 'maxHealth', ConnectionType.ADD, connections);

// Constitution multiplies max health
Stats.connectStr('constitution', 'maxHealth', ConnectionType.MULTY, connections);
```

### Modifying Values

```typescript
// Modify independent stats
Stats.modifyStat(characterLevel, 1, connections); // Level up
Stats.setIndependentStat(currentHealth, 50, connections); // Set health directly

// Modify parameter additive components
Stats.modifyParameterADD(maxHealth, 25, connections); // Add base health

// Changes propagate automatically to connected stats
```

## Integration Points

### Game Systems Using Stats

**Resources** (`Resource.ts`)
- Current amount: `IndependentStat`
- Maximum: `Parameter` 
- Income rate: `Parameter`

**Characters** (`Character.ts`)
- Level: `IndependentStat`
- Attributes: `IndependentStat` for each attribute
- Skills: `IndependentStat` for each skill/specialization
- Proficiencies: `FormulaParameter` calculated from attributes and skill levels

**Buildings** (`Building.ts`)
- Building effects: `IndependentStat` connected to global parameters
- Example: each building's clutter generation affects total clutter

**Discovery System**
- Inspiration: `IndependentStat`
- Inspiration level: `IndependentStat` 
- Inspiration max: `Parameter` calculated from level

### GameState Integration

Stats are managed through `GameState.connections: Connections`:

```typescript
// In GameState constructor
this.connections = new Connections();

// Creating game resources
this.resourceManager = new ResourceManager(this.connections);

// Setting up characters with stat-based attributes
character.setupStats(this.connections);

// Automatic updates happen during value changes
```

## Advanced Features

### Hypothetical System Integration

The stats system integrates with `Hypothetical.ts` for "what-if" scenarios:
- Creates temporary clones of the connections graph
- Applies hypothetical changes to see potential outcomes
- Used for UI previews (hover effects showing stat changes before commitment)

### Change Propagation

When a stat value changes:
1. All outgoing connections are evaluated
2. Target stats are updated based on connection type
3. Changes cascade automatically through the dependency graph
4. UI updates happen reactively through the connection to `uiState`

### Performance Considerations

- Connection graph prevents infinite loops through careful design
- Multiplicative cache optimization reduces recalculation overhead
- Change propagation is immediate but bounded by graph structure
- Stats are designed for frequent reads, less frequent writes

## Best Practices

### Connection Patterns
- Independent stats for player-modifiable values
- Parameters for values derived from simple formulas
- FormulaParameters for complex multi-input calculations
- Establish connections during initialization, not during gameplay

### Error Prevention
- Always check stat existence before connecting
- Use `getStatAsserted()` when you expect a stat to exist
- Avoid circular dependencies in the connection graph
- Clean up connections when removing game entities

## Examples

### Character Skill System
```typescript
// Base skill level (player spends points)
const meleeSkill = Stats.createStat('meleeSkill', 0, connections);

// Governing attribute
const strength = Stats.createStat('strength', 10, connections);

// Proficiency calculated from both
const meleeProficiency = Stats.createFormulaParameter('meleeProficiency',
  (inputs) => inputs.skill * 3 + inputs.attribute * 2, connections);

// Connect the inputs
Stats.connectStr('meleeSkill', 'meleeProficiency', ConnectionType.NAMED_INPUT, connections, 'skill');
Stats.connectStr('strength', 'meleeProficiency', ConnectionType.NAMED_INPUT, connections, 'attribute');

// Now when either skill or strength changes, proficiency updates automatically
```

### Resource Management
```typescript
// Current gold (player gains/spends)
const gold = Stats.createStat('gold', 100, connections);

// Base income
const goldIncome = Stats.createParameter('goldIncome', connections);
Stats.modifyParameterADD(goldIncome, 10, connections); // 10 per second base

// Building bonuses multiply income
const buildings = Stats.createStat('goldBuildings', 0, connections);
Stats.connectStr('goldBuildings', 'goldIncome', ConnectionType.MULTY, connections);

// When buildings increase, income automatically scales
``` 