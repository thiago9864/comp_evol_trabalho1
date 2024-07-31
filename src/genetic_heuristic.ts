import prand from "pure-rand";
import {
    ACTUAL_PROBLEM_SIZE,
    BATTERY_CAPACITY,
    check_solution,
    DEPOT,
    fitness_evaluation,
    get_customer_demand,
    get_distance,
    get_energy_consumption,
    is_charging_station,
    MAX_CAPACITY,
    MIN_VEHICLES,
    NUM_OF_CUSTOMERS,
    print_solution,
} from "./evrp";
import { closeRoutes, fixRouteEnergy, getNearestStation, localSearch, openRoutes } from "./aux_functions";
import { Parameters } from "./parameters";

export class Solution {
    tour: number[] = []; // this is what the fitness_evaluation function in EVRP.hpp will evaluate
    id: number = 0;
    tour_length: number = 0; // quality of the solution
    steps: number = 0; //size of the solution
    tour_size: number = 0; //max size of the tour array
    modified: boolean = true;
    //the format of the solution is as follows:
    //*tour:  0 - 5 - 6 - 8 - 0 - 1 - 2 - 3 - 4 - 0 - 7 - 0
    //*steps: 12
    //this solution consists of three routes:
    //Route 1: 0 - 5 - 6 - 8 - 0
    //Route 2: 0 - 1 - 2 - 3 - 4 - 0
    //Route 3: 0 - 7 - 0
}
export class Routes {
    routes: number[][] = [];
    routes_sizes: number[] = [];
    num_routes: number = 0;
    solution: Solution = new Solution();
}

let best_sol: Solution;
let rng_loc: prand.RandomGenerator;

/****** genetic heuristic variables ********/
let population: Solution[];
let population_selected: Solution[];
let pop_selected_routes: Routes[];
let p_id: number = 1;
let m: number = 0;
let selectedPopSize: number = 0;
let solution_gap: number = Number.MAX_SAFE_INTEGER;

// Debug variables
let startDate: Date;
let trials: Array<{ seconds: number; current_best: number }> = [];

/**
 * Returns a random integer in the interval 0 <= x <= max
 * @param max Max value to return
 * @returns random number
 */
export function rand(max: number) {
    if (max === 0) {
        return 0;
    }
    let [r, rng] = prand.uniformIntDistribution(0, max, rng_loc);
    rng_loc = rng;
    return r;
}

/*initialize the structure of your heuristic in this function*/
export function initialize_heuristic(rng1: prand.RandomGenerator) {
    rng_loc = rng1;
    p_id = 1;
    best_sol = new Solution();
    best_sol.tour = new Array();
    best_sol.id = p_id;
    best_sol.steps = 0;
    best_sol.tour_length = Number.MAX_SAFE_INTEGER;
    p_id++;

    startDate = new Date();
    trials = [];

    // init population
    population = init_population_greedy(Parameters.populationSize);
    //population = init_population(populationSize);
    //population = init_population_random(populationSize);

    // upper bound for e-n23-k3
    // let optimal_sol = new Solution();
    // optimal_sol.tour = [0,6,1,2,31,3,16,15,14,17,22,29,20,19,18,0,12,11,9,8,25,5,4,21,7,0,10,13,0];
    // optimal_sol.id = p_id;
    // optimal_sol.steps = 29;
    // optimal_sol.tour_size = 23*3;
    // optimal_sol.tour_length = 9999;
    // optimal_sol.modified=true;
    // population[0] = optimal_sol;
    // check_solution(optimal_sol.tour, optimal_sol.steps);

    // upper bound for e-n51-k5
    // let optimal_sol = new Solution();
    // optimal_sol.tour = [0,1,22,28,3,36,35,20,59,29,21,34,30,46,0,32,2,16,50,9,49,5,12,0,11,38,10,57,39,33,45,15,44,37,17,4,47,0,42,51,19,40,41,13,25,14,6,27,0,18,24,43,53,23,7,26,31,8,48,0];
    // optimal_sol.id = p_id;
    // optimal_sol.steps = 60;
    // optimal_sol.tour_size = 51*3;
    // optimal_sol.tour_length = 9999;
    // optimal_sol.modified=true;
    // population[0] = optimal_sol;
    // check_solution(optimal_sol.tour, optimal_sol.steps);

    pop_selected_routes = new Array<Routes>(Parameters.selectedPopulationSize * 2);
    population_selected = new Array<Solution>(Parameters.selectedPopulationSize * 2);
}

/*implement your heuristic in this function*/

export function get_best_sol(): Solution {
    return best_sol;
}

