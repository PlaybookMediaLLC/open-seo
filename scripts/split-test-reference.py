#!/usr/bin/env python3
"""Reference implementation of the RFC-0011 split test statistics.

It reproduces src/server/features/split-tests/splitStats.ts with the same
seeded generator, so an owner can recompute a result from the CSV export:

    python3 scripts/split-test-reference.py export.csv

The CSV has one row per pair with the columns `d` and `pre_d` (the pair's
observation and pre-period differences) and a `seed` column whose first value
is the analysis seed. Without an argument, the script prints the results of
the five fixed datasets that the TypeScript tests check.
"""

import csv
import json
import math
import sys

M = 0xFFFFFFFF
DRAWS = 10_000
ALPHA = 0.1


def seeded_random(seed):
    state = seed & M

    def next_value():
        nonlocal state
        state = (state + 0x6D2B79F5) & M
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & M
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & M)) & M
        t &= M
        return ((t ^ (t >> 14)) & M) / 4294967296

    return next_value


def randomization_test(d, seed, draws=DRAWS):
    random = seeded_random(seed)
    n = len(d)
    a, b = [], []
    for _ in range(draws):
        signed_sum, signs, bits = 0.0, 0, 0
        for index in range(n):
            if index % 32 == 0:
                bits = math.floor(random() * 4294967296)
            sign = 1 if (bits >> (index % 32)) & 1 else -1
            signed_sum += sign * d[index]
            signs += sign
        a.append(signed_sum / n)
        b.append(signs / n)
    observed = sum(d) / n

    def p_at(delta):
        bound = abs(observed - delta) - 1e-12
        return sum(1 for x, y in zip(a, b) if abs(x - delta * y) >= bound) / draws

    harm = sum(1 for x in a if x <= observed + 1e-12) / draws
    return observed, p_at, harm


def invert_interval(observed, p_at):
    def edge(direction):
        inside, step = observed, 1e-3
        outside = observed + direction * step
        tries = 0
        while p_at(outside) > ALPHA and tries < 60:
            inside = outside
            step *= 2
            outside = observed + direction * step
            tries += 1
        for _ in range(50):
            middle = (inside + outside) / 2
            if p_at(middle) > ALPHA:
                inside = middle
            else:
                outside = middle
        return inside

    return edge(-1), edge(1)


def t_quantile(z, freedom):
    return (
        z
        + (z**3 + z) / (4 * freedom)
        + (5 * z**5 + 16 * z**3 + 3 * z) / (96 * freedom**2)
    )


def minimum_detectable_effect(pre_d):
    n = len(pre_d)
    freedom = n - 1
    average = sum(pre_d) / n
    sd = math.sqrt(sum((x - average) ** 2 for x in pre_d) / freedom)
    multiplier = t_quantile(1.6449, freedom) + t_quantile(0.8416, freedom)
    chi_square = freedom * (
        1 - 2 / (9 * freedom) - 0.8416 * math.sqrt(2 / (9 * freedom))
    ) ** 3
    spread = sd * math.sqrt(freedom / chi_square)
    return math.expm1(multiplier * spread / math.sqrt(n)) * 100


def analyze(d, pre_d, seed):
    observed, p_at, harm = randomization_test(d, seed)
    low, high = invert_interval(observed, p_at)
    _, pre_p_at, _ = randomization_test(pre_d, seed)
    return {
        "estimatePct": round(math.expm1(observed) * 100, 2),
        "ciLowPct": round(math.expm1(low) * 100, 2),
        "ciHighPct": round(math.expm1(high) * 100, 2),
        "pValue": round(p_at(0), 4),
        "harmP": round(harm, 4),
        "prePeriodP": round(pre_p_at(0), 4),
        "mdePct": round(minimum_detectable_effect(pre_d), 2),
    }


def fixture(seed, pairs, shift, spread):
    """The datasets the TypeScript tests rebuild with the same generator."""
    random = seeded_random(seed)
    d = [shift + (random() - 0.5) * spread for _ in range(pairs)]
    pre_d = [(random() - 0.5) * spread for _ in range(pairs)]
    return d, pre_d


FIXTURES = [
    (1, 15, 0.0, 0.6),
    (2, 25, 0.1, 0.5),
    (3, 40, -0.08, 0.4),
    (4, 60, 0.05, 0.8),
    (5, 100, 0.2, 1.0),
]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], newline="") as file:
            rows = list(csv.DictReader(file))
        d = [float(row["d"]) for row in rows]
        pre_d = [float(row["pre_d"]) for row in rows]
        print(json.dumps(analyze(d, pre_d, int(rows[0]["seed"])), indent=2))
    else:
        for seed, pairs, shift, spread in FIXTURES:
            d, pre_d = fixture(seed, pairs, shift, spread)
            print(json.dumps({"seed": seed, **analyze(d, pre_d, seed)}))
