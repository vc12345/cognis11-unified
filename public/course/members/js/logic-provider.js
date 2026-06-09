const LogicProvider = {
    modules: {
        meanBridge: {
            calculate: (currentVals, targetMean) => {
                const knownSum = currentVals.reduce((a, b) => a + b, 0);
                const targetCount = currentVals.length + 1;
                const targetSum = targetMean * targetCount;
                const missingValue = targetSum - knownSum;
                return {
                    knownSum, targetSum, missingValue, targetCount,
                    steps: [
                        `1. Calculate Target Total: Mean (${targetMean}) × Total Count (${targetCount}) = ${targetSum}.`,
                        `2. Calculate Current Total: Sum of known values = ${knownSum}.`,
                        `3. The Bridge: Target Total (${targetSum}) - Current Total (${knownSum}) = ${missingValue}.`
                    ]
                };
            }
        },

        averages: {
            calculate: (dataArray) => {
                const sorted = [...dataArray].sort((a, b) => a - b);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const mean = sum / dataArray.length;
                const mid = Math.floor(sorted.length / 2);
                const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                const counts = {};
                dataArray.forEach(n => counts[n] = (counts[n] || 0) + 1);
                let maxFreq = 0;
                let modes = [];
                for (let n in counts) {
                    if (counts[n] > maxFreq) { maxFreq = counts[n]; modes = [Number(n)]; }
                    else if (counts[n] === maxFreq) { modes.push(Number(n)); }
                }
                return {
                    mean: mean.toFixed(1), median, mode: maxFreq > 1 ? modes.join(', ') : "None",
                    range: sorted[sorted.length - 1] - sorted[0],
                    steps: [
                        `Mean: Total sum (${sum}) ÷ Count (${dataArray.length}) = ${mean.toFixed(1)}`,
                        `Median: Sorted list is [${sorted.join(', ')}]. The middle is ${median}.`,
                        `Mode: The most frequent value is ${maxFreq > 1 ? modes.join(', ') : 'none'}.`
                    ]
                };
            }
        },

        venn3: {
            calculate: (tA, tB, tC, iAB, iBC, iAC, iAll, none) => {
                const core = parseFloat(iAll) || 0;
                const petalAB = (parseFloat(iAB) || 0) - core;
                const petalBC = (parseFloat(iBC) || 0) - core;
                const petalAC = (parseFloat(iAC) || 0) - core;
                const onlyA = (parseFloat(tA) || 0) - petalAB - petalAC - core;
                const onlyB = (parseFloat(tB) || 0) - petalAB - petalBC - core;
                const onlyC = (parseFloat(tC) || 0) - petalAC - petalBC - core;
                const union = onlyA + onlyB + onlyC + petalAB + petalBC + petalAC + core;
                const universe = union + (parseFloat(none) || 0);
                return {
                    core, petalAB, petalBC, petalAC, onlyA, onlyB, onlyC, universe,
                    steps: [
                        `Center (A ∩ B ∩ C) is the anchor: ${core}.`,
                        `Subtract center from A ∩ B: ${iAB} - ${core} = ${petalAB}.`,
                        `Subtract all overlaps from Total A: ${tA} - ${petalAB} - ${petalAC} - ${core} = ${onlyA}.`,
                        `Sum all disjoint sections for Universe: ${universe}.`
                    ]
                };
            }
        },

        vennLogic: {
            calculateFromTotals: (totalA, totalB, intersection, neither) => {
                const tA = parseFloat(totalA) || 0;
                const tB = parseFloat(totalB) || 0;
                const intersect = parseFloat(intersection) || 0;
                const none = parseFloat(neither) || 0;
                const onlyA = tA - intersect;
                const onlyB = tB - intersect;
                const union = onlyA + onlyB + intersect;
                const universe = union + none;
                return {
                    onlyA, onlyB, union, universe,
                    steps: [
                        `1. Group A total is ${tA}. 'Only A' = ${onlyA}.`,
                        `2. Group B total is ${tB}. 'Only B' = ${onlyB}.`,
                        `3. The Union (A ∪ B) is ${union}.`,
                        `4. Total Universe includes 'Neither' (${none}): ${universe}.`
                    ]
                };
            }
        },

        substitution: {
            parseTerm: (term, mappings) => {
                if (!isNaN(term)) return { result: parseFloat(term), substituted: term };
                const match = term.match(/^(\d*)([A-Z])$/);
                if (match) {
                    const coefficient = match[1] === "" ? 1 : parseFloat(match[1]);
                    const variable = match[2];
                    const val = mappings[variable] || 0;
                    return { original: term, substituted: `${coefficient} × ${val}`, result: coefficient * val };
                }
                return { result: 0, substituted: '?' };
            },
            calculateFormula: (formulaArray, mappings) => {
                let steps = [];
                let substitutedValues = [];
                formulaArray.forEach(token => {
                    if (['+', '-', '*', '/', '^'].includes(token)) {
                        substitutedValues.push(token);
                    } else if (token.includes('^')) {
                        const [baseVar, power] = token.split('^');
                        const baseVal = mappings[baseVar] || 0;
                        const res = Math.pow(baseVal, power);
                        steps.push(`Power: ${baseVar}^${power} → ${baseVal}^${power} = ${res}`);
                        substitutedValues.push(res);
                    } else {
                        const termData = LogicProvider.modules.substitution.parseTerm(token, mappings);
                        steps.push(`Substitute: ${token} → ${termData.substituted} = ${termData.result}`);
                        substitutedValues.push(termData.result);
                    }
                });
                try {
                    const finalRes = eval(substitutedValues.join('').replace(/x/g, '*').replace(/[^0-9\+\-\*\/\.]/g, ''));
                    return { finalRes, steps };
                } catch (e) {
                    return { finalRes: "Error", steps: ["Invalid Formula Structure"] };
                }
            }
        },

        missingSigns: {
            calculate: (pre, a, op1, b, op2, c, target) => {
                const ops = { '+': (x, y) => x + y, '-': (x, y) => x - y, 'x': (x, y) => x * y, '/': (x, y) => x / y, '^': (x, y) => Math.pow(x, y) };
                const valA = pre === 'sqrt' ? Math.sqrt(parseFloat(a)) : parseFloat(a);
                const priority = (o) => (o === '^' ? 3 : (o === 'x' || o === '/') ? 2 : 1);
                let current = 0; let steps = [];
                if (priority(op2) > priority(op1)) {
                    const s1 = ops[op2](parseFloat(b), parseFloat(c));
                    current = ops[op1](valA, s1);
                    steps = [`BODMAS: ${op2} priority over ${op1}.`, `Step 1: ${b} ${op2} ${c} = ${s1}.`, `Step 2: ${valA} ${op1} ${s1} = ${current}.` ];
                } else {
                    const s1 = ops[op1](valA, parseFloat(b));
                    current = ops[op2](s1, parseFloat(c));
                    steps = [`Flow: Left-to-Right logic.`, `Step 1: ${valA} ${op1} ${b} = ${s1}.`, `Step 2: ${s1} ${op2} ${c} = ${current}.` ];
                }
                return { current, steps, isBalanced: current === parseFloat(target) };
            }
        },

        bodmas: {
            operate: (a, op, b) => {
                a = parseFloat(a); b = parseFloat(b);
                switch(op) {
                    case '+': return a + b; case '-': return a - b; case 'x': return a * b; case '/': return a / b; case '^': return Math.pow(a, b);
                    default: return 0;
                }
            },
            solveStepByStep: (tokens) => {
                let current = [...tokens];
                let history = [ { expr: current.join(' '), action: "Start" } ];
                const priorities = [{ ops: ['^'], label: 'Orders' }, { ops: ['x', '/'], label: 'DM' }, { ops: ['+', '-'], label: 'AS' }];
                for (let p of priorities) {
                    let i = 0;
                    while (i < current.length) {
                        if (p.ops.includes(current[i])) {
                            const result = LogicProvider.modules.bodmas.operate(current[i-1], current[i], current[i+1]);
                            const action = `Solved ${p.label}: ${current[i-1]} ${current[i]} ${current[i+1]} = ${result}`;
                            current.splice(i-1, 3, result);
                            history.push({ expr: current.join(' '), action });
                            i = 0;
                        } else { i++; }
                    }
                }
                return history;
            }
        },

        timeConv: {
            calculate: (h, m, addM) => {
                const hStart = parseInt(h) || 0; const mStart = parseInt(m) || 0; const duration = parseInt(addM) || 0;
                const totalMinsRaw = (hStart * 60) + mStart + duration;
                const finalH = Math.floor(totalMinsRaw / 60) % 24;
                const finalM = totalMinsRaw % 60;
                const tempMins = mStart + duration;
                const hoursToCarry = Math.floor(tempMins / 60);
                const overflowActive = tempMins >= 60;
                return {
                    finalH, finalM, hoursCarried: hoursToCarry, overflowed: overflowActive, currentMTotal: tempMins,
                    steps: [
                        `Step 1: Start time is ${hStart}:${mStart.toString().padStart(2, '0')}.`,
                        `Step 2: Add ${duration} minutes.`,
                        overflowActive ? `Step 3: ${tempMins}m exceeds 60m limit. Carry ${hoursToCarry}h.` : `Step 3: Total minutes within limit.`,
                        `Result: Final time is ${finalH}:${finalM.toString().padStart(2, '0')}.`
                    ]
                };
            }
        },

        moreThanTrap: {
            calculate: (total, difference) => {
                const t = parseFloat(total) || 0; const d = parseFloat(difference) || 0;
                const equalizedSum = t - d;
                const smallerPart = equalizedSum / 2;
                const largerPart = smallerPart + d;
                return {
                    smaller: smallerPart, larger: largerPart, equalized: equalizedSum,
                    steps: [
                        `Step 1: Excess is ${d}.`, `Step 2: Snip off excess: ${t} - ${d} = ${equalizedSum}.`,
                        `Step 3: Share remainder: ${equalizedSum} ÷ 2 = ${smallerPart}.`,
                        `Step 4: Smaller share: ${smallerPart}.`, `Step 5: Larger share: ${smallerPart} + ${d} = ${largerPart}.`
                    ]
                };
            }
        },

        reverseOps: {
            calculate: (res, o1t, o1v, o2t, o2v) => {
                const f = parseFloat(res) || 0; const v1 = parseFloat(o1v) || 0; const v2 = parseFloat(o2v) || 0;
                const solve = (val, type, n) => {
                    if(type === 'add') return val - n; if(type === 'sub') return val + n;
                    if(type === 'mul') return val / n; if(type === 'div') return val * n;
                };
                const mid = solve(f, o2t, v2);
                const start = solve(mid, o1t, v1);
                return {
                    start, mid,
                    steps: [`Step 1: Start with ${f}.`, `Step 2: Reverse Op 2: ${f} → ${mid}.`, `Step 3: Reverse Op 1: ${mid} → ${start}.`]
                };
            }
        },

        intervalLogic: {
            calculate: (numObjects, totalValue) => {
                const n = parseInt(numObjects) || 0; const total = parseFloat(totalValue) || 0;
                const gaps = Math.max(0, n - 1);
                const intervalSize = gaps > 0 ? total / gaps : 0;
                return {
                    gaps, interval: intervalSize.toFixed(2),
                    steps: [
                        `Step 1: ${n} items.`, `Step 2: Intervals = Items - 1 = ${gaps}.`,
                        `Step 3: Gap size = ${total} ÷ ${gaps} = ${intervalSize.toFixed(2)}.`,
                        `Result: Each interval is ${intervalSize.toFixed(2)} long.`
                    ]
                };
            }
        },

        trainTunnel: {
            calculate: (trainLen, tunnelLen, speedKmh) => {
                const L1 = parseFloat(trainLen) || 0; const L2 = parseFloat(tunnelLen) || 0; const speedKmhNum = parseFloat(speedKmh) || 1;
                const totalDistMetres = L1 + L2; const speedMs = speedKmhNum / 3.6; const timeSeconds = totalDistMetres / speedMs;
                return {
                    totalDist: totalDistMetres, speedMs: speedMs.toFixed(2), timeSeconds: timeSeconds.toFixed(1),
                    steps: [
                        `Step 1: Total Dist = ${L1}m + ${L2}m = ${totalDistMetres}m.`,
                        `Step 2: Speed = ${speedKmhNum} km/h = ${speedMs.toFixed(2)} m/s.`,
                        `Step 3: Time = ${totalDistMetres} ÷ ${speedMs.toFixed(2)}.`,
                        `Result: ${timeSeconds.toFixed(1)} seconds.`
                    ]
                };
            }
        },

        balancingEquations: {
            calculate: (a, b, c) => {
                const coef = parseInt(a) || 1; const constLeft = parseInt(b) || 0; const constRight = parseInt(c) || 0;
                if (coef === 0) return { error: "X coef cannot be 0.", steps: [] };
                const step1Right = constRight - constLeft; const finalX = step1Right / coef;
                return {
                    coef, constLeft, constRight, step1Right, finalX,
                    steps: [
                        `Equation: ${coef}x + ${constLeft} = ${constRight}`,
                        `Step 1: Isolate X. ${coef}x = ${constRight} - ${constLeft} = ${step1Right}`,
                        `Step 2: x = ${step1Right} ÷ ${coef} = ${finalX.toFixed(2)}`
                    ]
                };
            }
        },

        relativeSpeed: {
            calculate: (s1, s2, dist) => {
                const speed1 = parseFloat(s1) || 0; const speed2 = parseFloat(s2) || 0; const d = parseFloat(dist) || 0;
                if (speed1 + speed2 === 0) return { rate: 0, timeH: 0, steps: ["Speeds cannot be zero."] };
                const relativeRate = speed1 + speed2;
                const timeToMeet = d / relativeRate;
                const timeMinutes = timeToMeet * 60;
                const distA = speed1 * timeToMeet;
                return {
                    rate: relativeRate.toFixed(2), timeH: timeToMeet.toFixed(2), timeM: timeMinutes.toFixed(0),
                    meetPtPct: (distA / d) * 100, distA: distA.toFixed(1),
                    steps: [
                        `Step 1: Combined Speed = ${speed1} + ${speed2} = ${relativeRate} km/h.`,
                        `Step 2: Time = ${d} km ÷ ${relativeRate} km/h = ${timeToMeet.toFixed(2)} hours.`,
                        `Result: Meet in ${timeMinutes.toFixed(0)} mins.`
                    ]
                };
            }
        },

        averageSpeed: {
            calculate: (d1, t1, d2, t2) => {
                const totalDist = parseFloat(d1) + parseFloat(d2); const totalTime = parseFloat(t1) + parseFloat(t2);
                const avgSpeed = totalDist / totalTime;
                return {
                    totalDist: totalDist.toFixed(2), totalTime: totalTime.toFixed(2), avgSpeed: avgSpeed.toFixed(2),
                    steps: [
                        `Step 1: Total Dist = ${totalDist.toFixed(2)} km.`, `Step 2: Total Time = ${totalTime.toFixed(2)} hours.`,
                        `Step 3: Avg Speed = Dist ÷ Time.`, `Result: ${avgSpeed.toFixed(2)} km/h.`
                    ]
                };
            }
        },

        constantSpeed: {
            calculate: (d, s, t, solvingFor) => {
                let dist = parseFloat(d); let speed = parseFloat(s); let time = parseFloat(t); let result = 0; let steps = [];
                if (solvingFor === 'd') {
                    result = speed * time; steps = [`Step 1: Multiply S × T.`, `Result: Distance is ${result.toFixed(2)} km.`];
                } else if (solvingFor === 's') {
                    result = dist / time; steps = [`Step 1: Divide D ÷ T.`, `Result: Speed is ${result.toFixed(2)} km/h.`];
                } else {
                    result = dist / speed; steps = [`Step 1: Divide D ÷ S.`, `Result: Time is ${result.toFixed(2)} hours.`];
                }
                return { result: result.toFixed(2), steps };
            }
        },

        sequentialFractions: {
            calculate: (total, n1, d1, n2, d2) => {
                const t = parseFloat(total); const amt1 = (parseInt(n1) / parseInt(d1)) * t;
                const remainder = t - amt1; const amt2 = (parseInt(n2) / parseInt(d2)) * remainder;
                const final = remainder - amt2;
                return {
                    amt1: amt1.toFixed(2), remainder: remainder.toFixed(2), amt2: amt2.toFixed(2), final: final.toFixed(2),
                    steps: [
                        `Step 1: ${n1}/${d1} of ${t} = ${amt1.toFixed(2)}.`, `Step 2: Remainder = ${remainder.toFixed(2)}.`,
                        `Step 3: ${n2}/${d2} of remainder = ${amt2.toFixed(2)}.`, `Result: ${final.toFixed(2)} left.`
                    ]
                };
            }
        },

        fractionsOfAmounts: {
            calculate: (total, numerator, denominator) => {
                const t = parseFloat(total); const n = parseInt(numerator); const d = parseInt(denominator);
                const unitFraction = t / d; const result = unitFraction * n;
                return {
                    unitFraction: unitFraction.toFixed(2), result: result.toFixed(2),
                    steps: [
                        `Step 1: Unit slice (1/${d}) = ${t} ÷ ${d} = ${unitFraction.toFixed(2)}.`,
                        `Step 2: ${n} slices = ${unitFraction.toFixed(2)} × ${n}.`,
                        `Result: £${result.toFixed(2)}.`
                    ]
                };
            }
        },

        reversePercentage: {
            calculate: (finalVal, percent, isIncrease) => {
                const f = parseFloat(finalVal); const p = parseFloat(percent);
                const multiplier = isIncrease ? (1 + p / 100) : (1 - p / 100);
                const original = f / multiplier;
                return {
                    multiplier: multiplier.toFixed(2), original: original.toFixed(2),
                    steps: [
                        `Step 1: Multiplier is ${multiplier.toFixed(2)}.`, `Step 2: Original × ${multiplier.toFixed(2)} = ${f}.`,
                        `Step 3: Original = ${f} ÷ ${multiplier.toFixed(2)}.`, `Result: Original was £${original.toFixed(2)}.`
                    ]
                };
            }
        },

        percentageChange: {
            calculate: (original, percent, isIncrease) => {
                const start = parseFloat(original); const p = parseFloat(percent);
                const multiplier = isIncrease ? (1 + p / 100) : (1 - p / 100);
                const result = start * multiplier;
                return {
                    multiplier: multiplier.toFixed(2), result: result.toFixed(2),
                    steps: [
                        `Step 1: Multiplier is ${multiplier.toFixed(2)}.`, `Step 2: ${start} × ${multiplier.toFixed(2)}.`,
                        `Result: New value is ${result.toFixed(2)}.`
                    ]
                };
            }
        },

        directProportion: {
            calculate: (origQty, origVal, targetQty) => {
                const q1 = parseFloat(origQty); const v1 = parseFloat(origVal); const q2 = parseFloat(targetQty);
                const multiplier = q2 / q1; const result = v1 * multiplier;
                return {
                    multiplier: multiplier.toFixed(2), result: result.toFixed(2),
                    steps: [
                        `Step 1: Scale Factor = ${q2} ÷ ${q1} = ${multiplier.toFixed(2)}.`,
                        `Step 2: Apply Scale Factor to value: ${v1} × ${multiplier.toFixed(2)}.`,
                        `Result: New value is ${result.toFixed(2)}.`
                    ]
                };
            }
        },

        inverseProportion: {
            calculate: (workers, time, newWorkers) => {
                const w1 = parseInt(workers) || 1; const t1 = parseFloat(time) || 1; const w2 = parseInt(newWorkers) || 1;
                const totalWork = w1 * t1; const newTime = totalWork / w2;
                return {
                    totalWork: totalWork.toFixed(1), newTime: newTime.toFixed(1),
                    steps: [
                        `Step 1: Total Work = ${w1} × ${t1} = ${totalWork.toFixed(1)}.`,
                        `Step 2: Divide Total Work by new workforce (${w2}).`,
                        `Result: It will take ${newTime.toFixed(1)} time units.`
                    ]
                };
            }
        },

        sharedRatiosDiff: {
            calculate: (diffAmount, partA, partB) => {
                const diff = parseFloat(diffAmount); const a = parseInt(partA); const b = parseInt(partB);
                if (a === b) return { error: "Ratios must be different." };
                const diffParts = Math.abs(a - b); const valuePerPart = diff / diffParts;
                const valA = a * valuePerPart; const valB = b * valuePerPart;
                return {
                    diffParts, valuePerPart: valuePerPart.toFixed(2), valA: valA.toFixed(2), valB: valB.toFixed(2), total: (valA + valB).toFixed(2),
                    steps: [
                        `Step 1: Difference in parts = ${diffParts}.`, `Step 2: 1 Part = ${diff} ÷ ${diffParts} = ${valuePerPart.toFixed(2)}.`,
                        `Step 3: Multiply parts by share value.`, `Result: A is £${valA.toFixed(2)}, B is £${valB.toFixed(2)}.`
                    ]
                };
            }
        },

        sharedRatiosTotal: {
            calculate: (total, partA, partB) => {
                const t = parseFloat(total); const a = parseInt(partA); const b = parseInt(partB);
                const totalParts = a + b; const valuePerPart = t / totalParts;
                const valA = a * valuePerPart; const valB = b * valuePerPart;
                return {
                    totalParts, valuePerPart: valuePerPart.toFixed(2), valA: valA.toFixed(2), valB: valB.toFixed(2),
                    steps: [
                        `Step 1: Total parts = ${totalParts}.`, `Step 2: 1 Part = ${t} ÷ ${totalParts} = ${valuePerPart.toFixed(2)}.`,
                        `Result: A is £${valA.toFixed(2)}, B is £${valB.toFixed(2)}.`
                    ]
                };
            }
        },

        unitary: {
            calculate: (knownQty, knownValue, targetQty) => {
                const unitValue = knownValue / knownQty; const finalValue = unitValue * targetQty;
                return {
                    answers: { unit: unitValue.toFixed(2), correct: finalValue.toFixed(2) },
                    steps: [
                        { label: "The Bridge", text: `1 unit = £${knownValue} ÷ ${knownQty} = £${unitValue.toFixed(2)}` },
                        { label: "The Target", text: `Total for ${targetQty} units = £${finalValue.toFixed(2)}` }
                    ]
                };
            }
        }
    }
};