export function run_heuristic() {
    evaluate_population();

    // Get current best and save it
    solution_gap = Math.abs(population[0].tour_length - best_sol.tour_length);

    if (solution_gap > 0.1) {
        // save the best solution in a error margin
        best_sol.id = population[0].id;
        best_sol.tour = Array.from(population[0].tour);
        best_sol.tour_length = population[0].tour_length;
        best_sol.steps = population[0].steps;
        best_sol.tour_size = population[0].tour_size;

        trials.push({
            seconds: Math.round((new Date().getTime() - startDate.getTime()) / 10) / 100,
            current_best: population[0].tour_length,
        });
    }
    select_by_tournament();

    // Open tours into routes for the recombine and mutation steps
    // this way the charge restriction don't get in the way

    // get routes
    for (m = 0; m < selectedPopSize; m++) {
        pop_selected_routes[m] = openRoutes(population_selected[m]);
        //check_route(pop_selected_routes[m], "for open routes - saida");
    }

    if (solution_gap < 0.1 || rand(100) < Parameters.probMutationInsertionInRoute) {
        mutation_by_insertion_in_route();
    }
    if (rand(100) < Parameters.probMutationSwap) {
        mutation_by_swap();
    }
    if (solution_gap < 0.1 || rand(100) < Parameters.probMutationInsertionBetweenRoutes) {
        mutation_by_insertion_between_routes();
    }

    recombine();

    // Rebuild tours and put them back into the solutions list
    // it's expected to be more than 20% of the population here from recombine
    for (m = 0; m < selectedPopSize; m++) {
        population_selected[m] = closeRoutes(pop_selected_routes[m]);
    }

    replace_population();

    //For debug purposes
    // for (let i = 0; i < populationSize; i++) {
    //     check_solution(population[i].tour, population[i].steps);
    // }
}

/* main functions */

/**
 * Generates random (bad) valid solutions
 */
export function init_population(size: number): Array<Solution> {
    let p: number = 0;
    let i: number = 0;
    let clients: number[] = [];
    let clientsVisited = new Array<boolean>(NUM_OF_CUSTOMERS);
    let numClientsVisited: number = 0;
    let numClientsRoute: number = 0;
    let currentSol: Solution;
    let chargingStation: number | null = 0;
    let from: number = 0;
    let to: number = 0;
    let from_to_comsumption: number = 0;
    let capacityTemp: number = 0;
    let energyTemp: number = 0;
    let isChargeOk = false;
    let isCapacityOk = false;
    let flagCloseRoute = false;
    let flagCloseSolution = false;
    let routeLimit: number = Math.ceil(NUM_OF_CUSTOMERS / MIN_VEHICLES);

    let populationGenerated = new Array<Solution>(size);

    // generate solutions until populationSize is reached
    p = 0;
    while (p < size) {
        clients = generateShuffledArray();

        // Init clients visited
        numClientsVisited = 0;
        for (i = 0; i < NUM_OF_CUSTOMERS; i++) {
            clientsVisited[i] = false;
        }

        // New instance solution
        currentSol = new Solution();
        currentSol.tour_size = Math.round(NUM_OF_CUSTOMERS * 2.5);
        currentSol.tour = new Array<number>(currentSol.tour_size);
        currentSol.tour[0] = DEPOT;
        currentSol.id = p_id;
        currentSol.steps = 1;
        currentSol.tour_length = Number.MAX_SAFE_INTEGER;
        p_id++;

        i = 0;
        capacityTemp = 0;
        energyTemp = 0;
        numClientsRoute = 0;
        flagCloseRoute = false;
        flagCloseSolution = false;

        // Generate routes
        while (numClientsVisited <= NUM_OF_CUSTOMERS + 10) {
            // get origin
            from = currentSol.tour[currentSol.steps - 1];

            // get a destination
            to = clients[i];

            if (i >= NUM_OF_CUSTOMERS) {
                // All costumers already tested. Close route
                flagCloseRoute = true;
            }
            if (!flagCloseRoute && numClientsRoute > routeLimit) {
                // Limits the route size to ensure at least 3 routes are created
                flagCloseRoute = true;
            }

            if (!flagCloseRoute && clientsVisited[to - 1]) {
                // Skip clients already visited
                i++;
                if (i >= NUM_OF_CUSTOMERS) {
                    // All costumers already tested. Close route
                    flagCloseRoute = true;
                } else {
                    continue;
                }
            }

            if (!flagCloseRoute) {
                from_to_comsumption = get_energy_consumption(from, to) + energyTemp;

                // get nearest charging station from destination
                chargingStation = getNearestStation(to, energyTemp + from_to_comsumption);

                // Build conditions
                isChargeOk = chargingStation > 0;
                isCapacityOk = capacityTemp + get_customer_demand(to) <= MAX_CAPACITY;

                if (!flagCloseRoute && numClientsVisited >= NUM_OF_CUSTOMERS) {
                    // All clients were visited. Close the route
                    flagCloseRoute = true;
                } else if (!isCapacityOk) {
                    // insuficient capacity to make the route
                    // skip client
                    i++;
                    continue;
                } else if (!isChargeOk) {
                    // insuficient charge to complete the route from->to->[nearest station]
                    // get nearest charging station from origin
                    chargingStation = getNearestStation(from, energyTemp);
                    if (chargingStation > 0) {
                        // put chargin station on the route
                        energyTemp = 0;
                        currentSol.tour[currentSol.steps] = chargingStation;
                        currentSol.steps++;

                        // now save destination
                        capacityTemp += get_customer_demand(to);
                        energyTemp += get_energy_consumption(chargingStation, to);
                        currentSol.tour[currentSol.steps] = to;
                        currentSol.steps++;
                        i++;
                        numClientsRoute++;
                        numClientsVisited++;
                        clientsVisited[to - 1] = true;

                        continue;
                    } else {
                        throw new Error("[open route] Car is stuck at client " + from);
                    }
                } else {
                    // Capacity and charge are ok
                    // save destination
                    capacityTemp += get_customer_demand(to);
                    energyTemp += get_energy_consumption(from, to);
                    currentSol.tour[currentSol.steps] = to;
                    currentSol.steps++;
                    i++;
                    numClientsRoute++;
                    numClientsVisited++;
                    clientsVisited[to - 1] = true;
                    continue;
                }
            } else {
                from_to_comsumption = get_energy_consumption(from, DEPOT) + energyTemp;

                if (from_to_comsumption <= BATTERY_CAPACITY) {
                    // can go directly to the depot
                    currentSol.tour[currentSol.steps] = DEPOT;
                    currentSol.steps++;

                    if (numClientsVisited >= NUM_OF_CUSTOMERS) {
                        // If all clients were visited, close the loop
                        flagCloseSolution = true;
                    }
                } else {
                    // can't go directly. Recharge first
                    chargingStation = getNearestStation(from, energyTemp);
                    if (chargingStation > 0) {
                        energyTemp += get_energy_consumption(from, chargingStation);
                        currentSol.tour[currentSol.steps] = chargingStation;
                        currentSol.steps++;

                        // now can go to the depot
                        currentSol.tour[currentSol.steps] = DEPOT;
                        currentSol.steps++;

                        if (numClientsVisited >= NUM_OF_CUSTOMERS) {
                            // If all clients were visited, close the loop
                            flagCloseSolution = true;
                        }
                    } else {
                        throw new Error("[closed route] Car is stuck at client " + from);
                    }
                }

                // reset route
                i = 0;
                capacityTemp = 0;
                energyTemp = 0;
                numClientsRoute = 0;
                flagCloseRoute = false;

                if (flagCloseSolution) {
                    break;
                }
            }
        }
        populationGenerated[p] = currentSol;
        p++;
    }

    return populationGenerated;
}

