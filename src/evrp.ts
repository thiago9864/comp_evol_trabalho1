import { readFileSync } from "fs";

class Node {
    id: number = 0;
    x: number = 0;
    y: number = 0;
}

// PARAMETERS THAT CAN BE USED IN YOUR ALGORITHM IMPLEMENTATION
export let NUM_OF_CUSTOMERS: number; // number of customer set
export let ACTUAL_PROBLEM_SIZE: number; // total number of nodes
export let NUM_OF_STATIONS: number; // number of charging stations
export let MAX_CAPACITY: number; // maxmimum cargo capacity
export let DEPOT: number; // id of the depot
export let OPTIMUM: number; // Global optimum (or upper bound) of the problem instance (if known)
export let BATTERY_CAPACITY: number; // maximum energy level
export let MIN_VEHICLES: number;

let node_list: Node[]; // List of nodes with id and x and y coordinates
let cust_demand: number[]; // List with id and customer demands
let charging_station: boolean[];
let distances: number[][]; // Distance matrix
let problem_size: number; // Problem dimension read
let energy_consumption: number;

let evals: number;
let current_best: number;

/****************************************************************/
/*Compute and return the euclidean distance of two objects      */
/****************************************************************/
export function euclidean_distance(i: number, j: number): number {
    let xd: number, yd: number;
    let r = 0.0;
    xd = node_list[i].x - node_list[j].x;
    yd = node_list[i].y - node_list[j].y;
    r = Math.sqrt(xd * xd + yd * yd);
    return r;
}

/****************************************************************/
/*Compute the distance matrix of the problem instance           */
/****************************************************************/
export function compute_distances() {
    let i: number, j: number;
    for (i = 0; i < ACTUAL_PROBLEM_SIZE; i++) {
        for (j = 0; j < ACTUAL_PROBLEM_SIZE; j++) {
            distances[i][j] = euclidean_distance(i, j);
        }
    }
}

/****************************************************************/
/*Generate and return a two-dimension array of type double      */
/****************************************************************/
export function generate_2D_matrix_double(n: number, m: number): number[][] {
    let matrix: number[][];

    matrix = new Array(n);
    for (let i: number = 0; i < n; i++) {
        matrix[i] = new Array(m);
    }
    // initialize the 2-d array
    for (let i: number = 0; i < n; i++) {
        for (let j: number = 0; j < m; j++) {
            matrix[i][j] = 0.0;
        }
    }
    return matrix;
}

