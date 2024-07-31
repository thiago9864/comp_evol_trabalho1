import { closeSync, openSync, writeFileSync } from "fs";
import { basename } from "path";
import { getTrialsInfo } from "./genetic_heuristic";

export const MAX_TRIALS = 20; // DO NOT CHANGE THE NUMBER

//Used to output offline performance and population diversity

let log_performance: number;
let debug_csv_file: number;

//output files
let perf_filename: string;
let debug_filename: string;

let perf_of_trials: number[];

export function open_stats(problem_instance: string) {
    //Initialize
    perf_of_trials = new Array(MAX_TRIALS);

    for (let i = 0; i < MAX_TRIALS; i++) {
        perf_of_trials[i] = 0.0;
    }

    //initialize and open output files
    perf_filename = `stats.${basename(problem_instance)}.txt`;
    debug_filename = `debug.${basename(problem_instance)}.csv`;

    //for performance
    log_performance = openSync(perf_filename, "a");

    // for debug
    debug_csv_file = openSync(debug_filename, "a");
    writeFileSync(debug_csv_file, `seconds,run,current_best\n`);
}

export function get_mean(r: number, value: number) {
    perf_of_trials[r] = value;
}

export function mean(values: number[], size: number): number {
    let i: number;
    let m = 0.0;
    for (i = 0; i < size; i++) {
        m += values[i];
    }
    m = m / size;
    return m; //mean
}

export function stdev(values: number[], size: number, average: number): number {
    let i: number;
    let dev = 0.0;

    if (size <= 1) return 0.0;

    for (i = 0; i < size; i++) {
        dev += (values[i] - average) * (values[i] - average);
    }
    return Math.sqrt(dev / (size - 1)); //standard deviation
}

export function best_of_vector(values: number[], l: number): number {
    let min: number;
    let k: number;
    k = 0;
    min = values[k];
    for (k = 1; k < l; k++) {
        if (values[k] < min) {
            min = values[k];
        }
    }
    return min;
}

export function worst_of_vector(values: number[], l: number): number {
    let max: number;
    let k: number;
    k = 0;
    max = values[k];
    for (k = 1; k < l; k++) {
        if (values[k] > max) {
            max = values[k];
        }
    }
    return max;
}

export function close_stats() {
    let i: number;
    let j: number;
    let perf_mean_value: number;
    let perf_stdev_value: number;

    //For statistics
    for (i = 0; i < MAX_TRIALS; i++) {
        //cout << i << " " << perf_of_trials[i] << endl;
        //cout << i << " " << time_of_trials[i] << endl;
        writeFileSync(log_performance, perf_of_trials[i].toFixed(2));
        writeFileSync(log_performance, "\n");
    }

    perf_mean_value = mean(perf_of_trials, MAX_TRIALS);
    perf_stdev_value = stdev(perf_of_trials, MAX_TRIALS, perf_mean_value);
    writeFileSync(log_performance, `Mean ${perf_mean_value}\t `);
    writeFileSync(log_performance, `\tStd Dev ${perf_stdev_value}\t `);
    writeFileSync(log_performance, `\n`);
    writeFileSync(log_performance, `Min: ${best_of_vector(perf_of_trials, MAX_TRIALS)}\t `);
    writeFileSync(log_performance, `\n`);
    writeFileSync(log_performance, `Max: ${worst_of_vector(perf_of_trials, MAX_TRIALS)}\t `);
    writeFileSync(log_performance, `\n`);

    closeSync(log_performance);
}

export function generate_solution_data(run: number) {
    let trials = getTrialsInfo();
    for (const trial of trials) {
        writeFileSync(debug_csv_file, `${trial.seconds},${run},${trial.current_best}\n`);
    }
}
