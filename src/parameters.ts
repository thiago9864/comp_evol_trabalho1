export const Parameters = {
    populationSize: 200,
    selectedPopulationSize: 40,

    // Number of new solutions to be inserted when solution_gap < 0.1. In (0, selectedPopulationSize) range
    numNewSolutions: 15,

    // Probabilities in [0, 100] range
    probMutationInsertionInRoute: 5,
    probMutationSwap: 35,
    probMutationInsertionBetweenRoutes: 35,

    // Crossover cut size in [0.0, 1.0] range
    crossoverCutPercentage: 0.2,
    // Probability of cut p1 if r < prob or cut p2 otherwise. In (0, 100) range
    crossoverCutChance: 70,

    // Chance of performing local search on a route being closed. In [0, 100] range
    onCloseRoutesChanceLocalSearch: 20,
};