/****************************************************************/
/* Read the problem instance and generate the initial object    */
/* vector.                                                      */
/****************************************************************/
export function read_problem(filename: string) {
    let f = readFileSync("./" + filename);
    let ln = f.toString().split("\n");
    if (ln.length === 0) {
        throw new Error("file error");
    }
    for (let k = 0; k < ln.length; k++) {
        let cmp_line = ln[k].trim();
        //console.log("cmp_line", cmp_line);
        if (cmp_line.startsWith("DIMENSION")) {
            problem_size = parseInt(cmp_line.substring(11).trim());
            if (Number.isNaN(problem_size)) {
                throw new Error("DIMENSION error");
            }
        } else if (cmp_line.startsWith("EDGE_WEIGHT_TYPE")) {
            if (cmp_line.substring(17).trim() != "EUC_2D") {
                throw new Error("not EUC_2D");
            }
        } else if (cmp_line.startsWith("CAPACITY")) {
            if (Number.isNaN((MAX_CAPACITY = parseInt(cmp_line.substring(9).trim())))) {
                throw new Error("CAPACITY error");
            }
        } else if (cmp_line.startsWith("VEHICLES")) {
            if (Number.isNaN((MIN_VEHICLES = parseInt(cmp_line.substring(9).trim())))) {
                throw new Error("VEHICLES error");
            }
        } else if (cmp_line.startsWith("ENERGY_CAPACITY")) {
            BATTERY_CAPACITY = parseInt(cmp_line.substring(16).trim());
            if (Number.isNaN(BATTERY_CAPACITY)) {
                throw new Error("ENERGY_CAPACITY error");
            }
        } else if (cmp_line.startsWith("ENERGY_CONSUMPTION")) {
            if (Number.isNaN((energy_consumption = parseFloat(cmp_line.substring(19).trim())))) {
                throw new Error("ENERGY_CONSUMPTION error");
            }
        } else if (cmp_line.startsWith("STATIONS:")) {
            if (Number.isNaN((NUM_OF_STATIONS = parseInt(cmp_line.substring(9).trim())))) {
                throw new Error("STATIONS error");
            }
        } else if (cmp_line.startsWith("OPTIMAL_VALUE")) {
            if (Number.isNaN((OPTIMUM = parseFloat(cmp_line.substring(14).trim())))) {
                throw new Error("OPTIMAL_VALUE error");
            }
        } else if (cmp_line.startsWith("NODE_COORD_SECTION")) {
            if (problem_size !== 0) {
                // problem_size is the number of customers plus the depot
                NUM_OF_CUSTOMERS = problem_size - 1;
                ACTUAL_PROBLEM_SIZE = problem_size + NUM_OF_STATIONS;

                node_list = [];
                let j: number;
                for (j = k + 1; j < k + 1 + ACTUAL_PROBLEM_SIZE; j++) {
                    // store initial objects
                    let node_coord_list = ln[j].trim().split(" ");

                    let node = new Node();
                    node.id = parseInt(node_coord_list[0]) - 1; // Indices começam do zero
                    node.x = parseFloat(node_coord_list[1]);
                    node.y = parseFloat(node_coord_list[2]);

                    node_list.push(node);
                }
                k = j-1;

                // compute the distances using initial objects
                distances = generate_2D_matrix_double(ACTUAL_PROBLEM_SIZE, ACTUAL_PROBLEM_SIZE);
            } else {
                console.log("wrong problem instance file");
            }
        } else if (cmp_line.startsWith("DEMAND_SECTION")) {
            if (problem_size !== 0) {
                cust_demand = new Array(ACTUAL_PROBLEM_SIZE);
                charging_station = new Array(ACTUAL_PROBLEM_SIZE).fill(false);
                let j: number;
                for (j = k + 1; j < (k + 1 + problem_size); j++) {
                    // store initial objects
                    let demand_list = ln[j].trim().split(" ");
                   
                    let temp = parseInt(demand_list[0]);
                    cust_demand[temp - 1] = parseInt(demand_list[1]);
                }
                k = j-1;
                for (let j = 0; j < ACTUAL_PROBLEM_SIZE; j++) {
                    if (j < problem_size) {
                        charging_station[j] = false;
                    } else {
                        charging_station[j] = true;
                        cust_demand[j] = 0;
                    }
                }
            }
        } else if (cmp_line.startsWith("DEPOT_SECTION")) {
            k += 1;
            DEPOT = parseInt(ln[k].trim()) - 1;
            charging_station[DEPOT] = true;
        }

        if (ACTUAL_PROBLEM_SIZE === 0) {
            throw new Error("wrong problem instance file");
        } else {
            compute_distances();
        }
    }
}

/****************************************************************/
/* Returns the solution quality of the solution. Taken as input */
/* an array of node indeces and its length                      */
/****************************************************************/
export function fitness_evaluation(routes: number[], size: number): number {
    let i: number;
    let tour_length: number = 0.0;

    // the format of the solution that this method evaluates is the following
    // Node id:  0 - 5 - 6 - 8 - 0 - 1 - 2 - 3 - 4 - 0 - 7 - 0
    // Route id: 1 - 1 - 1 - 1 - 2 - 2 - 2 - 2 - 2 - 3 - 3 - 3
    // this solution consists of three routes:
    // Route 1: 0 - 5 - 6 - 8 - 0
    // Route 2: 0 - 1 - 2 - 3 - 4 - 0
    // Route 3: 0 - 7 - 0
    for (i = 0; i < size - 1; i++) tour_length += distances[routes[i]][routes[i + 1]];

    if (tour_length < current_best) current_best = tour_length;

    // adds complete evaluation to the overall fitness evaluation count
    evals++;

    return tour_length;
}