/**
 * Original random heuristic that generates invalid solutions
 */
export function init_population_random(size: number): Array<Solution> {
    let p: number = 0;
    let i: number;
    let r: number[];
    let energy_temp: number = 0.0;
    let capacity_temp: number = 0.0;
    let from: number;
    let to: number;
    let charging_station: number;
    let best_sol: Solution;

    let populationGenerated = new Array<Solution>(size);

    // generate solutions until populationSize is reached
    p = 0;
    while (p < size) {
        /*generate a random solution for the random heuristic*/
        energy_temp = 0;
        capacity_temp = 0;
        r = generateShuffledArray();
        best_sol = new Solution();
        best_sol.steps = 0;
        best_sol.tour_length = Number.MAX_SAFE_INTEGER;
        best_sol.id = p_id;
        best_sol.tour_size = Math.round(NUM_OF_CUSTOMERS * 2.5);
        best_sol.tour = new Array<number>(best_sol.tour_size);
        best_sol.tour[0] = DEPOT;
        best_sol.steps++;
        p_id++;

        i = 0;
        while (i < NUM_OF_CUSTOMERS) {
            from = best_sol.tour[best_sol.steps - 1];
            to = r[i];
            if (
                capacity_temp + get_customer_demand(to) <= MAX_CAPACITY &&
                energy_temp + get_energy_consumption(from, to) <= BATTERY_CAPACITY
            ) {
                capacity_temp += get_customer_demand(to);
                energy_temp += get_energy_consumption(from, to);
                best_sol.tour[best_sol.steps] = to;
                best_sol.steps++;
                i++;
            } else if (capacity_temp + get_customer_demand(to) > MAX_CAPACITY) {
                capacity_temp = 0.0;
                energy_temp = 0.0;
                best_sol.tour[best_sol.steps] = DEPOT;
                best_sol.steps++;
            } else if (energy_temp + get_energy_consumption(from, to) > BATTERY_CAPACITY) {
                charging_station =
                    (rand(Number.MAX_SAFE_INTEGER) % (ACTUAL_PROBLEM_SIZE - NUM_OF_CUSTOMERS - 1)) +
                    NUM_OF_CUSTOMERS +
                    1;
                if (is_charging_station(charging_station) == true) {
                    energy_temp = 0.0;
                    best_sol.tour[best_sol.steps] = charging_station;
                    best_sol.steps++;
                }
            } else {
                capacity_temp = 0.0;
                energy_temp = 0.0;
                best_sol.tour[best_sol.steps] = DEPOT;
                best_sol.steps++;
            }
        }

        //close EVRP tour to return back to the depot
        if (best_sol.tour[best_sol.steps - 1] != DEPOT) {
            best_sol.tour[best_sol.steps] = DEPOT;
            best_sol.steps++;
        }

        populationGenerated[p] = best_sol;
        p++;
    }

    return populationGenerated;
}

