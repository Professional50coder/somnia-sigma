// Worked example: price one window with the JS port. Run: node backtest/example.mjs
import { probUp, studentProbUp, edgeBps, breakEvenBps, kellyFraction } from "./pricer.mjs";

const open = 81281.9;   // window opening price = the strike
const spot = 81525.7;   // current mark price (+0.30%)
const sigma = 0.0035;   // volatility over the FULL window, not annualised (0.35%)
const tau = 0.25;       // fraction of the window remaining
const book = 0.70;      // YES price quoted on the book
const nu = 5.2;         // Student-t degrees of freedom

const gaussian = probUp(spot, open, sigma, tau);
const student = studentProbUp(spot, open, sigma, tau, nu);
console.log(`Gaussian fair prob : ${(gaussian * 100).toFixed(2)}%`);
console.log(`Student-t fair prob: ${(student * 100).toFixed(2)}%`);
console.log(`Book (YES price)   : ${(book * 100).toFixed(2)}%`);
console.log(`Edge               : ${edgeBps(gaussian, book).toFixed(0)} bps`);
console.log(`Break-even win rate: ${breakEvenBps(book).toFixed(0)} bps`);
console.log(`Kelly fraction     : ${(kellyFraction(gaussian, book) * 100).toFixed(2)}% of bankroll`);
