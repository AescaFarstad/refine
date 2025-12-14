import {
  Connection,
  Connections,
  ConnectionType,
  FormulaStat,
  IndependentStat,
  Parameter,
  Stat,
  StatFormula,
  FormulaParameter,
  FormulaParameterFormula,
  GateParameter,
  EventDispatcherParameter,
  EventDispatcherLambda
} from './Stat';

/**
 * Namespace containing utility functions for creating, connecting,
 * and modifying stats within a Connections manager.
 */
export namespace Stats {

  /**
   * Creates a new Parameter stat and registers it.
   * @param name Unique name for the stat.
   * @param connections The Connections manager instance.
   * @returns The newly created Parameter.
   */
  export function createParameter(name: string, connections: Connections): Parameter {
    const result = new Parameter(name);
    console.assert(!connections.connectablesByName.has(name), `Stat already exists: ${name}`);
    connections.connectablesByName.set(name, result);
    // Initial value is 0 (add=0 * multiCache=1)
    return result;
  }

  /**
   * Creates a new IndependentStat and registers it.
   * @param name Unique name for the stat.
   * @param initialValue The starting value for the stat.
   * @param connections The Connections manager instance.
   * @returns The newly created IndependentStat.
   */
  export function createStat(name: string, initialValue: number, connections: Connections): IndependentStat {
    const result = new IndependentStat(name, initialValue);
    console.assert(!connections.connectablesByName.has(name), `Stat already exists: ${name}`);
    connections.connectablesByName.set(name, result);
    return result;
  }

  /**
   * Creates a new FormulaStat and registers it.
   * @param name Unique name for the stat.
   * @param formula The calculation function.
   * @param connections The Connections manager instance.
   * @returns The newly created FormulaStat.
   */
  export function createFormulaStat(name: string, formula: StatFormula, connections: Connections): FormulaStat {
    const result = new FormulaStat(name, formula);
    console.assert(!connections.connectablesByName.has(name), `Stat already exists: ${name}`);
    connections.connectablesByName.set(name, result);
    // Initial value needs calculation based on initial argument, which depends on connection
    // We can trigger an initial calculation after connection if needed.
    return result;
  }

  /**
   * Creates a new FormulaParameter stat and registers it.
   * @param name Unique name for the stat.
   * @param formula The calculation function for the FormulaParameter.
   * @param connections The Connections manager instance.
   * @param initialInputs Optional initial values for the named inputs.
   * @returns The newly created FormulaParameter.
   */
  export function createFormulaParameter(name: string, formula: FormulaParameterFormula, connections: Connections, initialInputs?: Record<string, number>): FormulaParameter {
    const result = new FormulaParameter(name, formula, initialInputs);
    console.assert(!connections.connectablesByName.has(name), `Stat already exists: ${name}`);
    connections.connectablesByName.set(name, result);
    return result;
  }

  /**
   * Creates a new GateParameter stat and registers it.
   * @param name Unique name for the stat.
   * @param baseValue The base value added to input value before threshold comparison.
   * @param isAboveThreshold True for >= threshold, false for <= threshold.
   * @param connections The Connections manager instance.
   * @returns The newly created GateParameter.
   */
  export function createGateParameter(name: string, baseValue: number, isAboveThreshold: boolean, connections: Connections): GateParameter {
    const result = new GateParameter(name, baseValue, isAboveThreshold);
    console.assert(!connections.connectablesByName.has(name), `Stat already exists: ${name}`);
    connections.connectablesByName.set(name, result);
    return result;
  }

  /**
   * Creates a new EventDispatcherParameter stat and registers it.
   * @param name Unique name for the stat.
   * @param baseValue The base value added to input value before threshold comparison.
   * @param isAboveThreshold True for >= threshold, false for <= threshold.
   * @param lambda The function to call when the threshold is crossed.
   * @param connections The Connections manager instance.
   * @returns The newly created EventDispatcherParameter.
   */
  export function createEventDispatcherParameter(name: string, baseValue: number, isAboveThreshold: boolean, lambda: EventDispatcherLambda, connections: Connections): EventDispatcherParameter {
    const result = new EventDispatcherParameter(name, baseValue, isAboveThreshold, lambda);
    console.assert(!connections.connectablesByName.has(name), `Stat already exists: ${name}`);
    connections.connectablesByName.set(name, result);
    return result;
  }