/**
 * From a random customer permutation generates n>=MIN_VEHICLES clusters respecting the
 * capacity constraint, then perform a local search, put charging stations and build the
 * the tour for the solution.
 * Based on the article 'A Greedy Search based Evolutionary Algorithm for Electric Vehicle Routing Problem'
 * by Vu Quoc Hien, Tran Cong Dao, Huynh Thi Thanh Binh
 */
function init_population_greedy(size: number): Array<Solution> {
    let i: number;
    let j: number;
    let k: number;
    let p: number;
    let w: number;
    let customersVisited: number;
    let pSeed: number;
    let node: number;
    let nearestNode: number;
    let tmp: number;
    let clusters: number[][];
    let clusterSizes: number[];
    let visited: boolean[];
    let tour: number[];
    let capacityTemp: number;
    let customerList: number[];
    let maxClusterSize = Math.floor(NUM_OF_CUSTOMERS / MIN_VEHICLES);
    let numClusters: number;

    let populationGenerated = new Array<Solution>(size);

    // generate solutions until populationSize is reached
    w = 0;
    while (w < size) {
        // init arrays
        clusters = new Array(MIN_VEHICLES);
        clusterSizes = new Array(MIN_VEHICLES);
        visited = new Array(NUM_OF_CUSTOMERS);
        tour = new Array(NUM_OF_CUSTOMERS * 2);

        // get shuffled customer list
        customerList = generateShuffledArray();

        // init visited list
        visited = new Array(NUM_OF_CUSTOMERS).fill(false);

        // generate clusters
        p = 0;
        customersVisited = 0;
        numClusters = 0;
        while (customersVisited < NUM_OF_CUSTOMERS) {
            pSeed = rand(NUM_OF_CUSTOMERS - 1) + 1;
            while (visited[pSeed - 1]) {
                pSeed = rand(NUM_OF_CUSTOMERS - 1) + 1;
            }
            clusters[p] = new Array(NUM_OF_CUSTOMERS);
            clusters[p][0] = DEPOT;
            clusters[p][1] = pSeed;
            clusterSizes[p] = 2;
            visited[pSeed - 1] = true;
            capacityTemp = get_customer_demand(pSeed);
            customersVisited++;
            numClusters++;
            k = 2;
            nearestNode = Number.MAX_SAFE_INTEGER;
            while (nearestNode > 0) {
                // get nearest customer of pSeed
                tmp = Number.MAX_SAFE_INTEGER;
                nearestNode = -1;
                for (j = 0; j < NUM_OF_CUSTOMERS; j++) {
                    node = customerList[j];
                    if (
                        !visited[node - 1] &&
                        get_distance(pSeed, node) < tmp &&
                        capacityTemp + get_customer_demand(node) < MAX_CAPACITY &&
                        clusterSizes[p] <= maxClusterSize
                    ) {
                        tmp = get_distance(pSeed, node);
                        nearestNode = node;
                    }
                }

                if (nearestNode > 0) {
                    clusters[p][k++] = nearestNode;
                    visited[nearestNode - 1] = true;
                    clusterSizes[p] += 1;
                    capacityTemp += get_customer_demand(nearestNode);
                    customersVisited++;
                }
            }
            p++;
            if (p > NUM_OF_CUSTOMERS) {
                console.log("visited", visited);
                throw new Error("loop infinito");
            }
        }

        tour[0] = DEPOT;
        p = 1;
        for (i = 0; i < numClusters; i++) {
            // insert depot at end
            clusters[i][clusterSizes[i]++] = DEPOT;
            // put charging stations
            clusterSizes[i] = fixRouteEnergy(clusters[i], clusterSizes[i]);
            // perform local search
            localSearch(clusters[i], clusterSizes[i]);
            // transfer new route to tour
            for (k = 1; k < clusterSizes[i]; k++) {
                tmp = clusters[i][k];
                tour[p] = tmp;
                p++;
            }
        }

        let solution: Solution = new Solution();
        solution.id = p_id;
        solution.tour = tour;
        solution.tour_size = Math.round(NUM_OF_CUSTOMERS * 2.5);
        solution.steps = p;
        p_id++;

        populationGenerated[w] = solution;
        w++;
    }
    return populationGenerated;
}

/**
 * Generates a random permutation of the customers
 */
