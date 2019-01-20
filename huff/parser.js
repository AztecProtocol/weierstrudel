/* eslint-disable no-bitwise */
const BN = require('bn.js');
const path = require('path');
const fs = require('fs');

const grammar = require('./grammar/grammar');
const inputMaps = require('./inputMap/inputMap');
const regex = require('./utils/regex');
const {
    formatEvenBytes,
    toHex,
    padNBytes,
    normalize,
} = require('./utils');

const { opcodes } = require('./opcodes/opcodes');

const TYPES = {
    OPCODE: 'OPCODE',
    PUSH: 'PUSH',
    JUMPDEST: 'JUMPDEST',
    PUSH_JUMP_LABEL: 'PUSH_JUMP_LABEL',
    MACRO: 'MACRO',
    TEMPLATE: 'TEMPLATE',
    CODESIZE: 'CODESIZE',
    TABLE_START_POSITION: 'TABLE_START_POSITION',
};

const CONTEXT = {
    NONE: 1,
    MACRO: 2,
};

function check(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}


const parser = {};

parser.getId = () => {
    return [...new Array(10)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
};

parser.substituteTemplateArguments = (newTemplateArguments, templateRegExps) => {
    return newTemplateArguments.map(arg => templateRegExps
        .reduce((acc, { pattern, value }) => acc
            .replace(pattern, value), arg), []);
};

parser.processMacroLiteral = (op, macros) => {
    if (op.match(grammar.macro.LITERAL_HEX)) {
        return new BN(op.match(grammar.macro.LITERAL_HEX)[1], 16);
    }
    if (op.match(grammar.macro.LITERAL_DECIMAL)) {
        return new BN(op.match(grammar.macro.LITERAL_DECIMAL)[1], 10);
    }
    if (macros[op]) {
        check(
            macros[op].ops.length === 1 && macros[op].ops[0].type === TYPES.PUSH,
            `cannot add ${op}, ${macros[op].ops} not a literal`
        );
        return new BN(macros[op].ops[0].args[0], 16);
    }
    throw new Error(`I don't know how to process literal ${op}`);
};

parser.processTemplateLiteral = (literal, macros) => {
    if (literal.includes('-')) {
        return normalize(literal.split('-').map((op) => {
            if (regex.containsOperators(op)) {
                return parser.processTemplateLiteral(op, macros);
            }
            return parser.processMacroLiteral(op, macros);
        }).reduce((acc, val) => {
            if (!acc) { return val; }
            return acc.sub(val);
        }, null));
    }
    if (literal.includes('+')) {
        return normalize(literal.split('+').map((op) => {
            if (regex.containsOperators(op)) {
                return parser.processTemplateLiteral(op, macros);
            }
            return parser.processMacroLiteral(op, macros);
        }).reduce((acc, val) => {
            if (!acc) { return val; }
            return acc.add(val);
        }, null));
    }
    if (literal.includes('*')) {
        return normalize(literal.split('*').map((op) => {
            if (regex.containsOperators(op)) {
                return parser.processTemplateLiteral(op, macros);
            }
            return parser.processMacroLiteral(op, macros);
        }).reduce((acc, val) => {
            if (!acc) { return val; }
            return acc.mul(val);
        }, null));
    }
    return parser.processMacroLiteral(literal, macros);
};

parser.parseTemplate = (templateName, macros = {}, index = 0) => {
    const macroId = parser.getId();
    if (regex.isLiteral(templateName)) {
        const hex = formatEvenBytes(parser.processTemplateLiteral(templateName, macros).toString(16));
        const opcode = toHex(95 + (hex.length / 2));
        return {
            templateName: `inline-${templateName}-${macroId}`,
            macros: {
                ...macros,
                [`inline-${templateName}-${macroId}`]: {
                    name: `inline-${templateName}-${macroId}`,
                    ops: [{
                        type: TYPES.PUSH,
                        value: opcode,
                        args: [hex],
                        index,
                    }],
                    templateParams: [],
                },
            },
        };
    }
    if (opcodes[templateName]) {
        return {
            templateName: `inline-${templateName}-${macroId}`,
            macros: {
                ...macros,
                [`inline-${templateName}-${macroId}`]: {
                    name: templateName,
                    ops: [{
                        type: TYPES.OPCODE,
                        value: opcodes[templateName],
                        args: [],
                        index,
                    }],
                    templateParams: [],
                },
            },
        };
    }
    if (macros[templateName]) {
        return {
            macros,
            templateName,
        };
    }
    return {
        templateName: `inline-${templateName}-${macroId}`,
        macros: {
            ...macros,
            [`inline-${templateName}-${macroId}`]: {
                name: templateName,
                ops: [{
                    type: TYPES.PUSH_JUMP_LABEL,
                    value: templateName,
                    args: [],
                    index,
                }],
                templateParams: [],
            },
        },
    };
    // TODO templates that have templates
};

parser.processMacro = (
    name,
    startingBytecodeIndex = 0,
    templateArgumentsRaw = [],
    startingMacros = {},
    map = {},
    jumptables
) => {
    const result = parser.processMacroInternal(name, startingBytecodeIndex, templateArgumentsRaw, startingMacros, map);
    if (result.unmatchedJumps.length > 0) {
        throw new Error(`macro ${name}, unmatched jump labels ${JSON.stringify(result.unmatchedJumps)} found, cannot compile`);
    }

    let tableOffset = (result.data.bytecode.length / 2);
    let { bytecode } = result.data;
    const jumpkeys = Object.keys(jumptables);
    const tableOffsets = {};
    jumpkeys.forEach((jumpkey) => {
        const jumptable = jumptables[jumpkey];
        tableOffsets[jumptable.name] = tableOffset;
        tableOffset += jumptable.table.size;
        const tablecode = jumptable.table.jumps.map((jumplabel) => {
            if (!result.jumpindices[jumplabel]) {
                throw new Error(`could not find ${jumplabel} in ${JSON.stringify(result.jumpindices)}`);
            }
            const { offset } = result.jumpindices[jumplabel];
            let hex = formatEvenBytes(toHex(offset));
            if (!jumptable.table.compressed) {
                hex = `000000000000000000000000000000000000000000000000000000000000${hex}`;
            }
            return hex;
        }).join('');
        bytecode += tablecode;
    });
    result.tableInstances.forEach((tableInstance) => {
        if (!tableOffsets[tableInstance.label]) {
            throw new Error(`expected to find ${tableInstance.label} in ${JSON.stringify(tableOffsets)}`);
        }
        const { offset } = tableInstance;
        if (bytecode.slice((offset * 2) + 2, (offset * 2) + 6) !== 'xxxx') {
            throw new Error(`expected ${tableInstance.offset} to be xxxx`);
        }
        const pre = bytecode.slice(0, (offset * 2) + 2);
        const post = bytecode.slice((offset * 2) + 6);
        bytecode = `${pre}${formatEvenBytes(toHex(tableOffsets[tableInstance.label]))}${post}`;
    });
    return {
        ...result,
        data: {
            ...result.data,
            bytecode,
        },
    };
};

parser.processMacroInternal = (
    name,
    startingBytecodeIndex = 0,
    templateArgumentsRaw = [],
    startingMacros = {},
    map = {},
    jumpindicesInitial = {},
    tableInstancesInitial = []
) => {
    let macros = startingMacros;
    const macro = macros[name];
    check(macro, `expected ${name} to exist!`);
    const {
        ops,
        templateParams,
    } = macro;
    const templateArguments = templateArgumentsRaw.reduce((a, t) => [...a, ...regex.sliceCommas(t)], []);

    check(templateParams.length === templateArguments.length, `macro ${name} has invalid templated inputs!`);
    const templateRegExps = templateParams.map((label, i) => {
        const pattern = new RegExp(`\\b(${label})\\b`, 'g');
        const value = templateArguments[i];
        return { pattern, value };
    });

    const jumptable = [];
    let jumpindices = {};
    let tableInstances = [...tableInstancesInitial];
    let offset = startingBytecodeIndex;
    const codes = ops.map((op, index) => {
        switch (op.type) {
            case TYPES.MACRO: {
                const args = parser.substituteTemplateArguments(op.args, templateRegExps);
                const result = parser.processMacroInternal(op.value, offset, args, macros, map, jumpindicesInitial, []);
                tableInstances = [...tableInstances, ...result.tableInstances];
                jumptable[index] = result.unmatchedJumps;
                jumpindices = { ...jumpindices, ...result.jumpindices };
                offset += (result.data.bytecode.length / 2);
                return result.data;
            }
            case TYPES.TEMPLATE: {
                const macroNameIndex = templateParams.indexOf(op.value);
                check(index !== -1, `cannot find template ${op.value}`);
                // what is this template? It's either a macro or a template argument;
                let templateName = templateArguments[macroNameIndex];
                ({ macros, templateName } = parser.parseTemplate(templateName, macros, index));
                const result = parser.processMacroInternal(templateName, offset, [], macros, map, jumpindicesInitial, []);
                tableInstances = [...tableInstances, ...result.tableInstances];
                jumptable[index] = result.unmatchedJumps;
                jumpindices = { ...jumpindices, ...result.jumpindices };
                offset += (result.data.bytecode.length / 2);
                return result.data;
            }
            case TYPES.CODESIZE: {
                check(index !== -1, `cannot find macro ${op.value}`);
                const result = parser.processMacroInternal(op.value, offset, op.args, macros, map, jumpindicesInitial, []);
                const hex = formatEvenBytes((result.data.bytecode.length / 2).toString(16));
                const opcode = toHex(95 + (hex.length / 2));
                const bytecode = `${opcode}${hex}`;
                offset += (bytecode.length / 2);
                return {
                    bytecode: `${opcode}${hex}`,
                    sourcemap: [inputMaps.getFileLine(op.index, map)],
                };
            }
            case TYPES.OPCODE: {
                offset += 1;
                return {
                    bytecode: op.value,
                    sourcemap: [inputMaps.getFileLine(op.index, map)],
                };
            }
            case TYPES.PUSH: {
                check(op.args.length === 1, `wrong argument count for PUSH, ${JSON.stringify(op)}`);
                const codebytes = 1 + (op.args[0].length / 2);
                const sourcemap = [inputMaps.getFileLine(op.index, map)];
                offset += codebytes;
                return {
                    bytecode: `${op.value}${op.args[0]}`,
                    sourcemap: [...new Array(codebytes)].map(() => sourcemap),
                };
            }
            case TYPES.PUSH_JUMP_LABEL: {
                jumptable[index] = [{ label: op.value, bytecodeIndex: 0 }];
                const sourcemap = inputMaps.getFileLine(op.index, map);
                offset += 3;
                return {
                    bytecode: `${opcodes.push2}xxxx`,
                    sourcemap: [sourcemap, sourcemap, sourcemap],
                };
            }
            case TYPES.TABLE_START_POSITION: {
                tableInstances.push({ label: op.value, offset });
                const sourcemap = inputMaps.getFileLine(op.index, map);
                offset += 3;
                return {
                    bytecode: `${opcodes.push2}xxxx`,
                    sourcemap: [sourcemap, sourcemap, sourcemap],
                };
            }
            case TYPES.JUMPDEST: {
                jumpindices[op.value] = {
                    index,
                    offset,
                };
                offset += 1;
                return {
                    bytecode: opcodes.jumpdest,
                    sourcemap: [inputMaps.getFileLine(op.index, map)],
                };
            }
            default: {
                check(false, `could not interpret op ${JSON.stringify(op)}`);
                return null;
            }
        }
    });
    let runningIndex = startingBytecodeIndex;
    const codeIndices = codes.map(({ bytecode }) => {
        const old = runningIndex;
        runningIndex += bytecode.length / 2;
        return old;
    });
    const unmatchedJumps = [];
    // so what do I need to do???
    // for every jump label, I need to get the absolute bytecode index
    const data = codes.reduce((acc, { bytecode, sourcemap }, index) => {
        let formattedBytecode = bytecode;
        if (jumptable[index]) {
            const jumps = jumptable[index];
            // eslint-disable-next-line no-restricted-syntax
            for (const { label: jumplabel, bytecodeIndex } of jumps) {
                if (jumpindices[jumplabel]) {
                    const jumpindex = jumpindices[jumplabel].index;
                    const jumpvalue = padNBytes(toHex(codeIndices[jumpindex]), 2);
                    const pre = formattedBytecode.slice(0, bytecodeIndex + 2);
                    const post = formattedBytecode.slice(bytecodeIndex + 6);
                    if (formattedBytecode.slice(bytecodeIndex + 2, bytecodeIndex + 6) !== 'xxxx') {
                        throw new Error(
                            `expected indicies ${bytecodeIndex + 2} to ${bytecodeIndex + 6} to be jump location, of
                            ${formattedBytecode}`
                        );
                    }
                    formattedBytecode = `${pre}${jumpvalue}${post}`;
                } else {
                    const jumpOffset = (codeIndices[index] - startingBytecodeIndex) * 2;
                    unmatchedJumps.push({ label: jumplabel, bytecodeIndex: jumpOffset + bytecodeIndex });
                }
            }
        }
        return {
            bytecode: acc.bytecode + formattedBytecode,
            sourcemap: [...acc.sourcemap, ...sourcemap],
            jumpindices: { ...jumpindicesInitial, ...jumpindices },
        };
    }, {
        bytecode: '',
        sourcemap: [],
    });
    // TODO. If jump label
    /* const keys = Object.keys(jumpindices);
    keys.forEach((key) => {
        check(jumptable.find(i => i === key), `jump label ${key} is not used anywhere!`);
    }); */
    return {
        data,
        unmatchedJumps,
        jumpindices,
        tableInstances,
    };
};

parser.parseJumpTable = (body, compressed = false) => {
    const jumps = body.match(grammar.jumpTable.JUMPS).map(j => j.replace(/(\r\n\t|\n|\r\t|\s)/gm, ''));
    const size = jumps.length * 0x20;
    return {
        jumps,
        size,
        compressed,
    };
};

parser.parseMacro = (body, macros, jumptables, startingIndex = 0) => {
    let input = body;
    let index = 0;
    const ops = [];
    const jumpdests = {};
    while (!regex.endOfData(input)) {
        if (input.match(grammar.macro.MACRO_CALL)) {
            const token = input.match(grammar.macro.MACRO_CALL);
            const macroName = token[1];
            const templateArgs = token[2] ? [token[2]] : [];
            check(macros[macroName], `expected ${macroName} to be a macro`);
            ops.push({
                type: TYPES.MACRO,
                value: macroName,
                args: templateArgs,
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.TEMPLATE)) {
            const token = input.match(grammar.macro.TEMPLATE);
            ops.push({
                type: TYPES.TEMPLATE,
                value: token[1],
                args: [],
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.CODE_SIZE)) {
            const token = input.match(grammar.macro.CODE_SIZE);
            const templateParams = token[2] ? [token[2]] : [];
            ops.push({
                type: TYPES.CODESIZE,
                value: token[1],
                args: templateParams,
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.TABLE_SIZE)) {
            const token = input.match(grammar.macro.TABLE_SIZE);
            const table = token[1];
            if (!jumptables[table]) {
                throw new Error(`could not find jumptable ${table} in ${jumptables}`);
            }
            const hex = formatEvenBytes(toHex(jumptables[table].table.size));
            ops.push({
                type: TYPES.PUSH,
                value: toHex(95 + (hex.length / 2)),
                args: [hex],
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.TABLE_START)) {
            const token = input.match(grammar.macro.TABLE_START);
            ops.push({
                type: TYPES.TABLE_START_POSITION,
                value: token[1],
                args: [],
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.JUMP_LABEL)) {
            const token = input.match(grammar.macro.JUMP_LABEL);
            check(!jumpdests[token[1]], `jump label ${token[1]} has already been defined`);
            ops.push({
                type: TYPES.JUMPDEST,
                value: token[1],
                args: [],
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            jumpdests[token[1]] = true;
            index += token[0].length;
        } else if (input.match(grammar.macro.LITERAL_DECIMAL)) {
            const token = input.match(grammar.macro.LITERAL_DECIMAL);
            const hex = formatEvenBytes(toHex(token[1]));
            ops.push({
                type: TYPES.PUSH,
                value: toHex(95 + (hex.length / 2)),
                args: [hex],
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.LITERAL_HEX)) {
            const token = input.match(grammar.macro.LITERAL_HEX);
            const hex = formatEvenBytes(token[1]);
            ops.push({
                type: TYPES.PUSH,
                value: toHex(95 + (hex.length / 2)),
                args: [hex],
                index: startingIndex + index + regex.countEmptyChars(token[0]),
            });
            index += token[0].length;
        } else if (input.match(grammar.macro.TOKEN)) {
            const token = input.match(grammar.macro.TOKEN);
            if (opcodes[token[1]]) {
                ops.push({
                    type: TYPES.OPCODE,
                    value: opcodes[token[1]],
                    args: [],
                    index: startingIndex + index + regex.countEmptyChars(token[0]),
                });
            } else {
                ops.push({
                    type: TYPES.PUSH_JUMP_LABEL,
                    value: token[1],
                    args: [],
                    index: startingIndex + index + regex.countEmptyChars(token[0]),
                });
            }
            index += token[0].length;
        } else {
            throw new Error(`cannot parse ${input}!`);
        }
        input = body.slice(index);
    }
    return ops;
};

parser.parseTopLevel = (raw, startingIndex, inputMap) => {
    let input = raw.slice(startingIndex);
    let currentContext = CONTEXT.NONE;

    let macros = {};
    let jumptables = {};
    let currentExpression = { templateParams: [] };
    let index = startingIndex;
    while (!regex.endOfData(input)) {
        if ((currentContext === CONTEXT.NONE) && input.match(grammar.topLevel.TEMPLATE)) {
            const template = input.match(grammar.topLevel.TEMPLATE);
            const templateParams = regex.sliceCommas(template[1]);
            index += template[0].length;
            currentExpression = {
                ...currentExpression,
                templateParams,
            };
            currentContext = CONTEXT.MACRO;
        } else if ((currentContext & (CONTEXT.MACRO | CONTEXT.NONE)) && grammar.topLevel.MACRO.test(input)) {
            const macro = input.match(grammar.topLevel.MACRO);
            const type = macro[1];
            if (type !== 'macro') {
                throw new Error(`expected ${macro} to define a macro`);
            }
            const body = macro[5];
            macros = {
                ...macros,
                [macro[2]]: {
                    ...currentExpression,
                    name: macro[2],
                    takes: macro[3],
                    ops: parser.parseMacro(body, macros, jumptables, index),
                    body: macro[5],
                },
            };
            index += macro[0].length;
            currentContext = CONTEXT.NONE;
            currentExpression = { templateParams: [] };
        } else if ((currentContext & CONTEXT.NONE) && grammar.topLevel.JUMP_TABLE_PACKED.test(input)) {
            const jumptable = input.match(grammar.topLevel.JUMP_TABLE_PACKED);
            const type = jumptable[1];
            if (type !== 'jumptable') {
                throw new Error(`expected ${jumptable} to define a macro`);
            }
            const body = jumptable[3];
            jumptables = {
                ...jumptables,
                [jumptable[2]]: {
                    name: jumptable[2],
                    table: parser.parseJumpTable(body, true),
                },
            };
            index += jumptable[0].length;
        } else if ((currentContext & CONTEXT.NONE) && grammar.topLevel.JUMP_TABLE.test(input)) {
            const jumptable = input.match(grammar.topLevel.JUMP_TABLE);
            const type = jumptable[1];
            if (type !== 'jumptable') {
                throw new Error(`expected ${jumptable} to define a macro`);
            }
            const body = jumptable[3];
            jumptables = {
                ...jumptables,
                [jumptable[2]]: {
                    name: jumptable[2],
                    table: parser.parseJumpTable(body, false),
                },
            };
            index += jumptable[0].length;
        } else {
            const { filename, lineNumber, line } = inputMaps.getFileLine(index, inputMap);
            throw new Error(`could not process line ${lineNumber} in ${filename}: ${line}`);
        }
        input = raw.slice(index);
    }
    return { macros, jumptables };
};

parser.removeComments = (string) => {
    let data = string;
    let formatted = '';
    while (!regex.endOfData(data)) {
        const multiIndex = data.indexOf('/*');
        const singleIndex = data.indexOf('//');
        if (multiIndex !== -1 && ((multiIndex < singleIndex) || singleIndex === -1)) {
            formatted += data.slice(0, multiIndex);
            const endBlock = data.indexOf('*/');
            check(endBlock !== -1, 'could not find closing comment block \\*');
            formatted += ' '.repeat(endBlock - multiIndex + 2);
            data = data.slice(endBlock + 2);
        } else if (singleIndex !== -1) {
            formatted += data.slice(0, singleIndex);
            data = data.slice(singleIndex);
            const endBlock = data.indexOf('\n');
            if (!endBlock) {
                formatted += ' '.repeat(data.length);
                data = '';
            } else {
                formatted += ' '.repeat(endBlock + 1);
                data = data.slice(endBlock + 1);
            }
        } else {
            formatted += data;
            break;
        }
    }
    return formatted;
};


parser.getFileContents = (originalFilename, partialPath) => {
    const included = {};
    const recurse = (filename) => {
        let fileString;
        if (filename.includes('#')) {
            fileString = filename; // hacky workaround for direct strings. TODO: find something more elegant
        } else {
            const filepath = path.posix.resolve(partialPath, filename);
            fileString = fs.readFileSync(filepath, 'utf8');
        }
        let formatted = parser.removeComments(fileString);
        let imported = [];
        let test = formatted.match(grammar.topLevel.IMPORT);
        while (test !== null) {
            const importStatement = formatted.match(grammar.topLevel.IMPORT);
            const empty = ' '.repeat(importStatement[0].length);
            formatted = empty + formatted.slice(importStatement[0].length);
            if (!included[importStatement[1]]) {
                imported = [...imported, ...recurse(importStatement[1])];
                included[importStatement[1]] = true;
            }
            test = formatted.match(grammar.topLevel.IMPORT);
        }

        const result = [...imported, {
            filename,
            data: formatted,
        }];
        return result;
    };
    const filedata = recurse(originalFilename);
    const raw = filedata.reduce((acc, { data }) => {
        return acc + data;
    }, '');
    return { filedata, raw };
};

parser.parseFile = (filename, partialPath) => {
    const { filedata, raw } = parser.getFileContents(filename, partialPath);
    const map = inputMaps.createInputMap(filedata);
    const { macros, jumptables } = parser.parseTopLevel(raw, 0, map);
    return { inputMap: map, macros, jumptables };
};

parser.compileMacro = (macroName, filename, partialPath) => {
    const { filedata, raw } = parser.getFileContents(filename, partialPath);
    const map = inputMaps.createInputMap(filedata);
    const { macros, jumptables } = parser.parseTopLevel(raw, 0, map);
    const { bytecode, sourcemap } = parser.processMacro(macroName, 0, [], macros, map, jumptables);
    return { bytecode, sourcemap };
};

module.exports = parser;