  /**
   * Establishes a connection between two stats by their names.
   * @param fromName Name of the source stat.
   * @param toName Name of the target stat.
   * @param type Type of the connection.
   * @param connections The Connections manager instance.
   * @param inputName For NAMED_INPUT, the name of the input on the target FormulaParameter.
   */
  export function connectStr(fromName: string, toName: string, type: ConnectionType, connections: Connections, inputName?: string): void {
    const fromStat = connections.connectablesByName.get(fromName);
    const toStat = connections.connectablesByName.get(toName);
    if (!fromStat) {
      console.error(`Connection source doesn't exist: ${fromName}`);
      return;
    }
    if (!toStat) {
      console.error(`Connection target doesn't exist: ${toName}`);
      return;
    }
    if (toStat.independent) {
       console.error(`Cannot connect to an IndependentStat: ${toName}`);
       return;
    }
     if (type === ConnectionType.NAMED_INPUT && !inputName) {
      console.error(`inputName is required for NAMED_INPUT connection type when calling connectStr for ${toName}.`);
      return;
    }


    if (!connections.establishedConnections.has(fromName)) {
      connections.establishedConnections.set(fromName, []);
    }    // Check if this exact connection already exists to prevent duplicates
    const existingConnections = connections.establishedConnections.get(fromName)!;
    const connectionExists = existingConnections.some(conn => 
      conn.target === toName && 
      conn.type === type && 
      conn.inputName === inputName
    );    if (connectionExists) {
      console.warn(`Connection already exists: ${fromName} -> ${toName} (type: ${type})`);
      return; // Don't create duplicate connection
    }    const connection = new Connection(toName, type, inputName); // Pass inputName here
    connections.establishedConnections.get(fromName)!.push(connection);

    if (type === ConnectionType.MULTY) {
      if (!(toStat instanceof Parameter)) {
        console.error(`MULTY connection target ${toName} is not a Parameter.`);
        return;
      }
      // Check if this connection already exists to prevent duplicates
      if (!(toStat as Parameter).multi.includes(fromName)) {
        (toStat as Parameter).multi.push(fromName);
        updateMultiCache(toStat as Parameter, connections);
      }
    } else if (type === ConnectionType.NAMED_INPUT) {
      if (!(toStat instanceof FormulaParameter)) {
        console.error(`NAMED_INPUT connection target ${toName} is not a FormulaParameter.`);
        return;
      }
      if (!inputName) { // Should be caught by earlier check, but good for safety
        console.error(`inputName is crucial for NAMED_INPUT connection to ${toName} but was not provided.`);
        return;
      }
      // Removed: (toStat as FormulaParameter).inputConnections.set(inputName, fromName);
      // Set initial input value and recalculate
      (toStat as FormulaParameter).inputs[inputName] = fromStat.value;
      recalculateFormulaParameterValue(toStat as FormulaParameter, connections);
      // No immediate call to applyConnection here as FormulaParameter recalc handles propagation
      return; // Return to avoid double application via generic applyConnection call below
    }
    // New: Handle DIV connection
    else if (type === ConnectionType.DIV) {
      if (!(toStat instanceof Parameter)) {
        console.error(`DIV connection target ${toName} is not a Parameter.`);
        return;
      }
      // Check if this connection already exists to prevent duplicates
      if (!(toStat as Parameter).divSources.includes(fromName)) {
        (toStat as Parameter).divSources.push(fromName);
        updateMultiCache(toStat as Parameter, connections);
      }
    }


    // Apply the initial value immediately for other connection types
    // For NAMED_INPUT, this is handled during its specific setup block
    applyConnection(connection, 0, fromStat.value, connections);
  }

  /**
   * Establishes a connection between two stat objects.
   * @param from Source Stat object.
   * @param to Target Parameter, FormulaStat, FormulaParameter, GateParameter, or EventDispatcherParameter object.
   * @param type Type of the connection.
   * @param connections The Connections manager instance.
   * @param inputName For NAMED_INPUT, the name of the input on the target FormulaParameter.
   */
  export function connectStat(from: Stat, to: Parameter | FormulaStat | FormulaParameter | GateParameter | EventDispatcherParameter, type: ConnectionType, connections: Connections, inputName?: string): void {
    console.assert(!(to as any).independent, `Cannot connect to an IndependentStat: ${to.name}`);
    if (type === ConnectionType.NAMED_INPUT) {
      if (!(to instanceof FormulaParameter)) {
         console.error(`Target for NAMED_INPUT connection must be a FormulaParameter. Target: ${to.name}`);
         return;
      }
      if (!inputName) {
        console.error(`inputName is required for NAMED_INPUT connection type to ${to.name}.`);
        return;
      }
    }
    if (type === ConnectionType.GATE_THRESHOLD || type === ConnectionType.GATE_VALUE) {
      if (!(to instanceof GateParameter)) {
        console.error(`Target for GATE_THRESHOLD/GATE_VALUE connection must be a GateParameter. Target: ${to.name}`);
        return;
      }
    }
    connectStr(from.name, to.name, type, connections, inputName);
  }

