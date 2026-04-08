/**
 * evaluator.js — CODE COMBAT Deterministic Evaluation Engine
 * ─────────────────────────────────────────────────────────────
 * Fixes every root cause of non-deterministic behaviour:
 *
 *  [FIX 1] Input deep-cloned before EVERY test case via structuredClone
 *           → user code mutating arr.sort(), arr.splice() etc. cannot
 *             affect subsequent test cases
 *
 *  [FIX 2] Fresh vm.Context created per test case
 *           → no variable / closure state leaks between test 1 and test 4
 *
 *  [FIX 3] deepEqual() replaces JSON.stringify comparison
 *           → correctly handles NaN, -0, undefined, Infinity, key order
 *
 *  [FIX 4] Hard per-test-case timeout via vm.runInContext({ timeout })
 *           → infinite loops cannot block the Node.js event loop
 *
 *  [FIX 5] Prototype snapshot before/after execution
 *           → detects Array.prototype / Object.prototype pollution
 *
 *  [FIX 6] Syntax pre-validation with vm.Script before entering test loop
 *           → SyntaxError caught immediately, no partial test runs
 *
 *  [FIX 7] Dangerous globals blocked from sandbox (process, require, fetch)
 *           → user code cannot read environment variables or make HTTP calls
 */

'use strict';

const vm = require('vm');
const v8 = require('v8');

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 3000;
const MAX_CODE_LENGTH    = 50_000;
const MAX_LOG_CHARS      = 5_000;

// ─────────────────────────────────────────────────────────────
// DEEP CLONE
// Priority: structuredClone (Node 17+) → v8 serialize → JSON
// ─────────────────────────────────────────────────────────────
function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return v8.deserialize(v8.serialize(value)); } catch (_) {}
  return JSON.parse(JSON.stringify(value));
}

// ─────────────────────────────────────────────────────────────
// DEEP EQUAL — handles NaN, -0, undefined, nested structures
// ─────────────────────────────────────────────────────────────
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    if (isNaN(a) && isNaN(b)) return true;
    if (a === 0 && b === 0) return (1 / a) === (1 / b); // -0 vs +0
  }
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// SAFE STRINGIFY — display values in output panel
// ─────────────────────────────────────────────────────────────
function safeStr(v) {
  if (v === undefined)  return 'undefined';
  if (v === null)       return 'null';
  if (typeof v === 'number') {
    if (isNaN(v))       return 'NaN';
    if (!isFinite(v))   return v > 0 ? 'Infinity' : '-Infinity';
    if (Object.is(v, -0)) return '-0';
  }
  try { return JSON.stringify(v); } catch (_) { return String(v); }
}

// ─────────────────────────────────────────────────────────────
// SYNTAX CHECK — fails fast before entering the test loop
// ─────────────────────────────────────────────────────────────
function validateSyntax(code) {
  try {
    new vm.Script(code, { filename: 'solution.js' });
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `SyntaxError: ${e.message}` };
  }
}

// ─────────────────────────────────────────────────────────────
// PROTOTYPE SNAPSHOT — detect pollution after execution
// ─────────────────────────────────────────────────────────────
function snapshotProtos() {
  return {
    arr : Object.getOwnPropertyNames(Array.prototype).length,
    obj : Object.getOwnPropertyNames(Object.prototype).length,
    fn  : Object.getOwnPropertyNames(Function.prototype).length,
  };
}
function wasPolluted(before, after) {
  return before.arr !== after.arr || before.obj !== after.obj || before.fn !== after.fn;
}

