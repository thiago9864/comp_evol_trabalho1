import prand from "pure-rand";
import {
    BATTERY_CAPACITY,
    check_solution,
    DEPOT,
    fitness_evaluation,
    get_customer_demand,
    get_distance,
    get_energy_consumption,
    get_evals,
    init_evals,
    is_charging_station,
    MAX_CAPACITY,
    MIN_VEHICLES,
    NUM_OF_CUSTOMERS,
    read_problem,
} from "./evrp";
import { check_route, initialize_heuristic, Routes, Solution } from "./genetic_heuristic";
import { fixRouteEnergy } from "./aux_functions";
let rng_loc: prand.RandomGenerator = prand.xoroshiro128plus(1);

/**
 * Returns a random integer in the interval 0 <= x <= max
 * @param max Max value to return
 * @returns random number
 */
function rand(max: number) {
    if (max === 0) {
        return 0;
    }
    let [r, rng] = prand.uniformIntDistribution(0, max, rng_loc);
    rng_loc = rng;
    return r;
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

read_problem("E-n23-k3.evrp"); //Read EVRP from file from EVRP.h
//read_problem("E-n51-k5.evrp"); //Read EVRP from file from EVRP.h

let sol = {
    tour: [
        0,
        14,
        20,
        29,
        15,
        31,
        1,
        5,
        25,
        2,
        31,
        12,
        13,
        28,
        19,
        0,
        8,
        9,
        25,
        16,
        31,
        17,
        30,
        6,
        28,
        4,
        25,
        11,
        3,
        31,
        7,
        0,
        10,
        28,
        21,
        24,
        18,
        26,
        22,
        0,
        null,
        null,
        null,
        null,
    ],
    id: 149,
    tour_length: 1466.392612673048,
    steps: 40,
    tour_size: 44,
    modified: false,
};
/*
let route = openRoutes(sol as Solution);

console.log("num_routes", route.num_routes);
console.log("route.routes[0]", route.routes[0].join(","), "len", route.routes[0].length);
console.log("route.routes[1]", route.routes[1].join(","), "len", route.routes[1].length);
console.log("route.routes[2]", route.routes[2].join(","), "len", route.routes[2].length);
console.log("route.routes_sizes", route.routes_sizes.join(","));

console.log("--- energia corrigida ----");
route.routes_sizes[0] = fixRouteEnergy(route.routes[0], route.routes_sizes[0]);
route.routes_sizes[1] = fixRouteEnergy(route.routes[1], route.routes_sizes[1]);
route.routes_sizes[2] = fixRouteEnergy(route.routes[2], route.routes_sizes[2]);
console.log("route.routes[0]", route.routes[0].join(","), "len", route.routes[0].length);
console.log("route.routes[1]", route.routes[1].join(","), "len", route.routes[1].length);
console.log("route.routes[2]", route.routes[2].join(","), "len", route.routes[2].length);
console.log("route.routes_sizes", route.routes_sizes.join(","));

check_route(route);
*/
// node --prof-process isolate-0000021A5A8E3F50-5440-v8.log > processed.txt

/* Com quicksort
Days              : 0
Hours             : 0
Minutes           : 2
Seconds           : 7
Milliseconds      : 706
Ticks             : 1277064445
TotalDays         : 0,00147808384837963
TotalHours        : 0,0354740123611111
TotalMinutes      : 2,12844074166667
TotalSeconds      : 127,7064445
TotalMilliseconds : 127706,4445
*/

/* Com a função sort do javascript
Days              : 0
Hours             : 0
Minutes           : 1
Seconds           : 6
Milliseconds      : 317
Ticks             : 663173175
TotalDays         : 0,000767561545138889
TotalHours        : 0,0184214770833333
TotalMinutes      : 1,105288625
TotalSeconds      : 66,3173175
TotalMilliseconds : 66317,3175
*/
let p_id = 0;
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

            console.log("clusters[i]", clusters[i].join(","));

            // perform local search
            localSearch(clusters[i], clusterSizes[i]);

            // put charging stations
            clusterSizes[i] = fixRouteEnergy(clusters[i], clusterSizes[i]);

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
        solution.tour_size = NUM_OF_CUSTOMERS * 2;
        solution.steps = p;
        p_id++;
        // console.log("clusterSizes", clusterSizes);
        // console.log("clusters", clusters);
        // console.log(
        //     "customers",
        //     clusters
        //         .flat()
        //         .sort((a, b) => a - b)
        //         .join(",")
        // );
        // console.log("tour", tour.join(","));

        let route = new Routes();
        route.num_routes = numClusters;
        route.routes = clusters;
        route.routes_sizes = clusterSizes;
        check_route(route);
        //check_solution(solution.tour, solution.steps);
        solution.tour_length = fitness_evaluation(solution.tour, solution.steps);
        console.log(solution);
        populationGenerated[w] = solution;
        w++;
    }
    return populationGenerated;
}