  /**
   * Sets the value of a stat and propagates changes.
   * Internal function, prefer modifyStat or modifyParameterADD externally.
   * @param stat The stat to update.
   * @param newValue The new value.
   * @param connections The Connections manager instance.
   */
  function setStat(stat: Stat, newValue: number, connections: Connections): void {
    if (stat.value === newValue) {
      return;
    }
    const oldValue = stat.value;
    // Use type assertion to modify readonly property
    (stat as { value: number }).value = newValue;
    applyConnections(stat, oldValue, newValue, connections);
  }

  /**
   * Modifies the value of an IndependentStat by a delta.
   * @param stat The IndependentStat to modify.
   * @param delta The change in value.
   * @param connections The Connections manager instance.
   */
  export function modifyStat(stat: IndependentStat, delta: number, connections: Connections): void {
    setStat(stat, stat.value + delta, connections);
  }

  /**
   * Sets the value of an IndependentStat directly.
   * @param stat The IndependentStat to set.
   * @param newValue The new value.
   * @param connections The Connections manager instance.
   */
  export function setIndependentStat(stat: IndependentStat, newValue: number, connections: Connections): void {
    setStat(stat, newValue, connections);
  }

  /**
   * Modifies the additive component of a Parameter stat.
   * @param parameter The Parameter to modify.
   * @param delta The change in the additive component.
   * @param connections The Connections manager instance.
   */
  export function modifyParameterADD(parameter: Parameter, delta: number, connections: Connections): void {
    if (delta === 0) return;
    parameter.add += delta;
    // Recalculate the parameter's final value
    recalculateParameterValue(parameter, connections);
  }

  /**
   * Recalculates the multiCache for a Parameter based on its current MULTY connections.
   * @param parameter The Parameter to update.
   * @param connections The Connections manager instance.
   */
  function updateMultiCache(parameter: Parameter, connections: Connections): void {
    parameter.multiCache = 1;
    parameter.multi.forEach(sourceName => {
      const sourceStat = connections.connectablesByName.get(sourceName);
      if (sourceStat) {
        parameter.multiCache *= sourceStat.value;
      }
    });
    parameter.divSources.forEach(sourceName => {
      const sourceStat = connections.connectablesByName.get(sourceName);
      if (sourceStat) {
        const divisor = sourceStat.value === 0 ? 1 : sourceStat.value;
        parameter.multiCache /= divisor;
      }
    });
  }

  /**
   * Recalculates the final value of a Parameter (add * multiCache) and propagates changes.
   * @param parameter The Parameter to recalculate.
   * @param connections The Connections manager instance.
   */
  function recalculateParameterValue(parameter: Parameter, connections: Connections): void {
    const newValue = parameter.add * parameter.multiCache;
    setStat(parameter, newValue, connections);
  }

  /**
   * Recalculates the value of a FormulaStat based on its current argument and propagates changes.
   * @param stat The FormulaStat to recalculate.
   * @param connections The Connections manager instance.
   */
  function recalculateFormulaStatValue(stat: FormulaStat, connections: Connections): void {
    const newValue = stat.formula(stat.argument);
    setStat(stat, newValue, connections);
  }

  /**
   * Recalculates the value of a FormulaParameter based on its current inputs and propagates changes.
   * @param stat The FormulaParameter to recalculate.
   * @param connections The Connections manager instance.
   */
  function recalculateFormulaParameterValue(stat: FormulaParameter, connections: Connections): void {
    const newValue = stat.formula(stat.inputs);
    setStat(stat, newValue, connections);
  }