function generateShuffledArray(): number[] {
    let r = new Array<number>(NUM_OF_CUSTOMERS);
    let i: number = 0;
    let object: number = 0;
    let help: number = 0;

    //set indexes of customers, minus the depot
    for (i = 0; i < NUM_OF_CUSTOMERS; i++) {
        if (i + 1 !== DEPOT) {
            r[i] = i + 1;
        }
    }

    // randomly change indexes of objects
    for (i = 0; i < NUM_OF_CUSTOMERS - 1; i++) {
        object = Math.floor((rand(Number.MAX_SAFE_INTEGER) / Number.MAX_SAFE_INTEGER) * (NUM_OF_CUSTOMERS - i - 1));
        help = r[i];
        r[i] = r[i + object];
        r[i + object] = help;
    }
    return r;
}

/**
 * Evaluates modified solutions
 */
function evaluate_population() {
    m = 0;
    for (m = 0; m < Parameters.populationSize; m++) {
        if (population[m].modified) {
            population[m].tour_length = fitness_evaluation(population[m].tour, population[m].steps);
            population[m].modified = false;
        }
    }
    // Sort asc the population
    population.sort((a, b) => a.tour_length - b.tour_length);
}

/**
 * Selection by tournament. 3 random solutions from all population range
 * are selected, them the best is selected until selectedPopulationSize
 */
function select_by_tournament() {
    let i = 0;
    let j = 0;
    let s = 0;
    let n = 0;
    let v = 0;
    let c_sel: number[] = Array(3);
    let c_win: number;
    let c: Solution;
    let candidates: Solution[] = new Array<Solution>(3);
    let visited = new Array<boolean>(Parameters.populationSize);

    selectedPopSize = Parameters.selectedPopulationSize;

    // init visited array
    for (i = 0; i < Parameters.populationSize; i++) {
        visited[i] = false;
    }

    i = 0;
    while (s < selectedPopSize) {
        // select candidates randomly
        n = 0;
        c_sel[0] = rand(Parameters.populationSize - 1);
        c = population[c_sel[0]];
        candidates[n++] = c;

        v = 0;
        while (n < 3) {
            j = rand(Parameters.populationSize - 1);
            c = population[j];
            if (!visited[j]) {
                if (n == 1 && candidates[0].id !== c.id) {
                    candidates[n++] = c;
                    c_sel[1] = j;
                } else if (candidates[0].id !== c.id && candidates[1].id !== c.id) {
                    candidates[n++] = c;
                    c_sel[2] = j;
                }
            }
            v++;
            if (v > 1000) {
                console.log("visited", visited.join(","));
                throw new Error("[select_by_tournament] Stuck!");
            }
        }

        // Compare 0 and 1
        if (candidates[0].tour_length <= candidates[1].tour_length) {
            c = candidates[0];
            c_win = c_sel[0];
        } else {
            c = candidates[1];
            c_win = c_sel[1];
        }
        // Compare best between 0 and 1 with 2
        if (candidates[2].tour_length <= c.tour_length) {
            c = candidates[2];
            c_win = c_sel[2];
        }

        let sol = new Solution();
        sol.id = c.id;
        sol.steps = c.steps;
        sol.tour = Array.from(c.tour);
        sol.tour_length = c.tour_length;
        sol.tour_size = c.tour_size;
        sol.modified = c.modified;
        population_selected[s] = sol;

        s++;
        visited[c_win] = true;
    }
}

/**
 * Function that provides the recombination heuristics with the permutation of customers
 * for the tour, without the depot or charging stations and rebuilds the routes when
 * finished
 */