/****************************************************************/
/* Outputs the routes of the solution. Taken as input           */
/* an array of node indeces and its length                      */
/****************************************************************/
export function print_solution(routes: number[], size: number) {
    let i: number;
    let s: string=""
    for (i = 0; i < size; i++) {
       s += routes[i] + " , "
    }
    console.log(s);
}

/****************************************************************/
/* Validates the routes of the solution. Taken as input         */
/* an array of node indeces and its length                      */
/****************************************************************/
export function check_solution(t: number[], size: number) {
    let i: number, from: number, to: number;
    let energy_temp: number = BATTERY_CAPACITY;
    let capacity_temp: number = MAX_CAPACITY;
    let distance_temp: number = 0.0;

    for (i = 0; i < size - 1; i++) {
        from = t[i];
        to = t[i + 1];
        capacity_temp -= get_customer_demand(to);
        energy_temp -= get_energy_consumption(from, to);
        distance_temp += get_distance(from, to);
        if (capacity_temp < 0.0) {
            print_solution(t, size);
            throw new Error(`error: capacity below 0 at customer ${to}`);
        }
        if (energy_temp < 0.0) {
            print_solution(t, size);
            throw new Error(`error: energy below 0 from ${from}, ${to}`);
        }
        if (to == DEPOT) {
            capacity_temp = MAX_CAPACITY;
        }
        if (is_charging_station(to) == true || to == DEPOT) {
            energy_temp = BATTERY_CAPACITY;
        }
    }
    if (distance_temp != fitness_evaluation(t, size)) {
        throw new Error("error: check fitness evaluation");
    }
}

/****************************************************************/
/* Returns the distance between two points: from and to. Can be */
/* used to evaluate a part of the solution. The fitness         */
/* evaluation count will be proportional to the problem size    */
/****************************************************************/
export function get_distance(from: number, to: number): number {
    // adds partial evaluation to the overall fitness evaluation count
    // It can be used when local search is used and a whole evaluation is not necessary
    evals += 1.0 / ACTUAL_PROBLEM_SIZE;

    return distances[from][to];
}

/****************************************************************/
/* Returns the energy consumed when travelling between two      */
/* points: from and to.                                         */
/****************************************************************/
export function get_energy_consumption(from: number, to: number): number {
    /*DO NOT USE THIS FUNCTION MAKE ANY CALCULATIONS TO THE ROUTE COST*/
    return energy_consumption * distances[from][to];
}

/****************************************************************/
/* Returns the demand for a specific customer                   */
/* points: from and to.                                         */
/****************************************************************/
export function get_customer_demand(customer: number): number {
    return cust_demand[customer];
}

/****************************************************************/
/* Returns true when a specific node is a charging station;     */
/* and false otherwise                                          */
/****************************************************************/
export function is_charging_station(node: number): boolean {
    let flag = false;
    if (charging_station[node] == true) flag = true;
    else flag = false;
    return flag;
}

/****************************************************************/
/* Returns the best solution quality so far                     */
/****************************************************************/
export function get_current_best(): number {
    return current_best;
}

/*******************************************************************/
/* Reset the best solution quality so far for a new indepedent run */
/*******************************************************************/
export function init_current_best() {
    current_best = Number.MAX_SAFE_INTEGER;
}

/****************************************************************/
/* Returns the current count of fitness evaluations             */
/****************************************************************/
export function get_evals(): number {
    return evals;
}

/****************************************************************/
/* Reset the evaluation counter for a new indepedent run        */
/****************************************************************/
export function init_evals() {
    evals = 0;
}