  /**
   * Recalculates the value of a GateParameter and propagates changes if the value changed.
   * @param stat The GateParameter to recalculate.
   * @param connections The Connections manager instance.
   */
  function recalculateGateParameterValue(stat: GateParameter, connections: Connections): void {
    const combinedValue = stat.baseValue + stat.inputValue;
    if (stat.isAboveThreshold === (combinedValue >= stat.threshold))
      setStat(stat, stat.inputValue, connections);
  }

  /**
   * Recalculates the value of an EventDispatcherParameter and adds it to the queue if threshold is crossed.
   * @param stat The EventDispatcherParameter to recalculate.
   * @param connections The Connections manager instance.
   */
  function recalculateEventDispatcherParameterValue(stat: EventDispatcherParameter, connections: Connections): void {
    const combinedValue = stat.baseValue + stat.inputValue;
    const shouldTrigger = stat.isAboveThreshold === (combinedValue >= stat.threshold);    if (shouldTrigger) {
      setStat(stat, stat.inputValue, connections);      // Add to event dispatcher queue if not already queued
      if (!stat.isQueued) {
        connections.eventDispatcherQueue.push(stat);
        stat.isQueued = true;
      }
    }
  }

  /**
   * Applies all outgoing connections from a changed stat.
   * @param fromStat The stat whose value changed.
   * @param oldValue The previous value.
   * @param newValue The new value.
   * @param connections The Connections manager instance.
   */
  function applyConnections(fromStat: Stat, oldValue: number, newValue: number, connections: Connections): void {
    const connectionsArray = connections.establishedConnections.get(fromStat.name);
    if (connectionsArray) {
      for (const connection of connectionsArray) {
        applyConnection(connection, oldValue, newValue, connections);
      }
    }
  }

  /**
   * Applies a single connection, updating the target stat based on the source change.
   * @param connection The connection details.
   * @param oldValue Previous value of the source stat.
   * @param newValue New value of the source stat.
   * @param connections The Connections manager instance.
   */
  function applyConnection(connection: Connection, oldValue: number, newValue: number, connections: Connections): void {
    const targetStat = connections.connectablesByName.get(connection.target);
    if (!targetStat || targetStat.independent) return;

    // Type assertion needed as independent stats are filtered out
    const pStat = targetStat as Parameter | FormulaStat | FormulaParameter | GateParameter | EventDispatcherParameter;

    switch (connection.type) {
      case ConnectionType.ADD:
        (pStat as Parameter).add += newValue - oldValue;
        recalculateParameterValue(pStat as Parameter, connections);
        break;
      case ConnectionType.SUB:
        (pStat as Parameter).add -= newValue - oldValue;
        recalculateParameterValue(pStat as Parameter, connections);
        break;
      case ConnectionType.MULTY:
        // The change in one MULTY source requires recalculating the entire cache
        updateMultiCache(pStat as Parameter, connections);
        recalculateParameterValue(pStat as Parameter, connections);
        break;
      case ConnectionType.DIV:
        // The change in one DIV source requires recalculating the entire cache
        updateMultiCache(pStat as Parameter, connections);
        recalculateParameterValue(pStat as Parameter, connections);
        break;
      case ConnectionType.FORMULA:
        (pStat as FormulaStat).argument = newValue;
        recalculateFormulaStatValue(pStat as FormulaStat, connections);
        break;
      case ConnectionType.NAMED_INPUT:
        (pStat as FormulaParameter).inputs[connection.inputName as string] = newValue;
        recalculateFormulaParameterValue(pStat as FormulaParameter, connections);
        break;
      case ConnectionType.GATE_THRESHOLD:
        (pStat as GateParameter).threshold = newValue;
        if (pStat instanceof EventDispatcherParameter) {
          recalculateEventDispatcherParameterValue(pStat, connections);
        } else {
        recalculateGateParameterValue(pStat as GateParameter, connections);
        }
        break;
      case ConnectionType.GATE_VALUE:
        (pStat as GateParameter).inputValue = newValue;
        if (pStat instanceof EventDispatcherParameter) {
          recalculateEventDispatcherParameterValue(pStat, connections);
        } else {
        recalculateGateParameterValue(pStat as GateParameter, connections);
        }
        break;
    }
  }

  /**
   * Retrieves a stat by its name.
   * @param name The name of the stat.
   * @param connections The Connections manager instance.
   * @returns The Stat object or undefined if not found.
   */
  export function getStat(name: string, connections: Connections): Stat | undefined {
    return connections.connectablesByName.get(name);
  }