function localSearch_old(route: number[], routeSize: number) {
    let i: number;
    let j: number;
    let k: number;
    let tmp: number;
    let distance: number = 0;
    // Compute route distance
    for (i = 0; i < routeSize - 1; i++) {
        distance += get_distance(route[i], route[i + 1]);
    }
    for (i = 1; i < routeSize - 2; i++) {
        tmp = Number.MAX_SAFE_INTEGER;
        for (j = i + 1; j < routeSize - 1; j++) {
            if (i !== j) {
                tmp = route[i];
                route[i] = route[j];
                route[j] = tmp;
                // Compute modified route distance
                tmp = 0;
                for (k = 0; k < routeSize - 1; k++) {
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
    }
}

function localSearch(route: number[], routeSize: number) {
    let i: number;
    let j: number;
    let k: number;
    let tmp: number;
    let prevDist: number = 0;
    let distance: number = 0;

    //tmpDist = get_distance(route[0], route[1]);
    //distance=tmpDist;
    // Compute route distance
    for (i = 0; i < routeSize - 1; i++) {
        distance += get_distance(route[i], route[i + 1]);
    }

    for (i = 1; i < routeSize - 2; i++) {
        //console.log("-----");

        // for (k = 0; k < i - 1; k++) {
        //     prevDist += get_distance(route[k], route[k + 1]);
        //     //console.log('p',k, k+1,prevDist);
        // }
        //console.log("prevDist", prevDist,"tmpDist",tmpDist);

        //console.log("distance comp", route.join(","), distance);

        for (j = i + 1; j < routeSize - 1; j++) {
            //console.log("...");
            if (i !== j) {
                //console.log('%%',i, i+1);
                tmp = route[i];
                route[i] = route[j];
                route[j] = tmp;

                // Compute modified route distance;
                tmp = prevDist;
                //console.log(route.join(','));
                for (k = i - 1; k < routeSize - 1; k++) {
                    tmp += get_distance(route[k], route[k + 1]);
                    //if (k < i-1) {
                    //console.log("c", k, k + 1, tmp);
                    // }
                }
                //console.log("t", route.join(","), tmp);
                //console.log('###')
                if (tmp >= distance) {
                    // if distance is the same or worse, undo swap
                    tmp = route[i];
                    route[i] = route[j];
                    route[j] = tmp;
                    //console.log("r", route.join(","));
                } else {
                    // if distance is better, update distance
                    distance = tmp;
                    //console.log("n", route.join(","), tmp);
                }
            }
        }
        //console.log('t',i,i+1)
        prevDist += get_distance(route[i-1], route[i]);
    }
    // distance = 0;
    // for (i = 0; i < routeSize - 1; i++) {
    //     distance += get_distance(route[i], route[i + 1]);
    // }

    // console.log("distance end", route.join(","), distance);
}
//init_population_greedy(5);
init_evals();
let r1 = [0, 18, 4, 17, 14, 21, 12, 6, 0]
localSearch_old(r1, 9);
console.log("prod get_evals()", get_evals(),r1.join(','));

init_evals();
let r2 = [0, 18, 4, 17, 14, 21, 12, 6, 0]
localSearch(r2, 9);
console.log("dev get_evals()", get_evals(),r2.join(','));

/* trad
distance end 0,12,14,17,6,4,21,18,0 340.4934218249638
dev get_evals() 5.75
*/

/*
c 0 1 7.0710678118654755
c 1 2 55.907529600164594
c 2 3 72.55084657725783
c 3 4 136.25327981178978
c 4 5 201.6291163265144
*/