function recombine() {
    let i = 0;
    let j = 0;
    let k = 0;
    let p = 0;
    let child: Routes;
    let s1: Solution;
    let s2: Solution;
    let customerList1: number[] = new Array(NUM_OF_CUSTOMERS);
    let customerList2: number[] = new Array(NUM_OF_CUSTOMERS);
    let customerListChild: number[] = new Array(NUM_OF_CUSTOMERS);
    let visited: boolean[];
    let tmpCapacity: number;
    let node: number;
    let customersRemaining: number;
    let numPairs = Math.floor(selectedPopSize / 2);

    // ensure the number of pairs is even
    if (numPairs % 2 !== 0) {
        numPairs -= 1;
    }

    // create pairs
    for (p = 0; p < numPairs; p++) {
        // extract solution
        s1 = pop_selected_routes[2 * p].solution;
        s2 = pop_selected_routes[2 * p + 1].solution;

        //check_route(pop_selected_routes[2 * p], "recombine - entrada 1");
        //check_route(pop_selected_routes[2 * p + 1], "recombine - entrada 2");

        // build client lists
        k = 0;
        p = 0;
        for (j = 0; j < s1.tour_size; j++) {
            if (s1.tour[j] && !is_charging_station(s1.tour[j])) {
                customerList1[k++] = s1.tour[j];
            }
            if (s2.tour[j] && !is_charging_station(s2.tour[j])) {
                customerList2[p++] = s2.tour[j];
            }
        }

        // Init child route
        child = new Routes();
        child.solution.id = p_id;
        child.solution.tour_size = NUM_OF_CUSTOMERS * 2;
        child.solution.modified = true;
        p_id++;

        /////////// Recombination of pairs ///////////

        customerListChild = crossover_1(customerList1, customerList2);

        //////////////////////////////////////////////

        // rebuild routes by capacity
        child.num_routes = 1;
        child.routes = [new Array(MIN_VEHICLES * 2)];
        child.routes_sizes = new Array(MIN_VEHICLES * 2);
        visited = new Array(NUM_OF_CUSTOMERS).fill(false);

        customersRemaining = NUM_OF_CUSTOMERS;
        k = 0;

        while (customersRemaining > 0) {
            // init new route
            child.routes[k] = new Array(NUM_OF_CUSTOMERS);
            child.routes[k][0] = DEPOT;
            child.routes_sizes[k] = 1;
            tmpCapacity = 0;
            j = 1;

            // fill route
            for (i = 0; i < NUM_OF_CUSTOMERS; i++) {
                node = customerListChild[i];
                if (!visited[i] && tmpCapacity + get_customer_demand(node) < MAX_CAPACITY) {
                    child.routes[k][j] = node;
                    child.routes_sizes[k] += 1;
                    tmpCapacity += get_customer_demand(node);
                    j++;
                    customersRemaining--;
                    visited[i] = true;
                }
            }

            // close route
            child.routes[k][j] = DEPOT;
            child.routes_sizes[k] += 1;
            k++;
            child.num_routes = k;

            if (k > 22) {
                console.log("customerList1", customerList1);
                console.log("customerList1 sort", customerList1.sort((a,b)=>a-b));
                console.log("customerList2", customerList2);
                console.log("customerList2 sort", customerList2.sort((a,b)=>a-b));
                console.log("customerListChild", customerListChild);
                console.log("customerListChild sort", customerListChild.sort((a,b)=>a-b));
                throw new Error("[recombine] loop infinito");
            }
        }

        // add child to the selected population
        pop_selected_routes[selectedPopSize] = child;
        selectedPopSize++;
        //check_route(child, "recombine - saida");
    }
}

/**
 * Simple crossover that cuts a % of one of the parents decided by the probab. 'crossoverCutChance'
 * and gets nodes from the another parent preserving the order
 */
function crossover_1(p1: number[], p2: number[]): number[] {
    let i = 0;
    let j = 0;
    let k = 0;
    let cutSize: number = Math.floor(Parameters.crossoverCutPercentage * NUM_OF_CUSTOMERS);
    let cutStart = rand(NUM_OF_CUSTOMERS - cutSize);
    let pCut: number[] = p1;
    let pNodes: number[] = p2;
    let child: number[] = new Array(NUM_OF_CUSTOMERS);

    // decide who will be cutted and who will donate nodes
    if (rand(100) < Parameters.crossoverCutChance) {
        pCut = p2;
        pNodes = p1;
    }

    // transfer cut to child
    for (i = cutStart; i < cutStart + cutSize; i++) {
        child[i] = pCut[i];
    }

    // transfer nodes from donner to child
    i = cutStart + cutSize;
    j = i;
    while (k < NUM_OF_CUSTOMERS) {
        if (i >= NUM_OF_CUSTOMERS) {
            i = 0;
        }
        if (j >= NUM_OF_CUSTOMERS) {
            j = 0;
        }
        if (!child.includes(pNodes[j])) {
            child[i] = pNodes[j];
            i++;
        }
        j++;
        k++;
    }

    return child;
}

/**
 * For each route of the solution select p1 and p2. If p1>p2 then
 * inserts p2 in p1
 */
function mutation_by_insertion_in_route() {
    let route: Routes;
    let i = 0;
    let j = 0;
    let k = 0;
    let p1: number;
    let p2: number;
    let gene: number;
    let tmp: number;
    let route_size: number;

    //console.log("mutation");
    for (i = 0; i < Parameters.selectedPopulationSize; i++) {
        route = pop_selected_routes[i];

        //check_route(route, "mutation_by_insertion_in_route - entrada");

        // Mutation by insertion
        for (j = 0; j < route.num_routes; j++) {
            route_size = route.routes_sizes[j];

            if(route_size <= 3){
                // Don't mutate routes with one gene
                continue;
            }

            // Select 2 random positions from 1 to n-1 to avoid the depot
            p1 = rand(route_size - 4) + 1; // position      0 1 2 [3] 4 {5} 0 // 7, p1 [1,4], p2=5

            if (p1 >= route_size - 3) {
                // if there's only one gene ahead go to this gene
                p2 = p1 + 1;
            } else {
                // if there's more than one gene ahead, choose it randomly
                p2 = rand(route_size - 3 - p1) + 1 + p1; // gene 
            }

            // store the gene
            gene = route.routes[j][p2];

            // Shift genes from p1+1 to p2
            for (k = p2; k > p1; k--) {
                route.routes[j][k] = route.routes[j][k - 1];
            }

            // replace p1
            route.routes[j][p1] = gene;

            route.solution.modified = true;
            //check_route(route, "mutation_by_swap - saida");
            
        }
    }

}