   /**
   * Retrieves a stat by its name, asserting that it exists.
   * @param name The name of the stat.
   * @param connections The Connections manager instance.
   * @returns The Stat object.
   * @throws If the stat is not found.
   */
  export function getStatAsserted<T extends Stat = Stat>(name: string, connections: Connections): T {
    const stat = connections.connectablesByName.get(name);
    if (!stat) {
      throw new Error(`Stat not found: ${name}`);
    }
    return stat as T;
  }

  /**
   * Clones a Stat object.
   * This is a helper function for cloneConnections.
   * @param stat The Stat object to clone.
   * @returns A new, cloned Stat object.
   * @throws If the stat type is unknown.
   */
  function cloneStat(stat: Stat): Stat {
    if (stat instanceof IndependentStat) {
      const newIndependentStat = new IndependentStat(stat.name, 0);
      (newIndependentStat as { -readonly [K in 'value']: number })['value'] = stat.value;
      return newIndependentStat;
    } else if (stat instanceof Parameter) {
      const newParameter = new Parameter(stat.name);
      newParameter.add = stat.add;
      newParameter.multi = [...stat.multi];
      newParameter.divSources = [...stat.divSources];
      newParameter.multiCache = stat.multiCache;
      (newParameter as { -readonly [K in 'value']: number })['value'] = stat.value;
      return newParameter;
    } else if (stat instanceof FormulaStat) {
      const newFormulaStat = new FormulaStat(stat.name, stat.formula);
      newFormulaStat.argument = stat.argument;
      (newFormulaStat as { -readonly [K in 'value']: number })['value'] = stat.value;
      return newFormulaStat;
    } else if (stat instanceof FormulaParameter) {
      const newFormulaParameter = new FormulaParameter(stat.name, stat.formula, { ...stat.inputs });
      (newFormulaParameter as { -readonly [K in 'value']: number })['value'] = stat.value;
      return newFormulaParameter;
    } else if (stat instanceof EventDispatcherParameter) {
      const newEventDispatcherParameter = new EventDispatcherParameter(stat.name, stat.baseValue, stat.isAboveThreshold, stat.lambda);
      newEventDispatcherParameter.threshold = stat.threshold;
      newEventDispatcherParameter.inputValue = stat.inputValue;
      newEventDispatcherParameter.isQueued = false; // Reset queue status in clone
      (newEventDispatcherParameter as { -readonly [K in 'value']: number })['value'] = stat.value;
      return newEventDispatcherParameter;
    } else if (stat instanceof GateParameter) {
      const newGateParameter = new GateParameter(stat.name, stat.baseValue, stat.isAboveThreshold);
      newGateParameter.threshold = stat.threshold;
      newGateParameter.inputValue = stat.inputValue;
      (newGateParameter as { -readonly [K in 'value']: number })['value'] = stat.value;
      return newGateParameter;
    }
    throw new Error(`Unknown stat type for cloning: ${stat.name} of type ${stat.constructor.name}`);
  }

  /**
   * Creates a deep clone of a Connections object.
   * The cloned Connections object is completely independent of the original.
   * @param connections The Connections object to clone.
   * @returns A new, deep-cloned Connections object.
   */
  export function cloneConnections(connections: Connections): Connections {
    const newConnections = new Connections();

    // Clone all connectable stats
    connections.connectablesByName.forEach((stat, name) => {
      newConnections.connectablesByName.set(name, cloneStat(stat));
    });

    // Clone all established connections
    connections.establishedConnections.forEach((conns, sourceName) => {
      const newConns = conns.map(conn => new Connection(conn.target, conn.type, conn.inputName));
      newConnections.establishedConnections.set(sourceName, newConns);
    });

    return newConnections;
  }

  /**
   * Processes all EventDispatcherParameter stats in the queue, calls their lambda functions, and clears the queue.
   * This should be called during GameState update.
   * @param connections The Connections manager instance.
   * @param gameState The GameState instance to pass to lambda functions.
   */
  export function processEventDispatcherQueue(connections: Connections, gameState: any): void {
    while (connections.eventDispatcherQueue.length > 0) {
      const stat = connections.eventDispatcherQueue.shift()!;
      stat.isQueued = false;      try {
        stat.lambda(stat, gameState);
      } catch (error) {
        console.error(`Error processing EventDispatcherParameter ${stat.name}:`, error);
      }
    }
  }

} // namespace Stats 