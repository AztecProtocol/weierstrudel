/* eslint-disable prefer-arrow-callback */
const chai = require('chai');
const BN = require('bn.js');
const EC = require('elliptic');
const path = require('path');

const { Runtime, getNewVM } = require('../../huff/src/runtime.js');
const bn128Reference = require('../js_snippets/bn128_reference');

const vm = getNewVM();

const { expect } = chai;
const { p, pRed, n } = bn128Reference;

const pathToTestData = path.posix.resolve(__dirname, '../huff_modules');

// NOTE: potential areas to improve
// 1: main loop is garbage, too many special case tests
// 2: P macro used too often, huge bytecode bload
// 3: not sure we need to use 'mod' in PRECOMPUTE_TABLE__RESCALE_15, just subtract from 4p when we need to negate?

function sliceMemory(memArray) {
    const numWords = Math.ceil(memArray.length / 32);
    const result = [];
    for (let i = 0; i < numWords * 32; i += 32) {
        result.push(new BN(memArray.slice(i, i + 32), 16));
    }
    return result;
}

// eslint-disable-next-line new-cap
const referenceCurve = new EC.curve.short({
    a: '0',
    b: '3',
    p: p.toString(16),
    n: n.toString(16),
    gRed: false,
    g: ['1', '2'],
});

describe('bn128 main loop', function describe() {
    this.timeout(10000);
    let main;
    before(async () => {
        main = new Runtime('main_loop.huff', pathToTestData, true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of ONE point', async () => {
        const numPoints = 1;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of TWO points', async () => {
        const numPoints = 2;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of THREE points', async () => {
        const numPoints = 3;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of FOUR points', async () => {
        const numPoints = 4;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of FIVE points', async () => {
        const numPoints = 5;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of SIX points', async () => {
        const numPoints = 6;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of SEVEN points', async () => {
        const numPoints = 7;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of EIGHT points', async () => {
        const numPoints = 8;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of NINE points', async () => {
        const numPoints = 9;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of TEN points', async () => {
        const numPoints = 10;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of ELEVEN points', async () => {
        const numPoints = 11;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of TWELVE points', async () => {
        const numPoints = 12;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of THIRTEEN points', async () => {
        const numPoints = 13;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of FOURTEEN points', async () => {
        const numPoints = 14;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });

    it('macro MAIN__WEIERSTRUDEL calculates scalar multiplication of FIFTEEN points', async () => {
        const numPoints = 15;
        const points = [...new Array(numPoints)].map(() => bn128Reference.randomPoint());
        const scalars = [...new Array(numPoints)].map(() => bn128Reference.randomScalar());
        const calldata = [...new Array(numPoints)].reduce((acc, x, i) => {
            return [
                ...acc,
                { index: i * 2 * 32, value: points[i].x },
                { index: (i * 2 + 1) * 32, value: points[i].y },
                { index: numPoints * 64 + i * 32, value: scalars[i] },
            ];
        }, []);
        const expected = points.reduce((acc, { x, y }, i) => {
            if (!acc) {
                return referenceCurve.point(x, y).mul(scalars[i]);
            }
            return acc.add(referenceCurve.point(x, y).mul(scalars[i]));
        }, null);
        const { stack, returnValue } = await main(vm, 'MAIN__WEIERSTRUDEL', [], [], calldata, 1);
        const returnWords = sliceMemory(returnValue);
        const x = returnWords[0].toRed(pRed);
        const y = returnWords[1].toRed(pRed);
        const z = returnWords[2].toRed(pRed);
        const result = bn128Reference.toAffine({ x, y, z });
        expect(returnWords.length).to.equal(3);
        expect(stack.length).to.equal(0);
        expect(result.x.fromRed().eq(expected.x.fromRed())).to.equal(true);
        expect(result.y.fromRed().eq(expected.y.fromRed())).to.equal(true);
    });
});