// ─────────────────────────────────────────────────────────────
// RUN ONE TEST CASE
// ─────────────────────────────────────────────────────────────
function runOneTestCase(userCode, testCase, timeoutMs) {
  // [FIX 1] Independent deep clone for this test case only
  const inputClone    = deepClone(testCase.input);
  const expectedClone = deepClone(testCase.expected);

  // Capture user console output
  const logs = [];
  const captureConsole = {
    log  : (...a) => { if (logs.join('').length < MAX_LOG_CHARS) logs.push(a.map(safeStr).join(' ')); },
    error: (...a) => { if (logs.join('').length < MAX_LOG_CHARS) logs.push('[ERR] ' + a.map(safeStr).join(' ')); },
    warn : (...a) => { if (logs.join('').length < MAX_LOG_CHARS) logs.push('[WARN] ' + a.map(safeStr).join(' ')); },
    info : (...a) => { if (logs.join('').length < MAX_LOG_CHARS) logs.push('[INFO] ' + a.map(safeStr).join(' ')); },
    dir  : () => {},
    table: () => {},
  };

  // [FIX 2] Fresh isolated context per test case
  // Dangerous globals are intentionally omitted: process, require, fetch,
  // XMLHttpRequest, eval, Function constructor, setTimeout, setInterval
  const sandbox = vm.createContext({
    // Safe standard globals
    console   : captureConsole,
    Math, JSON, Date,
    parseInt, parseFloat, isNaN, isFinite,
    Number, String, Boolean, Array, Object,
    Map, Set, WeakMap, WeakSet,
    Symbol, BigInt,
    Error, TypeError, RangeError, ReferenceError, SyntaxError,
    Promise,
    // Injected test input — already deep-cloned
    __input__ : inputClone,
    __result__: undefined,
  });

  const protoBefore = snapshotProtos();
  const t0          = Date.now();
  let result, error = null, reason = 'ok';

  try {
    // [FIX 4] Hard timeout enforced by V8 — throws ERR_SCRIPT_EXECUTION_TIMEOUT
    vm.runInContext(
      `
      (function() {
        'use strict';
        ${userCode}

        // Locate the user's function (must be named 'solution')
        if (typeof solution !== 'function') {
          throw new ReferenceError('No function named "solution" found. Name your function: function solution(...) {}');
        }

        // Call with correct argument shape
        if (__input__ !== null && typeof __input__ === 'object' && !Array.isArray(__input__) && '__target__' in __input__) {
          // Binary-search style: { arr, target }
          __result__ = solution(__input__.arr, __input__.target);
        } else {
          __result__ = solution(__input__);
        }
      })();
      `,
      sandbox,
      { filename: 'solution.js', timeout: timeoutMs, breakOnSigint: true }
    );

    result = sandbox.__result__;

    // [FIX 5] Prototype pollution check
    if (wasPolluted(protoBefore, snapshotProtos())) {
      reason = 'prototype_pollution';
      error  = 'Your code modified a built-in prototype (Array.prototype, Object.prototype, etc.). This is not allowed.';
    }

  } catch (err) {
    error  = err.message || String(err);
    reason = (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') ? 'timeout' : 'runtime_error';
    result = undefined;
  }

  // [FIX 3] deepEqual instead of JSON.stringify
  const passed = reason === 'ok' && deepEqual(result, expectedClone);

  return {
    passed,
    reason,
    actual      : result,
    expected    : expectedClone,
    input       : inputClone,
    error,
    timeMs      : Date.now() - t0,
    logs,
    actualStr   : safeStr(result),
    expectedStr : safeStr(expectedClone),
    inputStr    : safeStr(inputClone),
  };
}

// ─────────────────────────────────────────────────────────────
// RUN ALL TEST CASES
// ─────────────────────────────────────────────────────────────
function runAllTestCases(userCode, testCases, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (typeof userCode !== 'string') {
    return { allPassed: false, syntaxError: 'Code must be a string.', results: [], totalTimeMs: 0 };
  }
  if (userCode.length > MAX_CODE_LENGTH) {
    return { allPassed: false, syntaxError: `Code exceeds maximum length (${MAX_CODE_LENGTH} chars).`, results: [], totalTimeMs: 0 };
  }

  // [FIX 6] Syntax check first — before any test case is run
  const syn = validateSyntax(userCode);
  if (!syn.valid) {
    return { allPassed: false, syntaxError: syn.error, results: [], totalTimeMs: 0 };
  }

  const t0      = Date.now();
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const res = runOneTestCase(userCode, testCases[i], timeoutMs);
    results.push({ testNum: i + 1, ...res });

    // Early abort on timeout — skip remaining test cases
    if (res.reason === 'timeout') {
      for (let j = i + 1; j < testCases.length; j++) {
        results.push({
          testNum    : j + 1,
          passed     : false,
          reason     : 'skipped',
          actual     : undefined,
          expected   : deepClone(testCases[j].expected),
          input      : deepClone(testCases[j].input),
          error      : 'Skipped — previous test timed out.',
          timeMs     : 0,
          logs       : [],
          actualStr  : 'N/A',
          expectedStr: safeStr(testCases[j].expected),
          inputStr   : safeStr(testCases[j].input),
        });
      }
      break;
    }
  }

  return {
    allPassed  : results.every(r => r.passed),
    results,
    totalTimeMs: Date.now() - t0,
    syntaxError: null,
  };
}

// Python stub — real execution needs a child_process/Docker sandbox
function runPython() {
  return {
    allPassed  : false,
    syntaxError: 'Python execution requires a backend sandbox (not yet implemented). Switch to JavaScript.',
    results    : [],
    totalTimeMs: 0,
  };
}

module.exports = { runAllTestCases, runOneTestCase, runPython, deepClone, deepEqual, safeStr, validateSyntax };
