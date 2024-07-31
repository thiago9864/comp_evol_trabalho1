import {
    ACTUAL_PROBLEM_SIZE,
    BATTERY_CAPACITY,
    DEPOT,
    get_distance,
    get_energy_consumption,
    is_charging_station,
    MIN_VEHICLES,
    NUM_OF_CUSTOMERS,
} from "./evrp";
import { rand, Routes, Solution } from "./genetic_heuristic";
import { Parameters } from "./parameters";

/**
 * Test route permutations to the best possible
 * This will count on the evals proportional to the problem size
 */
export function localSearch(route: number[], routeSize: number) {
    let i: number;
    let j: number;
    let k: number;
    let tmp: number;
    let prevDist: number = 0;
    let distance: number = 0;

    // Compute initial route distance
    for (i = 0; i < routeSize - 1; i++) {
        distance += get_distance(route[i], route[i + 1]);
    }

    for (i = 1; i < routeSize - 2; i++) {
        for (j = i + 1; j < routeSize - 1; j++) {
            if (i !== j) {
                tmp = route[i];
                route[i] = route[j];
                route[j] = tmp;

                // Compute modified route distance;
                tmp = prevDist;
                for (k = i - 1; k < routeSize - 1; k++) {
                    tmp += get_distance(route[k], route[k + 1]);
                }
                if (tmp >= distance) {
                    // if distance is the same or worse, undo swap
                    tmp = route[i];
                    route[i] = route[j];
                    route[j] = tmp;
                } else {
                    // if distance is better, update distance
                    distance = tmp;
                }
            }
        }
        prevDist += get_distance(route[i - 1], route[i]);
    }
}

/**
 * Open and separate routes from a solution tour, while removing charging stations
 */
export function openRoutes(sol: Solution): Routes {
    let i: number;
    let j: number;
    let k: number;
    let node: number;
    let depotIndexes: number[] = new Array(MIN_VEHICLES * 3);
    let depotIndexSize: number = 0;
    let newRoute: Routes = new Routes();

    // transfer solution data
    newRoute.solution.id = sol.id;
    newRoute.solution.steps = sol.steps;
    newRoute.solution.tour = Array.from(sol.tour);
    newRoute.solution.tour_length = sol.tour_length;
    newRoute.solution.tour_size = sol.tour_size;
    newRoute.solution.modified = true;

    // get depot indexes
    for (i = 0; i < sol.tour_size; i++) {
        node = sol.tour[i];
        if (node === DEPOT) {
            depotIndexes[depotIndexSize] = i;
            depotIndexSize++;
        }
    }

    // Init routes
    newRoute.num_routes = depotIndexSize - 1;
    newRoute.routes = [new Array(MIN_VEHICLES * 2)];
    newRoute.routes_sizes = new Array(MIN_VEHICLES * 2);

    // Fill routes
    for (i = 0; i < depotIndexSize - 1; i++) {
        let from = depotIndexes[i];
        let to = depotIndexes[i + 1];
        newRoute.routes[i] = new Array(NUM_OF_CUSTOMERS);
        // Cut route from tour in the interval [from, to]
        k = 0;
        for (j = from; j < to + 1; j++) {
            node = sol.tour[j];
            // Filter charging stations out of the routes but keeping the depot
            if (!is_charging_station(node) || node === DEPOT) {
                newRoute.routes[i][k] = node;
                k++;
            }
        }
        // Update route size
        newRoute.routes_sizes[i] = k;
    }
    
    return newRoute;
}

/**
 * Rebuilds the tour from a routes object, while putting charging stations
 * where is needed.
 */
export function closeRoutes(routeObj: Routes): Solution {
    let p = 1;
    let j = 0;
    let k = 0;
    let tour: number[] = new Array(routeObj.solution.tour_size);
    let to: number = 0;

    // rebuild tour with stations
    tour[0] = 0;
    for (j = 0; j < routeObj.num_routes; j++) {

        // Perform local search at a given probability
        if (rand(100) < Parameters.onCloseRoutesChanceLocalSearch) {
            localSearch(routeObj.routes[j], routeObj.routes_sizes[j]);
        }

        routeObj.routes_sizes[j] = fixRouteEnergy(routeObj.routes[j], routeObj.routes_sizes[j]);

        // transfer new route to tour
        for (k = 1; k < routeObj.routes_sizes[j]; k++) {
            to = routeObj.routes[j][k];
            tour[p] = to;
            p++;
        }
    }
    routeObj.solution.tour = tour;
    routeObj.solution.steps = p;

    return routeObj.solution;
}

/**
 * Tries to put a charging station between an arc that violates battery capacity
 * and if it's not possible, go back as many arcs is needed to put the charging station
 */
export function fixRouteEnergy(route: number[], route_size: number): number {
    let i = 0;
    let j = 0;
    //let tmp: number;
    let energyTemp = 0;
    let station = -1;

    while (i < route_size) {
        let from = route[i];
        let to = route[i + 1];

        if (energyTemp + get_energy_consumption(from, to) > BATTERY_CAPACITY) {
            station = -1;
            while (station === -1) {
                station = getNearestStation(route[i], energyTemp);
                if (station !== -1) {
                    // shift elements
                    for (j = route_size - 1; j > i; j--) {
                        route[j + 1] = route[j];
                    }
                    route[i + 1] = station;
                    route_size++;
                } else {
                    i--;
                    energyTemp -= get_energy_consumption(route[i], route[i + 1]);
                }
            }
            // set index on the new station
            i++;
            energyTemp = 0;
            continue;
        }

        energyTemp += get_energy_consumption(from, to);
        i++;
    }
    return route_size;
}

/**
 * Find the nearest charging station from a client given it's current energy level.
 * Returns -1 if no station can be reached
 */
export function getNearestStation(from: number, currentEnergy: number): number {
    let i: number = 0;
    let tmp: number = Number.MAX_SAFE_INTEGER;
    let consumption: number = 0;
    let nearest: number = -1;
    for (i = NUM_OF_CUSTOMERS + 1; i < ACTUAL_PROBLEM_SIZE; i++) {
        consumption = get_energy_consumption(from, i);
        if (currentEnergy + consumption <= BATTERY_CAPACITY && consumption < tmp) {
            nearest = i;
            tmp = consumption;
        }
    }
    return nearest;
}