/**
 * Tries to get a node from one route and put in another. If can go both ways chooses
 * the route with more capacity free to receive the node.
 */
function mutation_by_insertion_between_routes() {
    let route: Routes;
    let i = 0;
    let j = 0;
    let r1: number;
    let r2: number;
    let p1: number;
    let p2: number;
    let c1: number;
    let c2: number;
    let node1: number;
    let node2: number;
    let move21: boolean;
    let move12: boolean;
    let canDestroyRoute: boolean;

    for (j = 0; j < selectedPopSize; j++) {
        route = pop_selected_routes[j];
        //check_route(route, "mutation_by_insertion_between_routes - entrada");

        // choose two random routes
        r2 = r1 = rand(route.num_routes - 1);
        while (r1 === r2) {
            r2 = rand(route.num_routes - 1);
        }

        // choose random point of each route
        p1 = rand(route.routes_sizes[r1] - 3) + 1;
        p2 = rand(route.routes_sizes[r2] - 3) + 1;
        node1 = route.routes[r1][p1];
        node2 = route.routes[r2][p2];

        // calculate capacity of each route
        c1 = c2 = 0;
        for (i = 0; i < route.routes_sizes[r1]; i++) {
            c1 += get_customer_demand(route.routes[r1][i]);
        }
        for (i = 0; i < route.routes_sizes[r2]; i++) {
            c2 += get_customer_demand(route.routes[r2][i]);
        }

        canDestroyRoute = route.num_routes > MIN_VEHICLES;
        move21 = c1 + get_customer_demand(node2) < MAX_CAPACITY && (canDestroyRoute || route.routes_sizes[r2] > 3);
        move12 = c2 + get_customer_demand(node1) < MAX_CAPACITY && (canDestroyRoute || route.routes_sizes[r1] > 3);

        if (move21 && move12) {
            if (rand(100) < 50) {
                // 2 -> 1
                route.routes[r2].splice(p2, 1);
                route.routes_sizes[r2] -= 1;
                route.routes[r1].splice(p1, 0, node2);
                route.routes_sizes[r1] += 1;
            } else {
                // 1 -> 2
                route.routes[r1].splice(p1, 1);
                route.routes_sizes[r1] -= 1;
                route.routes[r2].splice(p2, 0, node1);
                route.routes_sizes[r2] += 1;
            }
        } else if (move21) {
            // 2 -> 1
            route.routes[r2].splice(p2, 1);
            route.routes_sizes[r2] -= 1;
            route.routes[r1].splice(p1, 0, node2);
            route.routes_sizes[r1] += 1;
        } else if (move12) {
            // 1 -> 2
            route.routes[r1].splice(p1, 1);
            route.routes_sizes[r1] -= 1;
            route.routes[r2].splice(p2, 0, node1);
            route.routes_sizes[r2] += 1;
        }

        // Clean if one of the routes became empty
        if (route.routes_sizes[r2] <= 2) {
            route.routes_sizes.splice(r2, 1);
            route.routes.splice(r2, 1);
            route.num_routes -= 1;
        } else if (route.routes_sizes[r1] <= 2) {
            route.routes_sizes.splice(r1, 1);
            route.routes.splice(r1, 1);
            route.num_routes -= 1;
        }

        route.solution.modified = true;
    }
}

/**
 * swaps one node from a route to another
 */
function mutation_by_swap() {
    let route: Routes;
    let i = 0;
    let j = 0;
    let r1: number;
    let r2: number;
    let p1: number;
    let p2: number;
    let c1: number;
    let c2: number;
    let node1: number;
    let node2: number;

    for (j = 0; j < selectedPopSize; j++) {
        route = pop_selected_routes[j];

        //check_route(route, "mutation_by_swap - entrada");

        // choose two random routes
        r2 = r1 = rand(route.num_routes - 1);
        while (r1 === r2) {
            r2 = rand(route.num_routes - 1);
        }
        // choose random point of each route
        p1 = rand(route.routes_sizes[r1] - 3) + 1;
        p2 = rand(route.routes_sizes[r2] - 3) + 1;
        node1 = route.routes[r1][p1];
        node2 = route.routes[r2][p2];

        // calculate capacity of each route without p1 and p2
        c1 = c2 = 0;
        for (i = 0; i < route.routes_sizes[r1]; i++) {
            if (i !== p1) {
                c1 += get_customer_demand(route.routes[r1][i]);
            }
        }
        for (i = 0; i < route.routes_sizes[r2]; i++) {
            if (i !== p2) {
                c2 += get_customer_demand(route.routes[r2][i]);
            }
        }

        // test if can swap p1 and p2
        if (c1 + get_customer_demand(node2) < MAX_CAPACITY && c2 + get_customer_demand(node1) < MAX_CAPACITY) {
            route.routes[r1][p1] = node2;
            route.routes[r2][p2] = node1;
        }

        route.solution.modified = true;
        //check_route(route, "mutation_by_swap - saida");
    }
}

