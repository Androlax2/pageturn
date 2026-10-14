/**
 * Entry of pageturn.js, the classic script for sites without a bundler: the head script
 * with its native half, then the kernel with prefetch and the native hand-off, with the
 * API on window.pageturn (endArrival is there already, from the head script).
 */
import "../head/head.ts";
import { chooseMove, configure, defineMove, whenLeft } from "../index.ts";

Object.assign(window.pageturn ?? {}, {
  defineMove,
  chooseMove,
  whenLeft,
  configure,
});
