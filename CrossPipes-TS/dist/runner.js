"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const alsatian_1 = require("alsatian");
const tap_bark_1 = require("tap-bark");
// create test set
const testSet = alsatian_1.TestSet.create();
// add your tests
testSet.addTestsFromFiles("./tests/**/*.spec.ts");
// create a test runner
const testRunner = new alsatian_1.TestRunner();
// setup the output
testRunner.outputStream
    // this will use alsatian's default output if you remove this
    // you'll get TAP or you can add your favourite TAP reporter in it's place
    .pipe(tap_bark_1.TapBark.create().getPipeable())
    // pipe to the console
    .pipe(process.stdout);
// run the test set
testRunner.run(testSet)
    // this will be called after all tests have been run
    .then((results) => done())
    // this will be called if there was a problem
    .catch((error) => doSomethingWith(error));
function done() {
    console.log("Done");
}
function doSomethingWith(error) {
    console.log("ERROR:" + error);
}
//# sourceMappingURL=runner.js.map