/**
 * Replace selected randomly in the range from half to bottom of the population
 * since the list is asc order, the bottom half contains the worst solutions
 */
function replace_population() {
    let i: number = 0;
    let k: number = 0;
    let p: number = 0;
    let half = Math.floor(Parameters.populationSize / 2);
    let mem: boolean[] = new Array(Parameters.populationSize);
    let sol: Solution;
    let new_sol: Solution;

    // init memory array
    // this array ensures a position on the population array is not
    // used two times
    for (i = 0; i < Parameters.populationSize; i++) {
        mem[i] = false;
    }

    if (
        solution_gap < 0.1 &&
        Parameters.numNewSolutions > 0 &&
        Parameters.numNewSolutions < Parameters.selectedPopulationSize
    ) {
        // is stuck in a local minimal
        // input new solutions
        let new_solutions = init_population(Parameters.numNewSolutions);
        for (i = 0; i < Parameters.numNewSolutions; i++) {
            population_selected[selectedPopSize] = new_solutions[i];
            selectedPopSize++;
        }
    }

    // select a position and replace with new solution
    k = 0;
    while (k < selectedPopSize) {
        p = rand(half - 1) + (Parameters.populationSize - half);
        if (!mem[p]) {
            //If not selected, replace for new solution
            sol = population_selected[k];

            new_sol = new Solution();
            new_sol.tour_size = sol.tour_size;
            new_sol.tour = Array.from(sol.tour);
            new_sol.id = p_id;
            new_sol.steps = sol.steps;
            new_sol.tour_length = sol.tour_length;
            new_sol.modified = sol.modified;
            p_id++;

            population[p] = new_sol;
            mem[p] = true;
            k++;
        }
    }
}

////////////////////// Debug functions //////////////////////

export function check_route(route: Routes, label: string = "") {
    let i: number;
    let j: number;
    let arr: number[] = [];
    let capacityTemp: number;
    let chargeTemp: number;

    // checa por nós undefined
    for (i = 0; i < route.num_routes; i++) {
        for (j = 0; j < route.routes_sizes[i]; j++) {
            if (route.routes[i][j] === undefined) {
                console.log("rota", route);
                if (label !== "") {
                    console.log("check_route", label);
                }
                throw new Error("rota com nó undefined");
            }
            if (route.routes[i][j] !== DEPOT) {
                arr.push(route.routes[i][j]);
            }
        }
    }

    // checa capacidade e carga do carro nas rotas
    for (i = 0; i < route.num_routes; i++) {
        chargeTemp = BATTERY_CAPACITY;
        capacityTemp = MAX_CAPACITY;
        for (j = 0; j < route.routes_sizes[i] - 1; j++) {
            capacityTemp -= get_customer_demand(route.routes[i][j + 1]);
            //chargeTemp -= get_energy_consumption(route.routes[i][j], route.routes[i][j + 1]);
            if (capacityTemp < 0) {
                if (label !== "") {
                    console.log("check_route", label);
                }
                console.log("rota", route);
                throw new Error("Capacidade excedida (" + String(capacityTemp) + ") na rota : " + String(i));
            }
            if (chargeTemp < 0) {
                console.log("rota", route);
                throw new Error("Carga da bateria excedida (" + String(chargeTemp) + ") na rota: " + String(i));
            }
        }
    }

    // checa se está servindo todos os clientes
    arr.sort((a, b) => a - b);
    for (i = 0; i < NUM_OF_CUSTOMERS; i++) {
        if (arr[i] !== i + 1) {
            if (label !== "") {
                console.log("check_route", label);
            }
            console.log("route obj", JSON.stringify(route, null, 4));
            console.log("i+1", i + 1);
            console.log("arr[i]", arr[i]);
            console.log("num_routes", route.num_routes);
            console.log("routes", route.routes.join(","));
            console.log("routes_sizes", route.routes_sizes.join(","));
            console.log("solution.id", route.solution.id);
            console.log("clientes", arr.join(","));
            throw new Error("nem todos os clientes foram atendidos");
        }
    }
}

export function getTrialsInfo(): Array<{ seconds: number; current_best: number }> {
    // best value registered on the population list
    trials.push({
        seconds: Math.round((new Date().getTime() - startDate.getTime()) / 10) / 100,
        current_best: population[0].tour_length,
    });

    return trials;
}

// function histogram(arr: number[]){
//     let arr2 = new Array(200).fill(0)
//     for(let i=0;i<arr.length;i++){
//         arr2[arr[i]]++
//     }
//     console.log('----- Histogram ------')
//     for(let i=0;i<arr2.length;i++){
//         console.log('index',i,Math.round(arr2[i]*10000/arr.length)/100,"%")
//     }
// }
